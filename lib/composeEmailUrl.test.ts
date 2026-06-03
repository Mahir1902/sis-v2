import { describe, expect, it } from "vitest";
import { buildGmailComposeUrl } from "./composeEmailUrl";

describe("buildGmailComposeUrl", () => {
  it("targets Gmail's compose view", () => {
    const url = buildGmailComposeUrl({
      to: "parent@example.com",
      subject: "Hi",
      body: "Hello",
    });
    expect(url.startsWith("https://mail.google.com/mail/?view=cm")).toBe(true);
  });

  it("encodes the to, subject, and body as query params", () => {
    const url = new URL(
      buildGmailComposeUrl({
        to: "parent@example.com",
        subject: "Invoice INV-001",
        body: "Hello world",
      }),
    );
    expect(url.searchParams.get("to")).toBe("parent@example.com");
    expect(url.searchParams.get("su")).toBe("Invoice INV-001");
    expect(url.searchParams.get("body")).toBe("Hello world");
  });

  it("preserves newlines and unicode in the body via percent-encoding", () => {
    const body = "Dear Mr Rahman,\n\nবাংলা content — line 1\nline 2";
    const url = new URL(
      buildGmailComposeUrl({
        to: "parent@example.com",
        subject: "Invoice",
        body,
      }),
    );
    expect(url.searchParams.get("body")).toBe(body);
  });

  it("escapes characters that would otherwise break URL parsing", () => {
    const url = new URL(
      buildGmailComposeUrl({
        to: "parent+billing@example.com",
        subject: "Invoice & Receipt",
        body: "100% paid — thanks!",
      }),
    );
    expect(url.searchParams.get("to")).toBe("parent+billing@example.com");
    expect(url.searchParams.get("su")).toBe("Invoice & Receipt");
    expect(url.searchParams.get("body")).toBe("100% paid — thanks!");
  });
});
