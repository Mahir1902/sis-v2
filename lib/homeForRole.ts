/**
 * Landing page for a user role. Admins get the stats dashboard;
 * everyone else (teacher, student, unknown) gets /students, which
 * every authenticated role can load.
 */
export function homeForRole(role: string | undefined): string {
  return role === "admin" ? "/dashboard" : "/students";
}
