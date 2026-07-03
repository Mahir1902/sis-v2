---
name: vitest-harness-gotchas
description: Non-obvious gotchas for the Vitest + React Testing Library test harness (config globs, jsdom, sandcastle leak)
metadata:
  type: project
---

The Vitest harness runs both pure-logic `lib/**/*.test.ts` and RTL `**/*.test.tsx` component tests from a single `vitest.config.ts` at project root.

**Gotcha — nested node_modules test leak.** The repo has `.sandcastle/worktrees/*/node_modules/` containing third-party packages (zod, @radix-ui) that ship their OWN `*.test.ts(x)` files. With `include: ["**/*.test.{ts,tsx}"]`, a bare `exclude: ["node_modules"]` does NOT stop these — a bare string only matches the top-level dir. You MUST use deep globs: `exclude` needs `**/node_modules/**`, `**/.next/**`, `**/.sandcastle/**`, `e2e/**`. Symptom if you get this wrong: ~7 extra "test files" appear and 2 zod codec tests fail with a confusing `expected Uint8Array, received Uint8Array` ZodError. Biome already ignores `.sandcastle`; keep Vitest aligned.

**Why:** the default Vitest exclude covers `**/node_modules/**`, but the moment you specify an explicit `exclude` array you replace that default and must re-add the deep glob yourself.

**How to apply:** whenever editing the Vitest `include`/`exclude`, re-run `npx vitest list` and confirm every listed file is under `lib/` or `components/` (project source) — nothing under `.sandcastle` or any `node_modules`.

**Lint/format harness fact:** the repo formats with **Biome**, config `biome.json` at root, `indentStyle: "space"` / `indentWidth: 2`. New `lib/*.ts` files written with tab indentation will fail `npx biome check` with format errors (no lint-rule violation, purely whitespace). Fix in one shot with `npx biome check --write <files>` — it auto-reformats tabs→2-space and reports 0 errors after. Write source with 2-space indent from the start to avoid the round-trip.

**RTL test isolation gotcha (component `.test.tsx`).** Because `globals: false`, `@testing-library/react`'s automatic per-test cleanup is NOT auto-wired (it registers via a global `afterEach` that only exists when `globals: true`). Renders therefore leak into `document.body` across `it` blocks, and later `getByText`/`getByTestId` assertions fail with "Found multiple elements". Fix: add `afterEach(cleanup)` explicitly at the top of every RTL `describe` (`import { cleanup } from "@testing-library/react"` + `import { afterEach } from "vitest"`). Symptom to recognise: a test passes in isolation but fails when the whole file runs. Note: not every existing `.test.tsx` has applied this yet (e.g. `ClassComparisonCard.test.tsx` was failing 3 tests both in isolation and in the full suite as of 2026-07-03) — treat such failures as pre-existing, out of scope unless the task is that file.

**Loading-state a11y pattern (Biome-clean, tests find via `getByRole("status")`).** Do NOT put `role="status"` on the `Skeleton` div — Biome's `lint/a11y/useSemanticElements` rejects an explicit `role="status"` on a div (it wants `<output>`). Instead wrap the Skeleton in `<output aria-label="...">` — `<output>` carries an implicit ARIA status role, so `getByRole("status")` still resolves AND Biome passes with no suppression comment. This is the established `OverallPositionHeadline.tsx` pattern; copy it for any loading skeleton a test queries by status role.

**Recharts under jsdom.** `ResponsiveContainer` measures 0×0 so no SVG/paths render — never assert on SVG geometry, `<Line>` elements, or legend labels in `.test.tsx`. Assert only on plain DOM the component always emits (title text, empty-state copy, `role="status"`). Ensure the component does not throw at width 0 (raw Recharts imported the way `AcademicHistoryTab` does is safe).

**Biome a11y gotchas for component JSX (surface at `biome check`, not tsc):** (1) `aria-label` on a plain `<p>`/`<span>` fails `lint/a11y/useAriaPropsSupportedByRole` — those roles don't support an accessible name. Use a semantic element that does (e.g. `<h2>` for a prominent headline) or drop the label. (2) `role="status"` (or other roles with an HTML equivalent) on a `<div>` fails `lint/a11y/useSemanticElements`. Use the native element instead — `<output>` carries an implicit `status` role, so `getByRole("status")` still resolves and Biome is happy without an explicit `role` attribute.

**Gotcha — RTL DOM leaks between tests (globals: false).** Because `globals: false`, RTL's automatic per-test `cleanup()` (which it registers via the *global* `afterEach`) never runs. Symptom: multiple `render()` calls in ONE `.test.tsx` file accumulate in the same jsdom document, so a later test sees a *prior* test's DOM — you get false failures like `getByText` finding "multiple elements", or `queryBy...().not.toBeInTheDocument()` failing on an element the current render never produced. It looks like a component bug but the component is fine (confirm by dumping `container.innerHTML` for the single render in isolation). Fix once, centrally: `vitest.setup.ts` now imports `{ cleanup }` from `@testing-library/react` and `{ afterEach }` from `vitest` and calls `afterEach(() => cleanup())`. Do NOT add per-file cleanup; the shared setup covers every component test. Pre-existing tests didn't catch this only because each of their assertions used text unique across renders.

**Why:** RTL's auto-cleanup ships as a side-effect module that hooks the global `afterEach`; with `globals: false` there is no global `afterEach` to hook, so it silently no-ops.

**How to apply:** when writing multiple `render()`s in one component test file, rely on the shared `afterEach(cleanup)` in `vitest.setup.ts`. If component tests ever start bleeding again, check that this cleanup is still present before suspecting the component.

**Other harness facts:** `globals: false` is deliberate — existing lib tests use explicit `import { describe, it, expect } from "vitest"`, so global injection is unnecessary and off. `environment: "jsdom"` is set globally and all pure-logic tests pass under it unchanged (no `// @vitest-environment node` docblock needed anywhere). The `@` alias is mirrored in `resolve.alias` (`@` -> project root) to match tsconfig `"@/*": ["./*"]`; without it, `@/...` imports fail inside `.test.tsx`. DOM matchers come from `vitest.setup.ts` (`import "@testing-library/jest-dom/vitest"`) which registers with expect even under `globals: false`.
