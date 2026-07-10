/**
 * Builds a Gmail compose URL that opens a new draft pre-filled with `to`,
 * subject, and body. Used by the Compose Email launcher (ADR-0001): clicking
 * Compose Email opens this URL in a new tab via `window.open(url, '_blank')`.
 *
 * Gmail's compose interface uses `?view=cm&fs=1`. The `fs=1` flag forces the
 * full-screen composer so the admin can drag the PDF into the window without
 * the popout view collapsing.
 *
 * Pure — no DOM, no window references. The caller (a React component)
 * opens the URL.
 */

const GMAIL_COMPOSE_BASE = "https://mail.google.com/mail/?view=cm&fs=1";

export interface GmailComposeArgs {
  to: string;
  subject: string;
  body: string;
}

export function buildGmailComposeUrl(args: GmailComposeArgs): string {
  const params = new URLSearchParams({
    to: args.to,
    su: args.subject,
    body: args.body,
  });
  return `${GMAIL_COMPOSE_BASE}&${params.toString()}`;
}
