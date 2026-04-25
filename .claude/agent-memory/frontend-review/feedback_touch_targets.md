---
name: Touch target sizes in Sidebar
description: Sidebar toggle and sign-out buttons are below the 44px minimum touch target — flag in future sidebar changes
type: feedback
---

Sidebar toggle button uses `p-1` (approx 24px hit area) and sign-out button uses `p-1.5` (approx 28px). Both fall below the WCAG 44x44px minimum touch target.

**Why:** Previously flagged in Frontend Review (Sign-out button, 2026-04-13) as a non-blocking suggestion. Has not been addressed.

**How to apply:** Any future PR touching Sidebar.tsx or SidebarItem.tsx should include upgrading both to `shadcn Button variant="ghost" size="icon"` (h-9 w-9) to meet the 44px minimum. Flag as 🟡 SUGGESTED in review if still not addressed.
