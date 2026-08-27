/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

/**
 * Security contract for the seed bootstrap functions (deploy research, issue #64):
 * they must be internal (dashboard-only), not callable by public clients, while
 * the dashboard bootstrap path keeps working.
 *
 * Visibility is asserted on the registered function objects' isInternal/isPublic
 * flags — the exact metadata the Convex server reads to decide whether a client
 * may call the function. These assertions fail on the pre-fix public
 * registrations (isPublic: true, isInternal: undefined).
 */

// seedAdmin.ts captures ADMIN_SEED_PASSWORD at module load; set it before the
// lazy module imports below (and convex-test's glob loader) ever run.
process.env.ADMIN_SEED_PASSWORD = "TestSeedPassword1!";

const modules = import.meta.glob("./**/*.*s");

describe("seed function visibility", () => {
  it("seedReferenceData is registered as internal, not public", async () => {
    const { seedReferenceData } = await import("./seed");
    expect(seedReferenceData.isInternal).toBe(true);
    expect(seedReferenceData.isPublic).toBeUndefined();
  });

  it("seedAdminUser is registered as internal, not public", async () => {
    const { seedAdminUser } = await import("./seedAdmin");
    expect(seedAdminUser.isInternal).toBe(true);
    expect(seedAdminUser.isPublic).toBeUndefined();
  });

  it("seed functions are absent from the public api type surface", () => {
    // Public clients (ConvexReactClient etc.) address functions through `api`,
    // which only contains FunctionReference<_, "public">. After the hardening
    // these lines no longer typecheck — tsc fails if they ever become public.
    // @ts-expect-error seedReferenceData is internal-only
    api.seed.seedReferenceData;
    // @ts-expect-error seedAdminUser is internal-only
    api.seedAdmin.seedAdminUser;
    // ...while the internal references remain addressable for the dashboard.
    expect(internal.seed.seedReferenceData).toBeDefined();
    expect(internal.seedAdmin.seedAdminUser).toBeDefined();
  });
});

describe("dashboard bootstrap still works via internal references", () => {
  it("seedReferenceData seeds all reference tables and stays idempotent", async () => {
    const t = convexTest(schema, modules);

    const first = await t.mutation(internal.seed.seedReferenceData, {});
    expect(first).toEqual({ status: "seeded" });

    const counts = await t.run(async (ctx) => ({
      academicYears: (await ctx.db.query("academicYears").collect()).length,
      campuses: (await ctx.db.query("campuses").collect()).length,
      standardLevels: (await ctx.db.query("standardLevels").collect()).length,
      gradeMapping: (await ctx.db.query("gradeMapping").collect()).length,
      subjects: (await ctx.db.query("subjects").collect()).length,
      discountRules: (await ctx.db.query("discountRules").collect()).length,
    }));
    expect(counts).toEqual({
      academicYears: 7,
      campuses: 3,
      standardLevels: 16,
      gradeMapping: 6,
      subjects: 12,
      discountRules: 4,
    });

    const second = await t.mutation(internal.seed.seedReferenceData, {});
    expect(second).toEqual({ status: "already_seeded" });
  });

  it("seedAdminUser creates the admin account and stays idempotent", async () => {
    const t = convexTest(schema, modules);

    const first = await t.action(internal.seedAdmin.seedAdminUser, {});
    expect(first).toEqual({ status: "created" });

    const admin = await t.run(async (ctx) =>
      ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", "admin@school.edu"))
        .first(),
    );
    expect(admin).toMatchObject({ role: "admin", isActive: true });

    const account = await t.run(async (ctx) =>
      ctx.db
        .query("authAccounts")
        .filter((q) => q.eq(q.field("userId"), admin?._id))
        .first(),
    );
    expect(account).toMatchObject({
      provider: "password",
      providerAccountId: "admin@school.edu",
    });
    expect(account?.secret).toBeTruthy();

    const second = await t.action(internal.seedAdmin.seedAdminUser, {});
    expect(second).toEqual({ status: "already_exists" });
  });
});
