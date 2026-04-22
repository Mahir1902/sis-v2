"use node";

import { Scrypt } from "lucia";
import { action } from "./_generated/server";
import { makeFunctionReference } from "convex/server";

const ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD;

// Use makeFunctionReference to avoid circular import through _generated/api
const checkAdminExists = makeFunctionReference<"query", Record<string, never>, boolean>(
  "seed:checkAdminExists"
);
const insertAdminRecords = makeFunctionReference<
  "mutation",
  { hashedPassword: string },
  { status: "already_exists" | "created" }
>("seed:insertAdminRecords");

/**
 * Seeds the initial admin account.
 * Run once from the Convex dashboard after first deploy.
 * Credentials: admin@school.edu / Admin1234!
 * Idempotent — safe to run multiple times.
 */
export const seedAdminUser = action({
  args: {},
  handler: async (ctx) => {
    if (!ADMIN_PASSWORD) {
      throw new Error("ADMIN_SEED_PASSWORD environment variable is not set");
    }

    const exists = await ctx.runQuery(checkAdminExists, {});
    if (exists) return { status: "already_exists" };

    const hashedPassword = await new Scrypt().hash(ADMIN_PASSWORD);
    return await ctx.runMutation(insertAdminRecords, { hashedPassword });
  },
});
