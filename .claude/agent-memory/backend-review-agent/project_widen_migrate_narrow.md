---
name: project_widen_migrate_narrow
description: Pattern for schema migrations on this codebase — widen union, run migrate, narrow union, preserve recipe in comments.
metadata:
  type: project
---

When schema unions need renaming/adding required fields, this project follows the `@convex-dev/migrations` widen → migrate → narrow workflow. After the migration ran successfully, the migration code is **deleted from the file** but the full re-run recipe is preserved in a long comment block so production operators can re-execute without git archaeology.

**Why:** Code that references narrowed-out literals (e.g. `"sent"`) becomes untypeable once the schema narrows, so the migration source can't survive in callable form. The comment-preserved recipe is the project's chosen substitute.

**How to apply:** When reviewing a migration removal, do NOT flag the deletion as a regression. Verify (a) the preserved comment block faithfully reproduces the original `customRange` + `migrateOne`, (b) it documents the deploy order (widen → deploy → run → narrow → deploy), and (c) it warns about Convex's schema-validation fail-safe between widen and narrow.

Related: [[project_invoice_status]]

**Two platform facts that recur in rollout runbooks (verified 2026-11-10, candidate 4 review):**
- Dropping a *table* from `schema.ts` is NOT a fail-safe: Convex only validates tables listed in the schema (see `schemaValidation`/`strictTableNameTypes` docs in `convex/server/schema.d.ts`), so leftover rows are silently orphaned. Only removing a *field* (or narrowing a validator) fails the push. Reject runbooks that cite a table drop as a backstop.
- `@convex-dev/migrations` runner (0.3.x) no-ops a migration already marked done, including each step of a series. "Fix by hand, then run again" needs `'{"reset":true}'`.
