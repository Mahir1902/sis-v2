# Bulk Student Promotion

## Context

SIS v2 has no way to advance students to the next grade level at year-end. This is a core operational workflow for any school. Admins currently have to manually create new enrollments and close old ones per student, which is impractical for 100+ students.

This feature adds a dedicated promotion page where admins can select a grade level, review all eligible students, mark each as promote/hold-back/graduate, and confirm the batch in one action. Fees for the new level are auto-assigned.

## Requirements

- **Bulk promotion**: Select source year + target year + grade level, review all active students, confirm batch
- **Admin decision only**: No automatic grade-based logic. Admin manually decides promote vs hold back
- **Auto-assign fees**: Automatically create fee records for the new level's fee structures on promotion
- **Grade 12 handling**: Students in Grade 12 can only graduate or be held back (no next level)
- **Audit trail**: Enrollment chain via `previousEnrollmentId` serves as implicit promotion history

## Data Model

No new tables. Existing schema supports everything:

| Existing Structure | Role in Promotion |
|---|---|
| `standardLevels.nextLevelId` | Defines promotion chain (PG -> NUR -> ... -> 12). Grade 12 has `nextLevelId: undefined` = graduation |
| `enrollments.previousEnrollmentId` | Links new enrollment to old one |
| `enrollments.status` + `exitReason` | Old enrollment marked "completed" with exitReason "promotion" or "graduated" |
| `feeStructure` (by_standard index) | Lookup fee structures for target level |
| `studentFees` | Auto-created per student for each fee structure |
| `students.standardLevel` | Updated to new level name on promotion |

## Backend — `convex/promotions.ts`

### `getPromotionCandidates` (query)

**Args:** `standardLevelId`, `academicYearId`

**Returns:** Array of active enrollments enriched with:
- Student name, number, photo
- Current level name + code
- Next level name + code (resolved via `nextLevelId`)
- `isGraduationCandidate: boolean` (true if current level has no `nextLevelId`)
- `alreadyPromoted: boolean` (true if student has enrollment in any later academic year)

**Implementation:**
1. `requireRole(ctx, ["admin"])`
2. Query enrollments by `by_standard_level` index, filter by academic year + status "active"
3. Batch resolve students + next level via `Promise.all()`
4. Check for existing enrollments in target year to detect already-promoted students

### `bulkPromote` (mutation)

**Args:**
- `sourceAcademicYearId: v.id("academicYears")`
- `targetAcademicYearId: v.id("academicYears")`
- `standardLevelId: v.id("standardLevels")`
- `promotions: v.array(v.object({ studentId: v.id("students"), enrollmentId: v.id("enrollments"), action: v.union(v.literal("promote"), v.literal("hold_back"), v.literal("graduate")) }))`
- `autoAssignFees: v.boolean()`

**For each student based on action:**

**promote:**
1. Close old enrollment: `status: "completed"`, `exitDate: Date.now()`, `exitReason: "promotion"`
2. Resolve `nextLevelId` from current `standardLevels` record
3. Create new enrollment: `standardLevelId: nextLevelId`, `academicYear: targetAcademicYearId`, `enrollmentType: "promotion"`, `previousEnrollmentId: oldEnrollmentId`, `status: "active"`, `enrollmentDate: Date.now()`, `campus: same as old`
4. Patch student: `standardLevel: nextLevel.name`

**graduate:**
1. Close enrollment: `exitReason: "graduated"`, `exitDate: Date.now()`, `status: "completed"`
2. Patch student: `status: "graduated"`

**hold_back:**
1. Close old enrollment: `exitReason: "hold_back"`, `exitDate: Date.now()`, `status: "completed"`
2. Create new enrollment in **same** `standardLevelId` + target year, `enrollmentType: "repeat"`, `previousEnrollmentId: oldEnrollmentId`

**Fee auto-assignment (if `autoAssignFees`):**
- For each promoted/held-back student, query `feeStructure` by target level (`by_standard` index), filter `isActive`
- Create `studentFees` record for each: `originalAmount: baseAmount`, `balance: baseAmount`, `paidAmount: 0`, `status: "unpaid"`

