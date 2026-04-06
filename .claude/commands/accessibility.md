# /accessibility

You are a senior engineer performing a WCAG 2.1 AA accessibility audit and fix pass on the frontend. WCAG 2.1 AA is the internationally recognised accessibility standard (required by law in the EU, UK, US federal, and many other jurisdictions). It covers four principles: Perceivable, Operable, Understandable, and Robust.

Work through every check below, collect all findings, fix every one of them, then commit. Do not ask permission before fixing — these are objective WCAG violations.

---

## WCAG 2.1 AA Reference (what you are enforcing)

### Perceivable
- **1.1.1 Non-text Content (A)**: Every non-text element (icon, image, SVG) must have a text alternative (`aria-label`, `alt`, or `aria-labelledby`). Purely decorative elements must be hidden from assistive technology (`aria-hidden="true"`).
- **1.4.1 Use of Color (A)**: Color must not be the only way information is conveyed.
- **1.4.3 Contrast (AA)**: Text must have at least 4.5:1 contrast against its background (3:1 for large text ≥ 18pt / 14pt bold). Disabled elements are exempt.
- **1.4.4 Resize Text (AA)**: Text must be resizable to 200% without loss of content.
- **1.4.11 Non-text Contrast (AA)**: UI component focus indicators and icons must have at least 3:1 contrast against adjacent colors.

### Operable
- **2.1.1 Keyboard (A)**: All functionality must be operable via keyboard alone.
- **2.1.2 No Keyboard Trap (A)**: Keyboard focus must not become trapped except inside modals (where trapping is correct).
- **2.4.3 Focus Order (A)**: Focus order must be logical and follow visual layout.
- **2.4.7 Focus Visible (AA)**: Keyboard focus indicator must be visible. Never remove the default focus ring unless you provide an equivalent replacement.
- **2.5.3 Label in Name (A)**: The accessible name of an interactive element must contain the visible label text.

### Understandable
- **3.1.1 Language of Page (A)**: The page's primary language must be set (`<html lang="...">`).
- **3.3.1 Error Identification (A)**: If an error is automatically detected, the item in error must be identified and the error described in text.
- **3.3.2 Labels or Instructions (A)**: Every form input must have an associated label.

### Robust
- **4.1.1 Parsing (A)**: HTML must be valid (no duplicate IDs, properly nested elements).
- **4.1.2 Name, Role, Value (A)**: All UI components must have an accessible name, role, and state. Interactive widgets must use correct ARIA roles.
- **4.1.3 Status Messages (AA)**: Status messages (errors, success notices) must be announced to screen readers via `aria-live` regions without receiving focus.

---

## Step 1 — Scope

Scan `frontend/src/` (excluding `node_modules/`, `dist/`, `**/*.test.tsx`, `**/*.test.ts`).

---

## Step 2 — Static Checks

Work through each pattern. Use Grep and Read tools to find violations. Record every finding.

### 2a — Icon-only buttons and SVGs without accessible names

Search for `<button` elements that contain only an `<svg>` child and lack an `aria-label` or `title`.

Search for `<svg` elements that are not hidden (`aria-hidden="true"`) and have no `aria-label`, `role="img"`, or `<title>` child.

**Rule**: Every icon-only interactive element (button/link with only an SVG child and no visible text) MUST have `aria-label` describing its action.

**Rule**: Informational SVGs MUST have `role="img"` + `aria-label`. Decorative SVGs MUST have `aria-hidden="true"`.

### 2b — Inputs without labels

Search for `<input` and `<textarea` elements missing an associated `<label>` or `aria-label`.

**Rule**: Every form control must have an accessible name — either a `<label htmlFor="...">`, an `aria-label`, or `aria-labelledby`.

### 2c — Clickable non-interactive elements

Search for `onClick` handlers on `<div>`, `<span>`, `<li>`, `<p>` or other non-interactive elements.

**Rule**: Interactive elements must use `<button>` (for actions) or `<a>` (for navigation). If you cannot change the element, add `role="button"`, `tabIndex={0}`, and a `onKeyDown` handler that triggers the action on `Enter`/`Space`.

### 2d — Focus indicators removed without replacement

Search for `outline-none` or `outline-0` in className strings. For each occurrence check whether the same element also has `focus:ring-*` or `focus:border-*` or `focus-visible:ring-*` providing a replacement focus indicator.

**Rule**: Never remove the browser default focus indicator (`outline-none`) unless a custom visible focus indicator is provided on the same element.

### 2e — Color contrast

Search for Tailwind text color classes that commonly fail WCAG 4.5:1 contrast on white or light backgrounds:
- `text-gray-300` (contrast ~2.2:1 — FAIL)
- `text-gray-400` (contrast ~4.4:1 — borderline FAIL for normal text; passes only for large text ≥18pt)
- `text-blue-400` on white (~3:1 — FAIL for normal text)
- `text-purple-400` on white (~3.5:1 — FAIL for normal text)

Check whether each usage is on a light background (white, gray-50, gray-100, slate-50) or a dark background. On dark backgrounds (gray-800, gray-900) these are fine.

**Rule**: Replace low-contrast text colors with their darker equivalents. Safe choices on white/light backgrounds: `gray-600` (6:1), `gray-700` (8:1), `gray-800` (10:1).

