import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      if (args.existingUserId !== null) return args.existingUserId;
      const email = args.profile.email as string;
      const name =
        (args.profile.name as string | undefined) ?? email.split("@")[0];
      // Check for a pre-provisioned user (e.g. seeded admin) — preserve their role
      const existing = await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("email"), email))
        .first();
      if (existing !== null) {
        await ctx.db.patch(existing._id, { name });
        return existing._id;
      }
      return await ctx.db.insert("users", {
        name,
        email,
        role: "student",
        isActive: true,
      });
    },
  },
});
