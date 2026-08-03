# DHEvals Public Platform — Design System

**Version:** 0.1
**Status:** Proposed public-platform source of truth
**Tone:** Midnight laboratory, evidence in motion, editorial data density

## 1. Design direction

DHEvals is a benchmark laboratory, not a generic analytics SaaS. The interface
should feel precise, technical, and alive without looking noisy. The visual
system is built around three ideas:

1. **Midnight lab:** near-black canvas, graphite surfaces, blue-gray hairlines,
   and quiet depth.
2. **Evidence signal:** acid lime marks verified, active, or positive evidence;
   cobalt separates comparison and navigation; cyan handles neutral context.
3. **Editorial instrument:** large claims, compact source lines, dense tables,
   and enough whitespace to make the data legible in a social post or 16:9
   recording.

The system extends the accepted internal concept in `DESIGN.md`. It does not
use decorative glassmorphism, neon gradients, beige backgrounds, glossy 3D
cards, or generic “AI magic” motifs.

## 2. Brand primitives

### 2.1 Name and capitalization

- Product name: **DHEvals**
- Use an uppercase `D`, uppercase `H`, uppercase `E`, lowercase `vals`.
- Never write `DHEVALS`, `Dhevals`, or “DHEvals AI” in the product UI.
- The descriptor is “AI model evaluation laboratory” when a descriptor is
  needed.

### 2.2 Brand attributes

| Attribute | It should feel like | It should not feel like |
|---|---|---|
| Rigor | A research instrument | An academic PDF viewer |
| Transparency | An open evidence trail | A marketing disclaimer |
| Energy | A live measurement signal | A gaming HUD |
| Intelligence | A well-designed lab | A mystical AI oracle |
| Social presence | A strong editorial card | A clickbait leaderboard |

## 3. Logo system

### 3.1 Logo concept

The DHEvals mark is a pair of forward-leaning parallelogram strokes. It reads
as a compact `//` signal: movement, execution, and an active test lane. The
double stroke must remain simple at favicon size and strong at social-card size.

The wordmark uses a clean grotesk/sans with a slightly technical rhythm. The
mark and wordmark form a lockup; they are not a single uneditable bitmap.

Versioned SVG assets live in:

- [`public/brand/dhevals-mark.svg`](../public/brand/dhevals-mark.svg)
- [`public/brand/dhevals-lockup.svg`](../public/brand/dhevals-lockup.svg)

### 3.2 Logo variants

1. **Dark lockup:** lime mark + `#F1F5F4` wordmark on `#050607` or another dark
   surface. Primary version.
2. **Light lockup:** dark mark + `#0B1115` wordmark on `#F1F5F4` or a light
   surface. Use only when a light theme is intentionally enabled.
3. **Mark only:** for favicon, avatar, compact navigation, and social corner
   stamp.
4. **Monochrome:** one-color white or one-color dark for print or constrained
   embeds.

### 3.3 Geometry and clear space

- The mark is two equal-width strokes with a consistent forward slant.
- The gap between strokes equals one stroke width.
- Clear space around the complete lockup equals the cap height of the `D`.
- Minimum lockup width: 112px digital.
- Minimum mark size: 16px digital; 24px preferred.
- Social avatar mark: 160px or larger source, with at least 24% internal
  padding.
- Never stretch, rotate, outline, add a drop shadow, place inside a pill, or
  recolor the lime stroke with arbitrary brand colors.
- On busy imagery, put the mark on a solid `--surface-raised` chip with no
  transparency rather than applying a shadow.

### 3.4 Logo prompt seed

```text
Create a minimal vector brand mark for “DHEvals”: two forward-leaning,
parallel parallelogram strokes resembling a precise // execution signal. Use a
high-visibility acid-lime mark on transparent background, geometric edges,
consistent stroke width, no gradients, no rounded blobs, no mascot, no circuit
icon, no robot, no word “AI”. Provide mark-only, dark lockup, light lockup, and
monochrome variants as clean SVG paths.
```

## 4. Color tokens

Use CSS custom properties or an equivalent token layer. Hex values are the
implementation baseline; OKLCH values can be added for perceptual color work.

### 4.1 Core palette

