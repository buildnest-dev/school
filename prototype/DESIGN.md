# SchoolOS landing page — design system

**Concept: "The well-kept register."** Indian schools run on registers, ledgers and timetables. The identity borrows their calm order: ruled hairlines, tabular numbers, a serif voice for headlines (editorial, institutional) and a precise sans for interface text. The product mockups are built from real HTML/CSS components, not images.

## Palette (tokens in `css/styles.css`)
| Token | Value | Use |
|---|---|---|
| `--ink` | `#0f2a2d` deep teal-midnight | dark sections, primary buttons, headline text |
| `--paper` | `#f7f4ee` warm off-white | page surface |
| `--paper-2` | `#efeae0` | alternate bands, wells |
| `--line` | `#ddd6c8` | 1px hairlines |
| `--muted` | `#566768` | secondary text (≥ 5:1 on paper) |
| `--accent` | `#b8501e` saffron-clay | the single accent: CTAs emphasis, markers, focus |
| `--accent-on-dark` | `#f2a766` | accent on ink |
| status | green `#2d7556`, red `#a93a3a`, amber `#a8650f` | only inside product mockups |

No gradients; no glass; shadows are one soft elevation used only on the product window.

## Typography
- Display/headlines: Palatino/Iowan/Georgia serif stack (no web-font download), weight 500, tight tracking, `clamp()` sizes.
- UI/body: `system-ui` stack; tabular numerals for data.
- Eyebrows: 12px caps, letter-spaced, accent-coloured, preceded by a short rule.
- Scale: 12 / 14 / 16 / 18 / 22 / 28 / 40 / clamp(40–68).

## Spacing, shape
4px base: 4 8 12 16 24 32 48 72 112. Radius: 2px for UI chrome (register-like), 8px only for the product window and inputs. Section rhythm: 112px desktop, 72px mobile. Container 1200px with 24px gutters.

## Components
- **Buttons**: `.btn` (pill-less, 4px radius, 48px min height). Primary = ink fill; on dark = paper fill; secondary = hairline outline; arrow glyph slides 3px on hover. 2px accent focus ring offset 3px.
- **Nav**: sticky, paper with hairline; text links with animated underline; "Book a Demo" primary; below 960px collapses to a menu button + full-width panel.
- **Capabilities**: not ten equal cards — an editorial index: three featured items (larger, with detail) + seven ruled list rows.
- **Product window** (`.app`): sidebar rail, header, KPI row, ruled panels; used in hero and daily-ops.
- **Responsive**: breakpoints 1080 / 960 / 640. Grids collapse to a single column; mockups reduce panels rather than scaling text.

## Motion
Fade/translate-in on scroll (≤ 500ms), button arrow nudge, tab switches. All disabled under `prefers-reduced-motion`.

## Revision 2: universal multi-tenant SaaS + motion system
- Positioning: one platform, many independent school workspaces (fictional Northfield Academy, Riverstone Public School, Lakeview Junior Campus). Security items are labelled "Design goal".
- Hero choreography (CSS keyframes, delays via `--d`): nav drop → eyebrow → headline line masks → copy/CTAs → dashboard emerges → panels stagger + count-up → notification settles (~3.4s). Parallax only on the back sheet and notification (`.px[data-depth]`).
- Scroll language: `.reveal` (fade-up), `.reveal-m` (mockups, longer travel), `.stagger` (children delayed), `.mask` (word-by-word clip reveal of headlines), SVG line-draw, timeline line draw.
- Showcase: sticky 440vh track on ≥961px with motion allowed; otherwise stacked sections. One rAF-throttled scroll handler drives header solidity, progress bar, parallax and stage index.
- Safety: `.js` gate is removed after 3s if scripts fail; `prefers-reduced-motion` disables animation, parallax, count-up and sticky mode.

## Content rules
No customer logos, testimonials, stats about customers, awards, certifications or integrations. Mockup numbers are labelled *sample data*. Planned behaviour uses "designed to" language.
