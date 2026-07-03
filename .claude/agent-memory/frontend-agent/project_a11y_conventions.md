---
name: a11y-conventions-biome
description: Project a11y patterns that satisfy Biome's a11y lint rules — loading via <output>, labelled icon groups via role="img"
metadata:
  type: project
---

Biome's a11y lint (`useAriaPropsSupportedByRole`, `useSemanticElements`) rejects two things that are easy to reach for; use these established project patterns instead.

**Loading indicators → `<output>`, not `<div role="status">`.** `<output>` carries an implicit ARIA `status` role, so `getByRole("status")` still finds it AND Biome's `useSemanticElements` passes. `role="status"` on a raw `<div>` fails Biome. Set convention by `OverallPositionHeadline.tsx` and now `ClassComparisonCard.tsx` (see [[vitest-harness-gotchas]] for testing these). Put the human label in `aria-label`.

**Labelled icon+text groups → wrapper `<span role="img" aria-label="...">`.** `aria-label` on a *bare* `<span>` (no role) fails `useAriaPropsSupportedByRole`. Adding `role="img"` makes the span a single labelled graphic, which is valid; then mark the inner icon and any duplicated text `aria-hidden` so it isn't double-announced. `getByLabelText("...")` targets the wrapper in tests. Used for the you-vs-class delta indicator (label like "5.0 below class" / "same as class").

**Column-header sugar → visible glyph `aria-hidden` + `sr-only` full word**, e.g. a "Δ" header: `<span><span aria-hidden>Δ</span><span className="sr-only">Difference from class</span></span>`. Avoids `aria-label` on a bare span while keeping the label for screen readers.

**Why:** the moment you specify these, Biome's a11y rules fire; matching the semantic-element / valid-role forms keeps `npx biome check` at 0 errors without `biome-ignore`.

**How to apply:** reach for `<output>` for any skeleton/loading block; reach for `role="img"`+`aria-label` for any icon-that-conveys-meaning group; never rely on color alone to convey direction (pair icon + text label).
