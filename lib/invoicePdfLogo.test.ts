import { afterEach, describe, expect, it, vi } from "vitest";
import { __resetLogoDataUriCache, loadLogoDataUri } from "./invoicePdfLogo";

/**
 * Module-level cache for the SIS logo data URI used by the PDF generator.
 *
 * Why a cache? The logo is large (a 512×512 rasterised PNG). Without a cache
 * every bulk download of N invoices would refetch and re-base64-encode N
 * times. A single fetch keeps the hot path tight.
 *
 * The tests below stub `fetch` and assert call counts to prove the cache
 * holds across invocations. `__resetLogoDataUriCache` is a test-only escape
 * hatch so each test starts from a clean slate.
 */

function makeBlobLike(bytes: Uint8Array, mime: string) {
  return {
    type: mime,
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
}

afterEach(() => {
  __resetLogoDataUriCache();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("loadLogoDataUri", () => {
  it("returns a data: URI built from the fetched PNG bytes", async () => {
    // Three arbitrary bytes — easier to read in the assertion than random.
    const bytes = new Uint8Array([0xff, 0x00, 0x42]);
    const expectedBase64 = Buffer.from(bytes).toString("base64");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(makeBlobLike(bytes, "image/png"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadLogoDataUri();

    expect(result).toBe(`data:image/png;base64,${expectedBase64}`);
  });

  it("requests /SIS_Logo.png from the public dir", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(makeBlobLike(new Uint8Array([1, 2, 3]), "image/png"));
    vi.stubGlobal("fetch", fetchMock);

    await loadLogoDataUri();

    expect(fetchMock).toHaveBeenCalledWith("/SIS_Logo.png");
  });

  it("caches the data URI: a second call does not refetch", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(makeBlobLike(new Uint8Array([7, 8, 9]), "image/png"));
    vi.stubGlobal("fetch", fetchMock);

    const first = await loadLogoDataUri();
    const second = await loadLogoDataUri();

    expect(first).toBe(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("dedupes concurrent in-flight calls so only one fetch happens", async () => {
    // Two callers race for the logo before the first has resolved — we should
    // share the in-flight promise rather than fire two fetches.
    let resolveBody: ((value: unknown) => void) | undefined;
    const fetchMock = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveBody = resolve;
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const a = loadLogoDataUri();
    const b = loadLogoDataUri();

    // Resolve the single in-flight fetch.
    resolveBody?.(makeBlobLike(new Uint8Array([0xab, 0xcd]), "image/png"));

    const [resA, resB] = await Promise.all([a, b]);

    expect(resA).toBe(resB);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
