import { describe, expect, it } from "vitest";
import { buildNameMap, resolveName } from "./resolveNames";

describe("buildNameMap", () => {
  it("builds a map from an array of documents with _id and name", () => {
    const docs = [
      { _id: "campus1", name: "Campus One" },
      { _id: "campus2", name: "Campus Two" },
    ];
    const map = buildNameMap(docs);
    expect(map.get("campus1")).toBe("Campus One");
    expect(map.get("campus2")).toBe("Campus Two");
    expect(map.size).toBe(2);
  });

  it("skips null entries from failed lookups", () => {
    const docs = [
      { _id: "campus1", name: "Campus One" },
      null,
      { _id: "campus3", name: "Campus Three" },
    ];
    const map = buildNameMap(docs);
    expect(map.size).toBe(2);
    expect(map.has("campus1")).toBe(true);
    expect(map.has("campus3")).toBe(true);
  });

  it("returns empty map for empty array", () => {
    const map = buildNameMap([]);
    expect(map.size).toBe(0);
  });
});

describe("resolveName", () => {
  const map = new Map([
    ["campus1", "Campus One"],
    ["campus2", "Campus Two"],
  ]);

  it("resolves a known ID to its name", () => {
    expect(resolveName(map, "campus1")).toBe("Campus One");
  });

  it("returns fallback for unknown ID", () => {
    expect(resolveName(map, "unknown_id")).toBe("Unknown");
  });

  it("returns fallback for null ID", () => {
    expect(resolveName(map, null)).toBe("Unknown");
  });

  it("returns fallback for undefined ID", () => {
    expect(resolveName(map, undefined)).toBe("Unknown");
  });

  it("uses custom fallback when provided", () => {
    expect(resolveName(map, null, "N/A")).toBe("N/A");
  });
});
