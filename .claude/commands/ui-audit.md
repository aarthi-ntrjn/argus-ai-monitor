---
description: Audit the frontend for inline UI controls that should use shared components, fix every finding, and commit.
---

## User Input

```text
$ARGUMENTS
```

If `$ARGUMENTS` is non-empty, treat it as a scope override (e.g. `frontend/src/components`). Otherwise scan all of `frontend/src/`.

## Outline

You are auditing the Argus frontend for places where interactive controls are implemented inline instead of reusing shared components. Work through each step below, collect all findings, fix every one, then commit.

---

### Step 1 — Read shared component APIs

Before scanning, read each shared component so you know exactly what props and variants it supports. Read all of:

- `frontend/src/components/Button.tsx`
- `frontend/src/components/Badge.tsx`
- `frontend/src/components/Checkbox.tsx`
- `frontend/src/components/ToggleIconButton.tsx`
- `frontend/src/index.css` (for the `.interactive-card` and `.icon-btn` CSS component classes)

Record each component's props and variants. You will need this to write correct replacements.

---

### Step 2 — Establish scope

Scan all `.tsx` files under the scope directory. Exclude:

- `**/*.test.tsx`, `**/*.spec.tsx` — test files
- `**/dist/`, `**/node_modules/` — build output

---

### Step 3 — Scan for violations

For each file in scope, read it fully and check for the following patterns. Record every violation with file path, line number, current code, and the correct replacement.

#### 3a — Raw `<button>` that should use `Button`

Flag any `<button>` element that:
- Has a visible text label (not just an icon)
- Uses Tailwind classes that replicate `Button` variants (e.g. `bg-blue-600`, `border border-gray-300`, `text-gray-600 hover:text-gray-800`)
- Is NOT already using `icon-btn` (icon-only buttons are exempt)

Do NOT flag: icon-only buttons, buttons that already import and use `Button`.

#### 3b — Inline badge spans that should use `Badge`

Flag any `<span>` that:
- Has all of these Tailwind classes (in any order): `text-xs`, `px-2`, `py-0.5`, `rounded`, `font-medium`
- OR has `px-1.5`, `py-0.5`, `rounded`, `font-medium`, `text-xs` (the sm variant)
- Is NOT already using the `Badge` component

Note the `px-1.5` variant — `Badge` may need a `size="sm"` prop added if it does not already support it. Check the Badge API first.

#### 3c — Raw checkboxes that should use `Checkbox`

Flag any:
- `<input type="checkbox">` — unless it is inside the `Checkbox` component itself
- `<button role="checkbox">` — unless it is inside the `Checkbox` component itself

Do NOT flag the `Checkbox` component's own implementation.

#### 3d — Icon-only buttons missing `icon-btn`

Flag any `<button>` or `<Link>` that:
- Renders only an SVG icon or a single Unicode character (×, ✕, etc.) with no text label
- Does NOT have `icon-btn` in its className

Exempt: buttons that already have `icon-btn`, `ToggleIconButton` usages.

#### 3e — Clickable cards missing `interactive-card`

Flag any `<div>` that:
- Has `role="button"` or `tabIndex={0}` with an `onClick`
- Has `border`, `rounded`, `cursor-pointer` classes
- Does NOT have `interactive-card` in its className

#### 3f — Inline toggle icon buttons that should use `ToggleIconButton`

Flag any `<button>` that:
- Renders only an SVG icon
- Has both an active and inactive color variant based on a boolean state (e.g. `pressed ? 'text-blue-600' : 'text-gray-500'`)
- Is NOT already using `ToggleIconButton`

---

### Step 4 — Compile findings

Before making any changes, output a findings table:

```
## UI Audit Findings

### 3a: Raw buttons that should use Button
| # | File | Line | Description |
|---|------|------|-------------|
...

### 3b: Inline badge spans that should use Badge
| # | File | Line | Description |
|---|------|------|-------------|
...

### 3c: Raw checkboxes that should use Checkbox
| # | File | Line | Description |
|---|------|------|-------------|
...

### 3d: Icon buttons missing icon-btn
| # | File | Line | Description |
|---|------|------|-------------|
...

### 3e: Clickable cards missing interactive-card
| # | File | Line | Description |
|---|------|------|-------------|
...

### 3f: Inline toggle icon buttons that should use ToggleIconButton
| # | File | Line | Description |
|---|------|------|-------------|
...

**Total findings: N**
```

If a category has zero findings, write "None found."

---

### Step 5 — Fix all findings

Work through every finding. For each fix:

1. Read the file if not already read in full.
2. Apply the minimal correct replacement:
   - **3a (Button)**: Replace the raw `<button>` with `<Button variant="..." size="...">`. Add the import if missing.
   - **3b (Badge)**: Replace the inline `<span>` with `<Badge colorClass="..." icon={...}>`. Add the import if missing. If the badge uses `px-1.5` and Badge does not support a size prop, add a `size` prop to Badge first, then use it.
   - **3c (Checkbox)**: Replace the raw element with `<Checkbox checked={...} onChange={...} aria-label="...">`. Add the import if missing.
   - **3d (icon-btn)**: Add `icon-btn` to the className. Remove any now-redundant inline `rounded-sm`, `transition-colors`, `focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400` classes.
   - **3e (interactive-card)**: Add `interactive-card` to the className. Remove any now-redundant inline `border`, `rounded-md`, `transition-colors`, `cursor-pointer`, `focus-visible:ring-blue-400` classes that are covered by the CSS class.
   - **3f (ToggleIconButton)**: Replace the raw `<button>` with `<ToggleIconButton pressed={...} onToggle={...} label="...">`. Add the import if missing.
3. Do not change behaviour, layout, or colour choices — only replace the structural implementation.

---

### Step 6 — Verify

Run the build to confirm no type errors were introduced:

```
npm run build --workspace=frontend
```

If the build fails, diagnose and fix before proceeding. Do not commit broken code.

---

### Step 7 — Commit

Stage all changed files and commit:

```
git add <files>
git commit -m "refactor(ui): ui-audit pass — replace inline controls with shared components

<bullet list of significant replacements>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push
```

---

### Step 8 — Report

Output a final summary:

```
## UI Audit Complete

| Category | Findings | Fixed |
|----------|----------|-------|
| Raw buttons → Button | N | N |
| Inline badge spans → Badge | N | N |
| Raw checkboxes → Checkbox | N | N |
| Icon buttons → icon-btn | N | N |
| Clickable cards → interactive-card | N | N |
| Inline toggles → ToggleIconButton | N | N |
| **Total** | **N** | **N** |

### Changes made
- <file>: <what changed>
- ...
```
