---
name: Zod schemas must be in lib/validations/, not in component files
description: CLAUDE.md and the review checklist require all Zod schemas to be defined in lib/validations/ (one file per domain), not inline in component files. The Frontend Agent has defined them in component files in FS-6 and FS-7.
type: feedback
---

Zod schemas and their inferred types must be defined in `lib/validations/` — one file per domain — not inside the component file where they are used.

**Why:** CLAUDE.md checklist item: "Zod schemas are defined in `lib/validations/` not inline in components." The `createFeeSchema` and `editFeeSchema` were found inside `_components/CreateFeeDialog.tsx` and `_components/EditFeeDialog.tsx` respectively, instead of being exported from `lib/validations/feesSchema.ts`.

**How to apply:** Any time a Zod `z.object(...)` call appears inside a `_components/` file or a page file, flag it as a required fix. The schema should be moved to the appropriate `lib/validations/` file and imported. For fees, the file is `lib/validations/feesSchema.ts`. Add a new file if the domain doesn't have one yet.