**Exception**: Disabled UI (e.g. `disabled:opacity-*`) is exempt from contrast rules.

### 2f — Modals and dialogs without ARIA

Search for elements styled as modals (`fixed inset-0`) that lack `role="dialog"` (or `role="alertdialog"` for confirmations) and `aria-modal="true"` and `aria-labelledby`/`aria-label`.

**Rule**: Every modal/dialog must have:
- `role="dialog"` or `role="alertdialog"` on the overlay/container
- `aria-modal="true"`
- `aria-labelledby` pointing to the dialog heading, or `aria-label`
- Focus must move into the dialog on open and return to the trigger on close

For basic React dialogs, at minimum add the ARIA attributes. Full focus trapping requires a `useEffect` that calls `.focus()` on the first focusable element.

### 2g — Status messages not in aria-live regions

Search for inline success/error banners (typically `bg-green-50`, `bg-red-50`) that are conditionally rendered. Check if they are wrapped in an `aria-live` region.

**Rule**: Dynamically injected status messages (success, error, info) that appear without a page navigation MUST be wrapped in an element with `aria-live="polite"` (for non-urgent) or `aria-live="assertive"` (for errors). This announces the message to screen reader users.

### 2h — Language attribute

Check `frontend/index.html` for `<html lang="en">` (or appropriate language code).

**Rule**: The root `<html>` element must have a `lang` attribute.

### 2i — Skip navigation link

Check whether there is a "Skip to main content" anchor as the first focusable element on the page.

**Rule**: Pages with navigation that repeats across views should have a skip link. This is particularly important if the app has a persistent header. If the app is a single-page dashboard with no persistent nav, this is N/A.

---

## Step 3 — Compile findings

Before making any changes, output a findings table:

```
## Accessibility Findings (WCAG 2.1 AA)

| # | File | Line | WCAG | Severity | Description |
|---|------|------|------|----------|-------------|
| 1 | ... | ... | 1.1.1 | critical | Icon-only button missing aria-label |
...

**Total findings: N**
```

Severity:
- **critical** — direct WCAG A/AA violation, screen reader user cannot use the feature
- **major** — WCAG A/AA violation but partial workaround exists
- **minor** — best-practice gap, degrades experience but not a hard blocker

---

## Step 4 — Fix all findings

Work through every finding. For each:

1. Read the file if not already read.
2. Apply the minimal correct fix:
   - **Icon-only button missing aria-label**: Add `aria-label="[action description]"` to the `<button>`. Add `aria-hidden="true"` to the inner `<svg>`.
   - **Decorative SVG not hidden**: Add `aria-hidden="true"` to the `<svg>`.
   - **Informational SVG without label**: Add `role="img"` and `aria-label="..."` to the `<svg>`.
   - **Input missing label**: Add `aria-label="[field description]"` to the `<input>` or `<textarea>`.
   - **onClick on div**: Wrap content in `<button>` with appropriate styling, or add `role="button"`, `tabIndex={0}`, and `onKeyDown`.
   - **outline-none without replacement**: Add `focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1` (or equivalent) alongside the `outline-none`.
   - **Low contrast text**: Replace the Tailwind class with a higher-contrast equivalent.
   - **Modal without ARIA**: Add `role="dialog"` (or `role="alertdialog"`), `aria-modal="true"`, and `aria-labelledby` or `aria-label` pointing to the dialog title. Move focus to the first interactive element on open.
   - **Status message not announced**: Wrap the containing `<div>` in (or replace it with) an element with `aria-live="polite"` for success messages, `aria-live="assertive"` for errors.
   - **Missing lang**: Add `lang="en"` to `<html>` in `index.html`.

3. Do not restructure surrounding code. Apply the minimal targeted change.
4. After each fix, note the change in the fix log.

---

## Step 5 — Verify

1. `cd frontend && npm run build` — TypeScript must compile cleanly; fix any type errors introduced.
2. `cd frontend && npx vitest run` — all tests must pass.
3. Do a final grep to confirm none of the critical patterns remain:
   - No icon-only buttons without `aria-label`
   - No `outline-none` without a replacement focus indicator
   - No `text-gray-300` or `text-gray-400` on light backgrounds

---

## Step 6 — Commit

```
git add -A
git commit -m "fix(a11y): WCAG 2.1 AA accessibility pass — <summary>

<bullet list of key fixes>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push
```

The commit message must name the specific fixes: e.g. `add aria-labels to 8 icon buttons, fix contrast on gray-300 text, add aria-live to status banners` — not just `accessibility fixes`.

---

## Step 7 — Report

```
## Accessibility Pass Complete

| Category | Findings | Fixed |
|----------|----------|-------|
| Icon/SVG labels (1.1.1) | N | N |
| Input labels (3.3.2) | N | N |
| Clickable non-interactive elements (2.1.1 / 4.1.2) | N | N |
| Focus indicators (2.4.7) | N | N |
| Color contrast (1.4.3) | N | N |
| Modal/dialog ARIA (4.1.2) | N | N |
| Status messages (4.1.3) | N | N |
| Language attribute (3.1.1) | N | N |
| **Total** | **N** | **N** |

### Key changes
- <file>: <what changed>
- ...

Build: ✅ | Tests: N passing
```
