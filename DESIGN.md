# DHEvals visual system

## Source of truth

Accepted concept: `public/reference/dhevals-dashboard-concept.png` (generated design reference preserved in the repository).

The first product surface is a dark benchmark control room designed to read inside a 16:9 YouTube recording. The visual idea is **midnight lab console: quiet graphite, electric evidence, editorial data density**.

## Color tokens (OKLCH)

```css
--bg: oklch(0.055 0 0);
--surface: oklch(0.095 0.012 240);
--surface-raised: oklch(0.13 0.016 240);
--ink: oklch(0.96 0.008 240);
--ink-muted: oklch(0.70 0.028 240);
--ink-faint: oklch(0.53 0.028 240);
--hairline: oklch(0.21 0.018 240);
--primary: oklch(0.56 0.18 240);
--accent: oklch(0.88 0.19 115);
--info: oklch(0.63 0.18 260);
--success: oklch(0.78 0.18 125);
--danger: oklch(0.68 0.17 25);
```

The background is near-black and neutral; the cobalt seed carries brand identity while lime is reserved for active evidence and completed states. No gradient text, no beige/cream body, and no decorative glassmorphism.

## Typography

- UI family: `IBM Plex Sans`, `ui-sans-serif`, `system-ui`, sans-serif.
- Evidence/code family: `IBM Plex Mono`, `ui-monospace`, `SFMono-Regular`, monospace.
- Display score: 72–88px, weight 600, tabular numerals, tracking `-0.03em`.
- Page title: 20px, weight 600.
- Data labels: 12–13px, weight 500, line-height 1.35.
- Body copy: 14px, line-height 1.5.
- Use `text-wrap: balance` on headings and `font-variant-numeric: tabular-nums` for metrics.

## Layout

- 16:9 desktop canvas with a fixed 200px navigation rail, 64px top bar, fluid main area and 388px inspector.
- Main content uses open bands, one dominant chart, one table and one timeline rail rather than a repeated card grid.
- Hairline separators are full-width and neutral; no colored side stripes.
- Mobile collapses the rail and inspector into a top bar and an inline detail drawer; the table becomes horizontally scrollable with the task name pinned.

## Component families

- `AppShell`: navigation rail, top run bar, live status.
- `CategoryChart`: paired lime/cobalt traces with explicit legend and values.
- `RunTable`: semantic table with task selection and status states.
- `Inspector`: selected task evidence, score, latency, token count and sources.
- `ActivityRail`: compact event stream for the active run.
- `StatusDot`, `Metric`, `Button`, `NavItem`: small shared primitives with focus/hover/disabled states.

## Motion

Motion communicates run state only: score traces reveal over 420ms, selected rows transition in 160ms, and the live dot pulses gently. Reduced-motion mode removes reveal and pulse while preserving selection feedback.

## Functional additions to the first implementation

The implementation adds three code-native controls that were not visible in the concept but are required by the product workflow: `Export data`, `Copy manifest` and `Director view`. They stay visually subordinate to the benchmark evidence and exist to support reproducibility and YouTube capture.
