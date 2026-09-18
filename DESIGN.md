---
name: Veritax
description: Provenance-aware company data for transfer-pricing work.
colors:
  ink: "#0d0d0d"
  canvas: "#fcfcfc"
  surface: "#ffffff"
  muted: "#5d5d5d"
  hairline: "#dfdfdf"
  focus: "#0169cc"
  night: "#141414"
  display-on-night: "#e4d5c4"
  danger: "#e02e2a"
  warning: "#e25507"
typography:
  display:
    fontFamily: "Newsreader, Iowan Old Style, Palatino, Georgia, serif"
    fontSize: "2rem"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Newsreader, Iowan Old Style, Palatino, Georgia, serif"
    fontSize: "1.5rem"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Newsreader, Iowan Old Style, Palatino, Georgia, serif"
    fontSize: "1.25rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "0"
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.02em"
rounded:
  none: "0px"
  sm: "2px"
  md: "4px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "#212121"
    textColor: "{colors.surface}"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
    height: "32px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "8px 10px"
    height: "36px"
---

# Design System: Veritax

## 1. Overview

**Sourced ledger.** Roman names the company. Mono carries the facts.

The two reference frames (timetheory, artinstitute) are the type idea. Veritax takes that pairing into the product: **search is a ledger** in night or day. Practitioners screen the public universe in Newsreader names and IBM Plex Mono facts. A company record opens inverted (night field, cream type), then the ledgers return to daylight. Local File stays light. That is desk work after the name is found.

Newsreader is a sharp old-style roman with a real italic and optical sizes, so a 32px company name still has serifs instead of hairline collapse. IBM Plex Mono is a text mono, not an IDE face: tabular figures, readable at 12–14px, built for ledgers.

Display type never appears in chrome. Sidebar, buttons, filters, table cells, captions, and helper copy are mono. Roman is for page titles, company legal names, empty-state headings, and the wordmark.

## 2. Colors

Light product for records and workflow. Near-black ink on `#fcfcfc` canvas, white work surface, `#dfdfdf` hairlines. Secondary text `#5d5d5d` (this is the muted stop that still clears 4.5:1 on white). Focus and links are `#0169cc`. Red and orange are for error and warning only.

Search has two rooms. Night: `#141414` field, `#e4d5c4` cream ink, hairlines at 14% cream. Day: `#fcfcfc` canvas, `#0d0d0d` ink, `#dfdfdf` hairlines, muted `#5d5d5d`. The rail matches the open ledger. A sun/moon icon in the top right toggles the room. Company records stay daylight **below the opening field**. The record itself opens inverted: about 75% of the viewport is night, then the tabs and ledgers return to daylight. Do not warm either canvas into sand.

## 3. Typography

Two families. No third.

| Role | Face | Size | Weight | Notes |
| --- | --- | --- | --- | --- |
| Display | Newsreader | 32px / 2rem | 400 | Company name, page title. Italic allowed. `font-optical-sizing: auto`. Tracking −0.02em. Line-height 1.15. |
| Headline | Newsreader | 24px / 1.5rem | 400 | Section titles on a record. |
| Title | Newsreader | 20px / 1.25rem | 500 | In-page headings only. |
| Body | IBM Plex Mono | 14px / 0.875rem | 400 | Filters, prose under 60ch, table cells. Tabular nums. |
| Label | IBM Plex Mono | 12px / 0.75rem | 500 | Buttons, column headers, status. Small caps never. Uppercase only for ≤3-word field labels. |

Fixed rem scale (product, not marketing clamp). Body stays 14px in dense tools; 16px only for long-form notes. Line length for prose 65ch. Tables may run wider. `text-wrap: balance` on h1–h2.

Fallback stacks are in the frontmatter. Load via `next/font` with `display: swap`.

## 4. Elevation

Flat. Surfaces separate by hairline and a one-step canvas/surface shift, not drop shadows. If a menu must lift, use `--shadow-100` (2px, 8% black) and a hairline together is forbidden: pick one. No 16px+ blur.

Radius: 2px on controls, 4px on menus, 0 on tables.

## 5. Components

- **Search field:** mono, 16–18px input inside a 2px hairline instrument. Press `/` to focus. Do not render a slash keycap. Idle: centered under “Global Search” on a hairline globe. Active: ledger with funnel and table. No universe-count lede under the title.
- **Results table:** mono facts, Newsreader legal names. Sticky header, numeric columns right-aligned and tabular. Row hover is a 6% cream wash, not a card.
- **Funnel:** every active criterion stays on screen with its count. Click a step to release it.
- **Company title:** Newsreader on the record. On the opening night field the legal name sits beside a plain daylight circle (logo or monogram) at the bottom left. Identity facts sit on the right in 12px mono, cream on night. Tabs and the rest of the record stay daylight.
- **Buttons:** 12px mono, 32px tall, 2px radius. Primary is ink fill, white type. Outline is hairline. Press scale 0.97. No display face on buttons.
- **Filters:** mono labels. Active criteria stay visible as text, not chips-as-identity.
- **Focus:** 2px `--color-ring` offset. Never color-only state.

## 6. Do's and Don'ts

**Do**

- Put the legal name in Newsreader and the identifiers in Plex Mono on the same line.
- Keep roman out of nav, buttons, and filter chrome. Legal names in the results table are the exception.
- Use italic Newsreader for a quote or empty-state line, not for UI labels.
- Set financials in Plex Mono with `font-variant-numeric: tabular-nums`.

**Don't**

- Don't use Inter, Roboto, Playfair, Instrument Serif, or Geist.
- Don't flood the whole record with night. Only the opening field inverts; tabs and ledgers stay daylight.
- Don't put Newsreader on a 12px label. Serifs die there.
- Don't add a third family for "just the wordmark."
- Don't warm the background to cream/sand.
- Don't animate keyboard search. The globe is ambient; it pauses under `prefers-reduced-motion`.
