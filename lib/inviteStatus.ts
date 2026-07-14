/**
 * Pure presentation-state derivation for invites (spec #55 / #56, testing seam 1).
 *
 * The five token-states that the acceptance page and the pending-invites list
 * both render from live in ONE place here, derived from `(status, expiresAt,
 * now)` with an EXPLICIT `now` so every boundary is testable without mocking a
 * clock. `expired` is derived, never stored — a `pending` invite past its
 * expiry is expired, with no cron/sweep. The auth gate consumes the same
 * function so the "still redeemable?" check can never drift from the UI.
 */

/** 7-day invite lifetime. Regenerate refreshes it. */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Under this much time left, a still-valid invite's countdown badge turns amber. */
export const INVITE_AMBER_MS = 48 * 60 * 60 * 1000;

/** The stored, non-derived invite lifecycle states. */
export type InviteStatus = "pending" | "accepted" | "revoked";

/** Presentation state a surface renders. `expired` is derived, not stored. */
export type InviteState = "valid" | "expired" | "accepted" | "revoked";

/**
 * Derive an invite's presentation state. A `pending` invite is `valid` up to and
 * including its `expiresAt` instant, and `expired` once `now` passes it. Terminal
 * `accepted` / `revoked` states ignore expiry.
 */
export function deriveInviteState(
  status: InviteStatus,
  expiresAt: number,
  now: number,
): InviteState {
  if (status === "accepted") return "accepted";
  if (status === "revoked") return "revoked";
  return now <= expiresAt ? "valid" : "expired";
}

/**
 * True when a still-valid invite has under 48h remaining — the management badge
 * uses this to turn the "expires in Nd" countdown amber. Only meaningful when
 * `deriveInviteState(...) === "valid"` (an already-expired invite returns false).
 */
export function isExpiringSoon(expiresAt: number, now: number): boolean {
  const remaining = expiresAt - now;
  return remaining > 0 && remaining < INVITE_AMBER_MS;
}

const RELATIVE_TIME = new Intl.RelativeTimeFormat("en", { numeric: "always" });

/**
 * Human countdown for a still-valid invite's badge: "in 6 days" / "in 22 hours".
 * Switches to hours below the 48h amber band so an amber row always reads in
 * hours (coherent urgency); `Intl.RelativeTimeFormat` handles pluralization.
 * Only meaningful when `deriveInviteState(...) === "valid"`.
 */
export function formatInviteCountdown(expiresAt: number, now: number): string {
  const HOUR = 60 * 60 * 1000;
  const remaining = expiresAt - now;
  if (remaining < INVITE_AMBER_MS) {
    // Never round a sliver of remaining life down to "in 0 hours".
    return RELATIVE_TIME.format(
      Math.max(1, Math.round(remaining / HOUR)),
      "hour",
    );
  }
  return RELATIVE_TIME.format(Math.round(remaining / (24 * HOUR)), "day");
}
