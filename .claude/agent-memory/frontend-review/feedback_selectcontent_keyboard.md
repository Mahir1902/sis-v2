---
name: SelectContent custom button keyboard accessibility
description: When a non-SelectItem div with role="button" is placed inside SelectContent, it requires tabIndex="0" and onKeyDown for keyboard users
type: feedback
---

Custom action divs inside shadcn SelectContent (e.g. "+ New Academic Year") should use `onMouseDown` + `e.preventDefault()` to avoid closing the select — this is the approved pointer pattern. However, they also need `tabIndex="0"` and an `onKeyDown` handler for Enter/Space to be fully keyboard-accessible.

**Why:** The div with `role="button"` is not natively focusable, so keyboard users cannot tab to it or activate it without these additions. Found in `promotions/page.tsx` at line 313-324.

**How to apply:** Flag this as a non-blocking suggestion in reviews (shadcn Select manages focus internally and the fix is low risk), but note it for future improvement. If the feature involves a sensitive workflow, escalate to required.
