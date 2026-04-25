# Academic Year Creation (from Promotions Page)

## Context

The Bulk Student Promotion feature requires a "target academic year" to exist before students can be promoted into it. Currently, academic years can only be created via seed data or a bare `create` mutation with no UI. Admins have no way to create a new academic year from the application.

Since the only time an admin _needs_ a new year is when preparing for promotions, the creation flow lives directly on the Promotions page rather than a separate page.

## Requirements

- Admin can create a new academic year from the Promotions page without navigating away
- Two entry points: a "+ New Academic Year" option inside the Target Year dropdown, and a message when no valid target year exists
- After creation, the new year is auto-selected as the target
- Backend validates: name uniqueness, startDate < endDate
- Year name auto-suggested from the source year (e.g., source "2025-2026" suggests "2026-2027")

## Data Model

No schema changes. Uses the existing `academicYears` table:

```
academicYears: { name: string, startDate: float64, endDate: float64 }
```

## Backend — `convex/academicYears.ts`

### Update `create` mutation

Add validation to the existing `create` mutation:

1. **Name uniqueness**: Query all academic years, check no existing year has the same `name`. Throw `"An academic year with this name already exists"` if duplicate.
2. **Date order**: Verify `startDate < endDate`. Throw `"Start date must be before end date"`.
3. Return the inserted ID (already does this).

No new functions needed. The existing `list` query already returns all years.

## Frontend — Promotions Page Modifications

### New State
- `createYearOpen: boolean` — controls the Dialog visibility

### New Mutation
- `const createYear = useMutation(api.academicYears.create)`

### Entry Point 1: Inside Target Year SelectContent

After the existing year items, add a separator and a button-styled item:

```
──────────────
+ New Academic Year
```

Clicking it opens the create dialog (sets `createYearOpen = true`). This is NOT a `SelectItem` (selecting it shouldn't change the dropdown value). Use a `div` with `onClick` inside `SelectContent`, styled like a clickable item with a Plus icon.

### Entry Point 2: No-target-year state

Currently the target dropdown is just disabled when only 1 year exists. Add a helper message below the filter bar when `years?.length <= 1` or when no years exist besides the source:

```
No target year available. Create a new academic year to start promotions.
[+ Create Academic Year]
```

The button opens the same dialog.

### CreateAcademicYearDialog

A shadcn `Dialog` with a simple form (no React Hook Form needed for 3 fields — but use it for consistency with the codebase):

**Fields:**
- **Name** (text input): Auto-suggested. If source year is "2025-2026", pre-fill with "2026-2027" by parsing the pattern `YYYY-YYYY` and incrementing both years. If parsing fails, leave empty.
- **Start Date** (date input): Auto-suggested as June 1 of the target start year (matching seed data pattern). Input type="date".
- **End Date** (date input): Auto-suggested as July 31 of the target end year. Input type="date".

**Validation (Zod):**
- Name: required, non-empty string
- Start date: required
- End date: required, must be after start date

**Submit handler:**
1. Call `createYear({ name, startDate: new Date(startDate).getTime(), endDate: new Date(endDate).getTime() })`
2. On success: toast "Academic year [name] created", auto-select new year ID as `selectedTargetYearId`, close dialog
3. On error: toast error message (catches duplicate name from backend)

### Auto-suggestion Logic

```ts
function suggestNextYear(sourceYearName: string) {
  const match = sourceYearName.match(/^(\d{4})-(\d{4})$/);
  if (!match) return { name: "", startDate: "", endDate: "" };
  const startYear = Number(match[2]);  // e.g., 2026
  const endYear = startYear + 1;       // e.g., 2027
  return {
    name: `${startYear}-${endYear}`,
    startDate: `${startYear}-06-01`,   // June 1
    endDate: `${endYear}-07-31`,       // July 31
  };
}
```

## Edge Cases

1. **Duplicate name**: Backend rejects, frontend shows toast error
2. **No source year selected**: The "+ New Academic Year" button in the dropdown still works, but no auto-suggestion (fields are empty)
3. **Date parsing**: Using `input type="date"` + converting to Unix ms via `new Date(value).getTime()` — no timezone issues since we only care about the date, not time
4. **Convex reactivity**: After `createYear` resolves, the `useQuery(api.academicYears.list)` automatically updates (Convex reactive query), so the new year appears in the dropdown immediately

## Verification

1. `npm run build` passes
2. `npm run lint` passes (Biome check on modified files)
3. Manual test:
   - Open Promotions page, click Target Year dropdown, see "+ New Academic Year" option
   - Click it, verify dialog opens with auto-suggested name/dates based on source year
   - Submit, verify year appears in dropdown and is auto-selected
   - Try creating duplicate name — verify error toast
   - Try with start date > end date — verify validation error
   - When only 1 academic year exists, verify helper message appears below filters