| Token | Hex | Use |
|---|---|---|
| `--color-bg` | `#050607` | App canvas, social background |
| `--color-surface` | `#080D10` | Main panels, nav |
| `--color-surface-raised` | `#0E151A` | Cards, drawers, hover surfaces |
| `--color-surface-elevated` | `#131E24` | Dialogs, popovers, selected rows |
| `--color-border` | `#1A2730` | Default hairline |
| `--color-border-strong` | `#29404B` | Focused/active panel border |
| `--color-text` | `#F1F5F4` | Primary text, score labels |
| `--color-text-secondary` | `#B2C2C6` | Supporting text |
| `--color-text-muted` | `#718792` | Metadata, labels, axes |
| `--color-text-faint` | `#4C6068` | Disabled/low-priority text |
| `--color-lime` | `#DFFF00` | Verified, active, positive, primary CTA |
| `--color-lime-soft` | `#B8CE00` | Lime on light surfaces, secondary accent |
| `--color-cobalt` | `#4B8BFF` | Links, comparison series, focus ring |
| `--color-cyan` | `#74B9C6` | Neutral data series, source accents |
| `--color-amber` | `#FFB547` | Pending, estimated, warning |
| `--color-red` | `#FF6472` | Invalid, failed, destructive |
| `--color-violet` | `#A78BFA` | Optional judge/independent lane |

### 4.2 Semantic color rules

- Lime means **verified or active**, not simply “decoration”.
- Amber means **incomplete or requires attention**, never a quality score.
- Red means **invalid, failed, or destructive**; do not use it for low scores
  unless the rubric explicitly defines failure.
- Cobalt means **navigation or comparison**, not truth or approval.
- Every status color must also have a text label, icon, or pattern.
- Never use lime text on white without checking contrast; use a darker lime for
  light themes.

### 4.3 Optional OKLCH mapping

```css
:root {
  --bg: oklch(0.055 0.01 240);
  --surface: oklch(0.095 0.018 235);
  --surface-raised: oklch(0.14 0.024 235);
  --ink: oklch(0.96 0.012 180);
  --ink-muted: oklch(0.72 0.035 205);
  --hairline: oklch(0.23 0.03 220);
  --primary: oklch(0.64 0.19 255);
  --accent: oklch(0.91 0.22 110);
}
```

## 5. Typography

### 5.1 Families

- UI and display: `IBM Plex Sans`, `Inter`, `ui-sans-serif`, `system-ui`,
  sans-serif.
- Evidence, code, IDs, timestamps, and table numerals: `IBM Plex Mono`,
  `ui-monospace`, `SFMono-Regular`, monospace.
- Do not introduce more than two type families in one view.

### 5.2 Type scale

| Token | Size / line height | Weight | Use |
|---|---:|---:|---|
| `display-xl` | 64 / 0.98 | 600 | Homepage claim, score hero |
| `display-lg` | 48 / 1.02 | 600 | Model score, social claim |
| `heading-xl` | 32 / 1.08 | 600 | Page headline |
| `heading-lg` | 24 / 1.15 | 600 | Section title |
| `heading-md` | 18 / 1.25 | 600 | Panel title |
| `body-lg` | 16 / 1.45 | 400 | Intro and explanatory copy |
| `body` | 14 / 1.5 | 400 | Main UI copy |
| `label` | 12 / 1.3 | 500 | Eyebrow, metadata |
| `micro` | 11 / 1.3 | 500 | Table labels, timestamps |

Use `font-variant-numeric: tabular-nums` for score, rank, price, latency, and
token columns. Use `text-wrap: balance` for headlines and `text-wrap: pretty`
for long evidence paragraphs.

### 5.3 Editorial hierarchy

An above-the-fold page should have exactly one dominant claim, one supporting
explanation, and one primary action. Do not turn every metric into a hero.

## 6. Spacing, grid, and layout

### 6.1 Spacing scale