**Returns:** `{ promoted: number, graduated: number, heldBack: number, feesAssigned: number }`

**Validation:**
- `requireRole(ctx, ["admin"])` — admin only
- Verify source and target academic years exist
- Verify all enrollment IDs belong to the specified level + year
- Verify target year is different from source year
- Skip students flagged as already promoted (with warning count in return)

## Frontend — `/admin/promotions`

### Route

`app/(dashboard)/admin/promotions/page.tsx` — "use client", admin-only via RoleGate

### Sidebar

Add "Promotions" nav item under Administration section in `Sidebar.tsx`:
- Icon: `ArrowUpCircle` (from lucide-react)
- Route: `/admin/promotions`
- Admin only

### Page Layout

```
Student Promotion

[Source Year v]  [Target Year v]  [Grade Level v]  [Load Students]

+---------+------------------+---------------+-----------+--------+
| #       | Student          | Current Level | Next Level| Action |
+---------+------------------+---------------+-----------+--------+
| 1       | Ahmed Rahman     | Grade 5       | Grade 6   | [Promote v] |
| 2       | Fatima Khan      | Grade 5       | Grade 6   | [Promote v] |
| 3       | Rahul Das        | Grade 5       | Grade 6   | [Hold Back v] |
+---------+------------------+---------------+-----------+--------+

Summary: 28 promote / 2 hold back / 0 graduate
[x] Auto-assign fees for new level

                                          [Confirm Promotion]
```

### Components

**PromotionFilters** — Three shadcn Select dropdowns:
- Source academic year (populated from `academicYears.list`)
- Target academic year (populated from `academicYears.list`, excludes source)
- Grade level (populated from `standardLevels.list`)

**PromotionTable** — shadcn Table (not TanStack DataTable — no pagination/search needed since it's a single class):
- Columns: #, Student (name + number), Current Level, Next Level, Action
- Action column: shadcn Select with options "Promote" / "Hold Back" (+ "Graduate" for Grade 12)
- Default action: "Promote" for all (except Grade 12 which defaults to "Graduate")
- Already-promoted students shown with a warning badge and disabled action

**PromotionSummary** — Live counts computed from current action selections. Three badges: promote (green), hold back (yellow), graduate (purple)

**ConfirmPromotionDialog** — shadcn AlertDialog:
- Shows final counts
- Checkbox: "Auto-assign fees for new academic year"
- Warning if no fee structures exist for target level
- Confirm / Cancel buttons
- Loading state during mutation

### States

- **Loading**: Skeleton table while `getPromotionCandidates` loads
- **Empty**: "No active students in Grade X for 2024-2025" with suggestion to check filters
- **No target year**: "Create a new academic year first" with link to settings
- **Success**: Sonner toast "28 students promoted, 2 held back, 3 graduated. 93 fee records created." + reset filters
- **Error**: Sonner error toast with message

## Edge Cases

1. **Grade 12 students**: Action dropdown shows only "Graduate" or "Hold Back". No promote option.
2. **Already promoted**: If student has an enrollment in the target year, show warning badge, disable action. Include count in return value.
3. **No target year exists**: Show message to create it first. Disable confirm button.
4. **Fee structures missing**: Promotion works, fee assignment skipped with warning toast: "No fee structures found for Grade 6. Fees not assigned."
5. **Partial failure**: Convex mutations are atomic — if any operation fails, the entire batch rolls back. User retries.
6. **Double-click prevention**: Disable confirm button during mutation. Use `useConvexMutation` loading state.

## Verification

1. `npm run build` passes
2. `npm run lint` passes (Biome)
3. Manual test flow:
   - Select source year + target year + grade level
   - Verify student list loads correctly
   - Toggle some students to "Hold Back"
   - Confirm promotion
   - Check student detail page: new enrollment appears in Academic History tab
   - Check Fees tab: new fee records appear
   - Check old enrollment: status "completed", exitReason "promotion"
   - Check graduated student: status "graduated"
4. Edge case tests:
   - Try Grade 12 — verify only Graduate/Hold Back options
   - Try with no fee structures — verify warning
   - Try promoting already-promoted students — verify warning badge
