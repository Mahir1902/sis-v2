# Devil's Advocate Agent Memory Index

- [User Profile](user_profile.md) — SIS v2 developer building a school management system; adversarial review context
- [Schema Gotchas](project_schema_gotchas.md) — Confirmed schema vulnerabilities and data model risks in SIS v2
- [Query Performance Risks](project_query_performance.md) — Known Convex query performance pitfalls in this codebase
- [Auth Patterns and Logout Vulnerability](project_auth_patterns.md) — Hard-confirmed auth edge cases: redirect loop risk, retry mechanism conflicts, isAuthenticated skip pattern, cached me staleness
- [Grade Computation Pitfalls](project_grade_computation.md) — ADR-0004 Phase A: db.replace vs db.patch trap, expectedCaCount staleness, migration batch-size ceiling, zero-question division guard
- [Cohort Page Risks](project_cohort_page_risks.md) — Phase D.1 DA findings: semester divergence footgun, 4 empty states, needs-help dedup, provisional labeling, route name locked as /admin/class-analytics
