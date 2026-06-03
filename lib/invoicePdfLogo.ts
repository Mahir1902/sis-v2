/**
 * Loads the school logo as a base64 data URI for use inside @react-pdf
 * documents.
 *
 * Why a data URI? @react-pdf's `<Image>` accepts a URL but only resolves it
 * during render. Server-side rendering paths and browsers with strict CSP
 * both choke on `window.location.origin`-based absolute URLs, so we pre-fetch
 * the PNG once and inline it as `data:image/png;base64,…`.
 *
 * Why a cache? A 512×512 PNG is ~30–60KB. Bulk-downloading 25 invoices would
 * otherwise refetch and re-base64-encode 25 times. Caching the data URI at
 * module scope keeps the hot path tight while still letting tests reset the
 * state between cases via `__resetLogoDataUriCache`.
 *
 * The cache also dedupes concurrent in-flight calls — when two `downloadBulk`
 * callers race for the first load, we share the single in-flight promise
 * rather than firing two simultaneous fetches.
 */

const LOGO_PATH = "/SIS_Logo.png";

let cached: string | null = null;
let inFlight: Promise<string> | null = null;

export async function loadLogoDataUri(): Promise<string> {
  if (cached !== null) return cached;
  if (inFlight !== null) return inFlight;

  inFlight = (async () => {
    const res = await fetch(LOGO_PATH);
    // We call arrayBuffer() directly on the response — skipping the
    // intermediate Blob keeps the call chain short and matches how Node and
    // the browser both expose binary bodies.
    const arrayBuffer = await (res as Response).arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);
    const dataUri = `data:image/png;base64,${base64}`;
    cached = dataUri;
    return dataUri;
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

/**
 * Test-only: clear the cached data URI so each test runs against a fresh
 * fetch stub. Production code never calls this.
 */
export function __resetLogoDataUriCache(): void {
  cached = null;
  inFlight = null;
}

/**
 * Cross-environment ArrayBuffer → base64 conversion.
 *
 * Why not `Buffer.from(...).toString("base64")`? Next.js does not auto-polyfill
 * `Buffer` for browser bundles, so the hot path would crash at runtime. Why
 * not `btoa(String.fromCharCode(...bytes))`? `String.fromCharCode` with an
 * array spread blows the call-stack on a 60KB PNG. We chunk through the bytes
 * to stay safe across both Node and modern browsers.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  // In Node (tests) Buffer is fastest and always available. In the browser we
  // fall back to a chunked btoa() that handles arbitrary-size buffers.
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  const CHUNK_SIZE = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}
