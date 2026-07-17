import { z } from "zod";

/**
 * Admin "Invite user" form (spec #55 / ticket #59). Role is restricted to
 * admin/teacher here — students have no login path in this effort, so the UI
 * never offers it (the server mutation enforces the same union).
 */
export const invitableRoles = ["admin", "teacher"] as const;

export const inviteUserSchema = z.object({
  name: z.string().trim().min(2, "Enter the person's full name."),
  email: z.string().trim().email("Enter a valid email."),
  role: z.enum(invitableRoles),
});

export type InviteUserValues = z.infer<typeof inviteUserSchema>;
