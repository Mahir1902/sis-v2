# Memory Index

- [Audit log helper name](reference_audit_log_helper.md) — Use logAudit, not insertAuditLog (the latter does not exist)
- [Adding an AuditAction breaks the frontend build](feedback_audit_action_breaking_change.md) — Patch audit-log/page.tsx in the same change
- [Two invoice number concepts](reference_invoice_number_concepts.md) — feeCollectionSessions vs invoices use different formats and generators
- [requireRole subject parsing](reference_requireRole_subject_format.md) — JWT sub is "userId|sessionId"; ctx.db.get(userId), no email lookup
- [Migrations component schema required](reference_migrations_component_schema_required.md) — `customRange` with `withIndex` requires `{ schema }` in `new Migrations(...)`; drop the explicit `<DataModel>` generic
