# Sidebar Sign-Out Button — Design Spec

**Date:** 2026-04-13
**Status:** Approved

## Problem

The dashboard sidebar has no sign-out button. Users cannot end their session from within the app, which also blocks the manual data-repair step needed after a Convex users-table reset (sign out → sign back in to re-create the user record).

## Design

Add a pinned footer section to the bottom of the sidebar containing the current user's email and a sign-out button.

### Layout

**Expanded sidebar:**
```
┌─────────────────────────┐
│ SIS v2              ‹   │
├─────────────────────────┤
│  nav items...           │
│                         │
├─────────────────────────┤
│ admin@school.edu  [→|]  │
└─────────────────────────┘
```

**Collapsed sidebar:**
```
┌────┐
│ ‹  │
├────┤
│ …  │
├────┤
│[→|]│
└────┘
```

## Files Changed

### `components/layout/DashboardWrapper.tsx`
- Pass `email={me?.email}` to `<Sidebar>` — reuses the existing `getMe` query, no additional subscriptions.

### `components/layout/Sidebar.tsx`
- Add `email?: string` to `SidebarProps`
- Import `LogOut` from `lucide-react`
- Import `useAuthActions` from `@convex-dev/auth/react`
- Import `useRouter` from `next/navigation`
- Sign-out handler: `await signOut()` → `router.replace("/login")`
- Footer renders below `</nav>`, pinned to bottom with `mt-auto`:
  - Top border separator
  - Expanded: truncated email + `LogOut` icon button (`aria-label="Sign out"`)
  - Collapsed: centered `LogOut` icon button only

## Constraints
- No new Convex queries — email comes from existing `getMe` prop
- Tailwind classes only, no hardcoded hex
- Button must have `aria-label`
- Sign-out must redirect to `/login` after completion
