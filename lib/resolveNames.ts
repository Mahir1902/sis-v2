type NamedDoc = { _id: string; name: string } | null;

export function buildNameMap(docs: NamedDoc[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const doc of docs) {
    if (doc) {
      map.set(doc._id, doc.name);
    }
  }
  return map;
}

export function resolveName(
  map: Map<string, string>,
  id: string | null | undefined,
  fallback = "Unknown",
): string {
  if (!id) return fallback;
  return map.get(id) ?? fallback;
}