Use a 4px base with an 8px rhythm for most layout decisions:

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
--space-20: 80px;
--space-24: 96px;
```

### 6.2 Containers

- Wide public pages: max width 1440px.
- Editorial reading width: 720–820px.
- Data table width: fluid within 1440px; do not artificially constrain the
  table to a reading column.
- Desktop outer gutter: 32px at ≥1280px, 24px at 768–1279px, 16px below 768px.
- Main desktop grid: 12 columns, 20px gutters.
- Hero grid: 7 columns for claim, 5 for featured evidence.

### 6.3 Breakpoints

| Name | Width | Behavior |
|---|---:|---|
| `wide` | ≥1440px | Full nav, 12-column editorial/data layout |
| `desktop` | 1200–1439px | Full nav, compressed panel gaps |
| `tablet` | 768–1199px | Condensed nav, two-column layouts |
| `mobile` | 480–767px | Single column, drawers, compact table rows |
| `small` | <480px | One column, 16px gutters, no side-by-side metrics |

### 6.4 Surface geometry

- Border radius: 0px for data containers, 4px for controls, 8px for elevated
  panels, 12px maximum for feature surfaces.
- Borders are 1px hairlines, never heavy card outlines.
- Use `box-shadow` only to separate an elevated overlay from the canvas. Never
  use a glow around every card.
- Prefer bands, rules, charts, and tables over a wall of repeated cards.

## 7. Component inventory

### 7.1 App shell

`PublicShell` contains the logo, primary nav, global search, theme toggle,
share/data actions, footer, and route-level announcements. On mobile, the nav
opens as a full-height sheet with a clear close action.

### 7.2 Navigation

- `TopNav`: 64px desktop, 56px mobile.
- `NavLink`: text + optional icon; active state uses a 2px cobalt or lime
  underline/edge, not a large filled pill.
- `Breadcrumbs`: visible on model, suite, comparison, and report pages.
- `GlobalSearch`: keyboard shortcut `⌘K` / `Ctrl+K`, grouped results, clear
  empty state.

### 7.3 Evidence and status

- `EvidenceBadge`: icon + `Supported`, `Estimated`, `Pending`, `Locked`, or
  `Invalid`.
- `VerificationLine`: suite version, source revision, last verified date.
- `StatusDot`: 6px–8px dot paired with text; no dot-only semantics.
- `CoverageMeter`: percent plus numerator/denominator when available.
- `FreshnessLabel`: “Verified 2h ago”, exact date in tooltip/accessible label.

### 7.4 Metrics

- `Metric`: label, value, unit, optional delta, source note.
- `ScoreHero`: 0–100 value, scale, evidence state, suite scope, and date.
- `Delta`: signed change with arrow and text (“+4.8 vs Model B”); never color
  alone.
- `MetricStrip`: up to four metrics; more belongs in a table.

### 7.5 Data surfaces

- `LeaderboardTable`: semantic table with sticky header, pinned model column,
  row hover, keyboard selection, responsive details drawer.
- `FilterBar`: search, filter chips, sort control, active-filter count, reset.
- `ComparisonHeatmap`: color + number + accessible table alternative.
- `CategoryBars`: horizontal bars for workload dimensions; include scale and
  exact values.
- `Timeline`: run history or release history with state labels.
- `EvidencePanel`: source, context, check results, response excerpt, and
  provenance.

### 7.6 Editorial surfaces

- `HeroClaim`: eyebrow, headline, supporting sentence, CTA, evidence line.
- `FeaturedResult`: model, score, suite, verified date, and one action.
- `DecisionCard`: conclusion, qualification, source, and link; no unsupported
  superlatives.
- `MethodologyCallout`: plain-language explanation with “Read the method”.
- `ReportTeaser`: date, model, score, task count, verification state.

### 7.7 Interaction primitives

- `Button`: primary lime, secondary outline, quiet text, destructive red.
- `IconButton`: 32px minimum target, tooltip, visible focus.
- `SegmentedControl`: small number of mutually exclusive views.
- `Select`, `Combobox`, `Checkbox`, `Switch`, and `Tabs`: native semantics.
- `Drawer`: mobile detail surface; focus trap and escape close.
- `Dialog`: destructive confirmation or export configuration only.
- `Toast`: brief confirmation; never the only place a critical error appears.

### 7.8 Required states

Every data component needs ready, loading, empty, error, stale, locked, and
not-evaluated states. The stale state must say when the data was generated; the
empty state must explain how the user can change the scope or find a suite.

## 8. Data visualization rules

### 8.1 Series palette

1. Primary model / verified trace: lime.
2. Comparator / baseline: cobalt.
3. Context or secondary series: cyan.
4. Pending/estimated: amber pattern or dashed line.
5. Invalid/failure: red pattern or icon.

Never use more than five saturated series in a chart. If more categories exist,
use small multiples or a table.

### 8.2 Chart rules

- Always show units, scope, and time/suite version.
- Prefer bars, dot plots, slopes, and heatmaps over pie charts.
- Use zero baselines for score bars unless a non-zero axis is explicitly
  justified and labeled.
- Do not animate the first paint of a chart for longer than 420ms.
- Include a “View data table” action and a textual summary.
- Use patterns, labels, and shapes in addition to color.
- Do not draw fake precision; display only the precision supported by the data.

### 8.3 Table rules

- Right-align numeric columns and use tabular numerals.
- Keep model names and provider visible on mobile; move operational columns to
  the drawer.
- Use `—` for unavailable values and explain it in the legend.
- Use `0` only when zero was actually measured.
- Show a column-level unit in the header, not only in a tooltip.

## 9. Interaction and motion

| Motion | Duration | Rule |
|---|---:|---|
| Button/row hover | 120ms | Opacity/border only |
| Selection feedback | 160ms | Border/background transition |
| Drawer/dialog | 220ms | Translate + opacity |
| Chart reveal | 420ms | Only on first meaningful load |
| Live indicator | 1200ms loop | Reduce/remove under reduced motion |

Use ease-out for entering content and ease-in for leaving content. No bounce,
parallax, cursor trails, confetti, or perpetual background animation. With
`prefers-reduced-motion: reduce`, remove all non-essential movement.

## 10. Content and voice

### 10.1 Voice

Precise, candid, concise, technically literate, and calm. Prefer “verified on
this suite” over “the smartest model”. Explain a limitation in the same view as
the claim.

### 10.2 Microcopy examples

- `Verified` — “Verified against heavy-user pt-BR v0.2.”
- `Estimated` — “Visible for context; direct evidence is incomplete.”
- `Locked` — “Run archived. Promotion gate is still closed.”
- `No data` — “No measurement in this suite. This is not a zero.”
- `Stale` — “Last verified 14 days ago.”
- `Share` — “Copy a link that preserves this comparison.”

### 10.3 Words to avoid

Avoid unsupported “best”, “smartest”, “human-level”, “AGI”, “magic”,
“revolutionary”, and “objective” claims. Use “highest score in this scope”
when the evidence supports it.

## 11. Accessibility and inclusive behavior

- Target WCAG 2.2 AA.
- Body text contrast target ≥4.5:1; large text ≥3:1.
- Lime indicators need a text label and should not be used as small body text on
  white.
- Focus ring: 2px cobalt outer ring + 1px dark offset.
- Hit targets: 40px preferred, 32px absolute minimum for compact icon buttons.
- Tables, heatmaps, and charts have text equivalents.
- Dialogs and drawers manage focus correctly.
- Use `aria-live="polite"` for run refresh notifications, never for every
  streaming metric.
- Portuguese long task titles must wrap rather than truncate important words.

## 12. Social-card system

### 12.1 Formats

- Open Graph / LinkedIn: 1200×630px.
- X large preview: 1200×675px or 1200×630px when one canonical asset is easier
  to operate.
- Square avatar: 1024×1024px mark-only.
- Video title card: 1920×1080px.

### 12.2 Card composition

1. Top-left: DHEvals lockup.
2. Upper-right: `VERIFIED`, `ARCHIVE ONLY`, or `ESTIMATED` state.
3. Left/center: one claim, maximum two lines.
4. Bottom-left: model, suite, and date.
5. Bottom-right: score or comparison delta, if valid.
6. Footer hairline and `dhevals.ai`/repository handle when a final domain is
   available.

Keep all essential text inside a 72px safe area. Do not place long prompts,
API keys, or tiny tables on a social card.

## 13. Implementation tokens

```css
:root {
  --font-ui: "IBM Plex Sans", Inter, ui-sans-serif, system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, monospace;
  --radius-control: 4px;
  --radius-panel: 8px;
  --border-hairline: 1px solid #1A2730;
  --focus-ring: 0 0 0 2px #050607, 0 0 0 4px #4B8BFF;
  --shadow-overlay: 0 20px 60px rgba(0, 0, 0, 0.42);
}
```

Use a token alias layer in components, not hard-coded colors in individual
pages. Component-specific exceptions must be documented in the token file.

## 14. Design QA checklist

- [ ] The logo is legible at 16px and 1200×630px.
- [ ] The first viewport has one clear claim and one primary action.
- [ ] Verified, estimated, pending, locked, and invalid states are distinct.
- [ ] Quality, coverage, cost, latency, and context are not conflated.
- [ ] Long model/provider names do not break the grid.
- [ ] Every chart has a table or text alternative.
- [ ] Filters survive copy/paste and reload.
- [ ] Empty, stale, error, and loading states are designed.
- [ ] Keyboard focus and reduced motion are visible in the design.
- [ ] Social preview has scope, date, evidence, and source context.
- [ ] The 16:9 Director view is readable without browser zoom.
