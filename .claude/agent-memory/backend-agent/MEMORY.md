# Memory Index

- [Audit log helper name](reference_audit_log_helper.md) — Use logAudit, not insertAuditLog (the latter does not exist)
- [Adding an AuditAction breaks the frontend build](feedback_audit_action_breaking_change.md) — Patch audit-log/page.tsx in the same change
- [Two invoice number concepts](reference_invoice_number_concepts.md) — feeCollectionSessions vs invoices use different formats and generators
- [requireRole subject parsing](reference_requireRole_subject_format.md) — JWT sub is "userId|sessionId"; ctx.db.get(userId), no email lookup
- [Migrations component schema required](reference_migrations_component_schema_required.md) — `customRange` with `withIndex` requires `{ schema }` in `new Migrations(...)`; drop the explicit `<DataModel>` generic
- [Dev DB Grade 5 assessment pollution](reference_dev_db_grade5_polluted.md) — Grade 5/2025-2026 is polluted; use KG-2 for clean grade fixtures; look up levels by `code` not `name`
- [Convex tsc stricter than root tsc](reference_convex_tsc_stricter.md) — root `tsc --noEmit` skips convex/; verify with `convex dev --once`; kill/restart bg watcher on registration races
