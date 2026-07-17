import { describe, expect, it } from "vitest";
import {
  deriveInviteState,
  formatInviteCountdown,
  INVITE_AMBER_MS,
  INVITE_TTL_MS,
  isExpiringSoon,
} from "./inviteStatus";

// A fixed reference "now" so every case reads as an offset from it. No clock.
const NOW = 1_700_000_000_000;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe("deriveInviteState", () => {
  it("pending well before expiry → valid", () => {
    expect(deriveInviteState("pending", NOW + INVITE_TTL_MS, NOW)).toBe(
      "valid",
    );
  });

  it("pending exactly at expiry → still valid (boundary is inclusive)", () => {
    expect(deriveInviteState("pending", NOW, NOW)).toBe("valid");
  });

  it("pending one ms past expiry → expired", () => {
    expect(deriveInviteState("pending", NOW - 1, NOW)).toBe("expired");
  });

  it("accepted is terminal regardless of expiry (unexpired)", () => {
    expect(deriveInviteState("accepted", NOW + INVITE_TTL_MS, NOW)).toBe(
      "accepted",
    );
  });

  it("accepted is terminal even when the clock is past expiry", () => {
    expect(deriveInviteState("accepted", NOW - 1, NOW)).toBe("accepted");
  });

  it("revoked is terminal regardless of expiry (unexpired)", () => {
    expect(deriveInviteState("revoked", NOW + INVITE_TTL_MS, NOW)).toBe(
      "revoked",
    );
  });

  it("revoked is terminal even when the clock is past expiry", () => {
    expect(deriveInviteState("revoked", NOW - 1, NOW)).toBe("revoked");
  });
});

describe("isExpiringSoon (< 48h amber threshold)", () => {
  it("more than 48h left → not soon", () => {
    expect(isExpiringSoon(NOW + INVITE_AMBER_MS + 1, NOW)).toBe(false);
  });

  it("exactly 48h left → not yet soon (strictly under)", () => {
    expect(isExpiringSoon(NOW + INVITE_AMBER_MS, NOW)).toBe(false);
  });

  it("just under 48h left → soon", () => {
    expect(isExpiringSoon(NOW + INVITE_AMBER_MS - 1, NOW)).toBe(true);
  });

  it("one ms of life left → soon", () => {
    expect(isExpiringSoon(NOW + 1, NOW)).toBe(true);
  });

  it("already expired → not soon (countdown is dead, not amber)", () => {
    expect(isExpiringSoon(NOW, NOW)).toBe(false);
    expect(isExpiringSoon(NOW - 1, NOW)).toBe(false);
  });
});

describe("formatInviteCountdown (days ≥48h, hours below)", () => {
  it("multiple days → pluralized days", () => {
    expect(formatInviteCountdown(NOW + 6 * DAY, NOW)).toBe("in 6 days");
  });

  it("exactly the amber boundary (48h) → still days, singular", () => {
    expect(formatInviteCountdown(NOW + 2 * DAY, NOW)).toBe("in 2 days");
  });

  it("under 48h → hours, so the amber band reads in hours", () => {
    expect(formatInviteCountdown(NOW + 47 * HOUR, NOW)).toBe("in 47 hours");
    expect(formatInviteCountdown(NOW + 22 * HOUR, NOW)).toBe("in 22 hours");
  });

  it("one hour left → singular hour", () => {
    expect(formatInviteCountdown(NOW + HOUR, NOW)).toBe("in 1 hour");
  });

  it("sub-hour remainder never rounds down to zero", () => {
    expect(formatInviteCountdown(NOW + 60 * 1000, NOW)).toBe("in 1 hour");
  });
});
