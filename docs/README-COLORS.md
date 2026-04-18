# Argus Color Palette

This document lists every color token used in the Argus app (frontend Tailwind classes) and their corresponding CSS variable in the landing page (`landing/assets/css/styles.css`).

## Primary Palette

| Token | Tailwind class | Hex | Usage |
|---|---|---|---|
| Page background | `bg-slate-50` | `#f8fafc` | `--color-bg` — main page background |
| Surface | `bg-white` | `#ffffff` | `--color-surface` — cards, nav, panels |
| Surface muted | `bg-gray-100` | `#f3f4f6` | `--color-surface-muted` — hover backgrounds, skeletons |

## Accent (Blue)

The app's primary interactive color is **blue** from the Tailwind default scale.

| Token | Tailwind class | Hex | Usage |
|---|---|---|---|
| Primary button bg | `bg-blue-500` | `#3b82f6` | `--color-accent` — buttons, active links |
| Primary button hover | `bg-blue-700` | `#1d4ed8` | `--color-accent-hover` — button hover |
| Selected card bg | `bg-blue-50` | `#eff6ff` | `--color-accent-light` — selected state fill |
| Focus ring | `ring-blue-400` | `#60a5fa` | `--color-accent-focus` — keyboard focus ring |
| Link hover / ghost text | `text-blue-700` | `#1d4ed8` | `--color-text-link` — hover text on links |
| Icon hover | `text-blue-600` | `#2563eb` | Inline icon actions |
| Dark badge text | `text-blue-800` | `#1e40af` | "waiting" status badge |
| Light badge bg | `bg-blue-100` | `#dbeafe` | "waiting" status badge bg |

## Text

| Token | Tailwind class | Hex | Usage |
|---|---|---|---|
| Primary | `text-gray-900` | `#111827` | `--color-text` — headings |
| Secondary | `text-gray-800` | `#1f2937` | `--color-text-secondary` — body text |
| Muted | `text-gray-500` | `#6b7280` | `--color-text-muted` — secondary text, meta |
| Secondary body | `text-gray-600` | `#4b5563` | Inline descriptive text |
| Button muted | `text-gray-700` | `#374151` | Dropdown labels |

## Borders

| Token | Tailwind class | Hex | Usage |
|---|---|---|---|
| Default | `border-gray-200` | `#e5e7eb` | `--color-border` — card borders |
| Outline button | `border-gray-300` | `#d1d5db` | `--color-border-muted` — outline button |
| Hover card | `border-neutral-400` | `#a3a3a3` | Card hover border (not in landing) |
| Selected / focus | `border-blue-500` | `#3b82f6` | Selected card, button focus border |

## Dark / Terminal

| Token | Tailwind class | Hex | Usage |
|---|---|---|---|
| Session output bg | `bg-gray-900` | `#111827` | `--color-code-bg` — terminal output panel |
| Output text | `text-gray-300` | `#d1d5db` | `--color-code-text` — text in dark output area |

## Status Badge Colors

| Status | Background | Text |
|---|---|---|
| active / running | `bg-green-100` `#dcfce7` | `text-green-800` `#166534` |
| idle | `bg-yellow-100` `#fef9c3` | `text-yellow-800` `#854d0e` |
| waiting | `bg-blue-100` `#dbeafe` | `text-blue-800` `#1e40af` |
| error | `bg-red-100` `#fee2e2` | `text-red-800` `#991b1b` |
| completed | `bg-gray-100` `#f3f4f6` | `text-gray-800` `#1f2937` |
| ended | `bg-gray-100` `#f3f4f6` | `text-gray-500` `#6b7280` |
| resting | `bg-amber-100` `#fef3c7` | `text-amber-700` `#b45309` |
| yolo | `bg-red-100` `#fee2e2` | `text-red-700` `#b91c1c` |

## Session Type Badge Colors

| Session type | Background | Text |
|---|---|---|
| copilot-cli | `bg-purple-100` `#f3e8ff` | `text-purple-800` `#3b0764` |
| claude-code | `bg-orange-100` `#ffedd5` | `text-orange-800` `#7c2d12` |

## Semantic / Action Colors

| Purpose | Tailwind class | Hex | Usage |
|---|---|---|---|
| Success text | `text-green-600` | `#16a34a` | "Added" confirmation |
| Error text | `text-red-700` | `#b91c1c` | Error messages |
| Error bg | `bg-red-50` | `#fef2f2` | Error banner |
| Error border | `border-red-200` | `#fecaca` | Error banner border |
| Danger button | `bg-red-600` | `#dc2626` | Kill/delete actions |
| Danger button hover | `bg-red-700` | `#b91c1c` | Kill/delete hover |
| Attention label | `text-red-600` | `#dc2626` | "ATTENTION NEEDED" inline |

## Landing Page CSS Variables

The landing page maps directly to the above values via CSS custom properties:

```css
--color-bg: #f8fafc;           /* slate-50 */
--color-surface: #ffffff;      /* white */
--color-surface-muted: #f3f4f6; /* gray-100 */
--color-border: #e5e7eb;       /* gray-200 */
--color-border-muted: #d1d5db; /* gray-300 */
--color-accent: #3b82f6;       /* blue-500 */
--color-accent-hover: #1d4ed8; /* blue-700 */
--color-accent-light: #eff6ff; /* blue-50 */
--color-accent-focus: #60a5fa; /* blue-400 */
--color-text: #111827;         /* gray-900 */
--color-text-secondary: #1f2937; /* gray-800 */
--color-text-muted: #6b7280;   /* gray-500 */
--color-text-link: #1d4ed8;    /* blue-700 */
--color-code-bg: #111827;      /* gray-900 */
--color-code-text: #d1d5db;    /* gray-300 */
```
