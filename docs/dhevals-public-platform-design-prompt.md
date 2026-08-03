# DHEvals Public Platform — Design LLM Prompt

This file is a copy/paste-ready brief for a design-specialized LLM. The prompt
is intentionally self-contained so it can be used without access to this
repository. If the target tool supports image attachments, attach
`public/reference/dhevals-dashboard-concept.png` and the two SVG logo assets
next to this prompt.

## Copy/paste prompt

~~~text
You are a principal product designer, brand designer, information architect,
and design engineer specializing in public data products, AI model
leaderboards, research tools, and social-first web experiences.

Design the complete public web platform for DHEvals, an AI model evaluation
laboratory. The result must feel credible enough for researchers, useful enough
for heavy AI users, and visually distinctive enough to be shared on X,
LinkedIn, and YouTube.

Do not make a generic SaaS dashboard. Do not make a toy benchmark or a “magic
AI” landing page. Design an evidence-first publication and data instrument.

======================================================================
1. PRODUCT CONTEXT
======================================================================

DHEvals evaluates AI models on realistic, multi-step heavy-user tasks such as
research synthesis, document QA, planning, data analysis, code generation,
writing, and tool-oriented work. The system keeps versioned suites, immutable
run artifacts, deterministic checks, calibration, verification, evidence
states, and public reports.

The public platform is read-only in its first release. It consumes verified
public artifacts. It must never expose API keys, private prompts, internal file
paths, reviewer identity, or unpromoted runs.

The product promise is:

  “See how AI models behave when the work is real, multi-step, and worth checking.”

The product must clearly separate:

- quality score from evidence confidence;
- quality from price, latency, throughput, and context;
- verified/public results from archive-only, pending, estimated, locked, and
  invalid artifacts;
- raw task evidence from composite ranking narratives.

The current scope includes versioned suites such as a Brazilian-Portuguese
heavy-user suite. The interface itself is English-first, while suite titles and
task content may remain in the language of the benchmark.

======================================================================
2. REFERENCE DIRECTION
======================================================================

Use these sites as information-architecture and interaction references only:

- https://benchlm.ai/
  Study its model discovery, evidence labels, freshness, methodology,
  decision-ready views, shareable filters, and dense but readable leaderboard.

- https://llm-stats.com/
  Study its leaderboard, compare flow, category paths, model pages, and
  operational columns such as speed, price, context, and license.

Do not copy their logo, exact copy, colors, layout, icons, or assets. DHEvals
must have an original visual identity and an original evidence contract.

Also use the attached DHEvals internal console screenshot as the brand seed:

- near-black background;
- compact top run bar;
- left navigation rail and right evidence inspector;
- acid-lime double-slash mark and white DHEvals wordmark;
- cobalt/cyan secondary interface signals;
- thin blue-gray hairlines;
- IBM Plex-like technical typography;
- high information density with generous hierarchy;
- a “Director view” that reads in a 16:9 YouTube frame.

Extend this identity into a public editorial platform. Do not simply reproduce
the internal calibration screen as the homepage.

======================================================================
3. BRAND AND LOGO — NON-NEGOTIABLE
======================================================================

Product name: DHEvals

Capitalization: uppercase D, uppercase H, uppercase E, lowercase vals.
Never write DHEVALS, Dhevals, or DHEvals AI in the UI.

Primary mark:

- two forward-leaning, parallel parallelogram strokes;
- the mark reads as a precise “//” execution signal;
- equal stroke widths and a consistent forward slant;
- gap between strokes equals approximately one stroke width;
- acid-lime primary color #DFFF00;
- optional second stroke shade #B8CE00 for a restrained two-tone version;
- no gradient, glow, mascot, robot, circuit brain, hexagon, or generic spark;
- must remain recognizable at 16px and 1024px;
- provide mark-only, dark lockup, light lockup, monochrome, favicon, and social
  avatar variants;
- provide clean SVG path assets with no external dependencies;
- provide clear-space and minimum-size rules;
- never put the mark in a default rounded badge or a decorative blob.

Wordmark:

- “DHEvals” in a clean technical grotesk/sans;
- primary dark-surface wordmark color #F1F5F4;
- no italic wordmark;
- medium/semi-bold weight, compact but not condensed;
- align the cap-height and optical center with the double-slash mark.

The logo must work in a top navigation bar, a 1200×630 social card, a 1024px
avatar, a favicon, and a 1920×1080 video title card.

======================================================================
4. VISUAL SYSTEM
======================================================================

Tone:

- midnight laboratory;
- rigorous, transparent, energetic, and editorial;
- calm confidence rather than hype;
- data density with clear hierarchy;
- suitable for a research discussion and a social post.

Do not use:

- decorative glassmorphism;
- beige or cream backgrounds;
- neon rainbow gradients;
- 3D coins, robots, brains, circuit patterns, or generic AI imagery;
- a repeated wall of identical rounded cards;
- huge unsupported “best model” claims;
- chart animation that hides the values;
- color-only status communication.

Core tokens (use these exact values unless a contrast calculation requires a
documented adjustment):

  --color-bg: #050607
  --color-surface: #080D10
  --color-surface-raised: #0E151A
  --color-surface-elevated: #131E24
  --color-border: #1A2730
  --color-border-strong: #29404B
  --color-text: #F1F5F4
  --color-text-secondary: #B2C2C6
  --color-text-muted: #718792
  --color-text-faint: #4C6068
  --color-lime: #DFFF00
  --color-lime-soft: #B8CE00
  --color-cobalt: #4B8BFF
  --color-cyan: #74B9C6
  --color-amber: #FFB547
  --color-red: #FF6472
  --color-violet: #A78BFA

Typography:

- UI/display: IBM Plex Sans, Inter, ui-sans-serif, system-ui, sans-serif;
- data/evidence: IBM Plex Mono, ui-monospace, SFMono-Regular, monospace;
- large score: 48–64px desktop, 36–48px mobile, tabular numerals;
- page title: 32px desktop, 26px mobile, weight 600;
- section title: 18–24px, weight 600;
- body: 14–16px, line-height 1.45–1.55;
- labels/timestamps: 11–12px, uppercase only when useful;
- use balanced wrapping for headlines and never truncate important model names.

Layout:

- max content width 1440px;
- 12-column desktop grid with 20px gutters;
- 32px desktop outer gutter, 24px tablet, 16px mobile;
- 4px base spacing with an 8px rhythm;
- square or subtly rounded data containers; maximum panel radius 12px;
- 1px hairlines instead of heavy card borders;
- 16:9 capture must remain readable without browser zoom.

Breakpoints:

- wide: 1440px and above;
- desktop: 1200–1439px;
- tablet: 768–1199px;
- mobile: 480–767px;
- small: below 480px.

Color semantics:

- lime = verified, active, positive, or primary action;
- cobalt = navigation, focus, or comparison series;
- cyan = neutral context or secondary series;
- amber = estimated, pending, stale, or requires attention;
- red = invalid, failed, or destructive;
- every color status must also have text, iconography, or a pattern.

======================================================================
5. INFORMATION ARCHITECTURE AND ROUTES
======================================================================

Create these public routes:

1. `/`
   Editorial homepage. Include a clear promise, latest verified signal,
   decision-ready result, category discovery, how-it-works sequence, recent
   reports, methodology teaser, and social footer.

2. `/leaderboard`
   Main ranked table. Include search, provider, category, suite, license,
   evidence, date, and sort filters. Encode filter state in the URL.

3. `/models/:modelSlug`
   Model profile. Include model/provider identity, quality score, evidence
   confidence, workload breakdown, cost, latency, throughput, context, run
   history, sources, and a Compare action.

4. `/compare/:modelA-vs-:modelB`
   Head-to-head comparison. Include absolute values, deltas, category heatmap,
   task-level differences, evidence coverage, suite version, and a share action.
   Do not declare a winner if the data is not comparable.

5. `/benchmarks`
   Suite/catalog discovery. Include version, task count, language, dimensions,
   status, hash, and review date.

6. `/benchmarks/:suiteSlug`
   Benchmark detail. Explain purpose, tasks, dimensions, deterministic checks,
   calibration, limitations, and exact machine-readable data.

7. `/reports`
   Published run index with model, score, suite, date, coverage, status, and
   report type.

8. `/reports/:runId`
   Long-form evidence report. Include run identity, score overview, coverage,
   task table, task inspector, verification metadata, sources, and JSON/CSV/HTML
   export links.

9. `/methodology`
   Explain score, coverage, evidence states, calibration, missing data,
   failure behavior, cost separation, limitations, and reproducibility.

10. `/about` and `/data`
    Project context, contact/repository links, schema notes, and downloads.

Global navigation: DHEvals lockup, Leaderboard, Compare, Benchmarks, Reports,
Methodology, global search, data download, and a compact theme control.

======================================================================
6. SCREEN DESIGN REQUIREMENTS
======================================================================

Design the following screens at desktop (1440×900 or 1440×960), tablet, mobile
(390×844), and social-card size when relevant:

A. Homepage

- Hero with one strong claim and one primary CTA.
- Latest verified signal panel with model, suite, score, coverage, evidence,
  and date.
- Three decision-ready result bands, never unsupported superlatives.
- Category/workload navigation.
- A visual “choose suite → run → verify → publish” sequence.
- Recent reports with compact metadata.
- Methodology and limitations callout.

B. Leaderboard

- Dense, calm table; model column pinned.
- Search and filter bar with URL-preserving state.
- Evidence labels Supported, Estimated, Pending, Locked, Invalid.
- Quality, category, cost, speed, context, license, and last verified columns.
- Hover/selected row state and mobile details drawer.
- Empty, loading, stale, and error states.

C. Model profile

- Score hero with quality and evidence shown separately.
- Workload bars or heatmap with a table alternative.
- Operational metrics only when measured.
- Run history and source list.
- Compare and share actions.

D. Comparison

- Two model identity blocks.
- “Where A leads / where B leads / not comparable” summary.
- Delta rows with units and exact scope.
- Category heatmap and task-level table.
- Evidence coverage and methodology link above the conclusion.

E. Report detail

- Run header and verification state.
- Score, coverage, suite version, model, and date.
- Task table and right-side/inline inspector.
- Evidence text, checks, latency, tokens, and sources.
- Archive-only vs promoted state is visually explicit.
- Export controls and share card preview.

F. Methodology

- Plain-language trust explanation first.
- Expandable technical details.
- Score formula visualization.
- Calibration gate and missing-data examples.
- “What this benchmark does not claim” section.

======================================================================
7. DATA AND COPY RULES
======================================================================

Use believable but clearly synthetic sample data in the design. Use neutral
names such as “Model Alpha”, “Model Beta”, “Provider One”, and
“Heavy-user pt-BR v0.2” unless the supplied data explicitly requires a real
model name.

Normative public fields:

- model id, name, provider, release/status, license;
- quality score 0–100;
- evidence status and coverage;
- suite id/version/language/task count/dimensions/hash;
- category/workload scores;
- cost with exact units when available;
- latency/throughput/context when measured;
- last verified date;
- run status: verified, archive-only, promoted, pending, locked, invalid;
- source links and artifact links.

Render unavailable metrics as “—” with an explanatory label. Never render an
unmeasured value as zero. Never mix estimated values into a verified-looking
chart without an explicit legend.

Voice: precise, candid, concise, technically literate, and calm. Use “highest
score in this scope” instead of “best AI” unless the scope and evidence justify
it. Do not use “human-level”, “AGI”, “magic”, “revolutionary”, or “objective”.

======================================================================
8. COMPONENTS AND STATES
======================================================================

Build a coherent component inventory, not one-off page mockups:

- PublicShell, TopNav, Footer, Breadcrumbs, GlobalSearch;
- HeroClaim, FeaturedResult, DecisionCard, MethodologyCallout;
- Metric, ScoreHero, Delta, MetricStrip, CoverageMeter;
- EvidenceBadge, VerificationLine, StatusDot, FreshnessLabel;
- LeaderboardTable, FilterBar, FilterChip, SortControl;
- CategoryBars, ComparisonHeatmap, Timeline, DataTable;
- EvidencePanel, SourceList, RunInspector, ExportMenu;
- Button, IconButton, Tabs, SegmentedControl, Select, Combobox, Drawer, Dialog,
  Toast, Skeleton, EmptyState, ErrorState.

Every data component needs these states:

- loading/skeleton;
- ready;
- empty/no matching data;
- stale data;
- pending or locked;
- invalid/error;
- selected/hover/focus/disabled;
- mobile drawer/details state;
- prefers-reduced-motion state.

Use Lucide-style 16–20px line icons or an equally restrained icon set. Do not
use emoji as status icons. Minimum target is 40px when practical and never
below 32px for compact controls.

======================================================================
9. CHARTS, TABLES, AND MOTION
======================================================================

Series order:

1. primary verified model = lime;
2. comparator/baseline = cobalt;
3. context/secondary = cyan;
4. pending/estimated = amber pattern or dashed line;
5. invalid/failure = red pattern or icon.

Chart rules:

- always show units, scope, suite/version, and date;
- use bars, dots, slopes, and heatmaps before pie charts;
- provide a data-table alternative;
- do not imply precision beyond the input data;
- do not hide missing values;
- do not use more than five saturated series.

Motion:

- hover: 120ms;
- selection: 160ms;
- drawer/dialog: 220ms;
- chart reveal: 420ms maximum;
- status pulse: gentle and removable.

Use ease-out on entry, ease-in on exit, and remove non-essential motion under
`prefers-reduced-motion: reduce`. No bounce, parallax, confetti, or animated
background texture.

======================================================================
10. RESPONSIVE, ACCESSIBILITY, AND SEO
======================================================================

Responsive behavior:

- desktop: full nav, 12-column layout, pinned model table column;
- tablet: condensed nav and two-column hero/metrics;
- mobile: single column, compact table rows, details drawer, bottom/sheet nav;
- never compress a desktop table until text is unreadable;
- preserve exact values and scope on every viewport.

Accessibility:

- target WCAG 2.2 AA;
- visible 2px cobalt focus ring with dark offset;
- color is never the only status signal;
- semantic tables with captions and headers;
- charts have a textual summary or table;
- dialogs/drawers trap and restore focus;
- keyboard navigation works for filters, rows, tabs, and share actions;
- support `prefers-reduced-motion`;
- support long Portuguese task/model names without destructive truncation.

SEO/social:

- title, description, canonical, Open Graph, X card, JSON-LD, sitemap, robots;
- model, suite, score, evidence state, and verified date in social metadata;
- OG/LinkedIn image 1200×630;
- X large-card image 1200×675 or a documented canonical 1200×630 asset;
- all essential social-card text inside a 72px safe area;
- do not put private prompts or secrets in a social card.

======================================================================
11. REQUIRED DELIVERABLES
======================================================================

Deliver the work in this exact order:

1. One-paragraph design thesis and a short “what is deliberately different”
   section.
2. Brand board with logo concept, logo variants, clear-space rules, typography,
   color tokens, and prohibited usage.
3. Information architecture and route map.
4. High-fidelity desktop and mobile designs for homepage, leaderboard, model
   profile, comparison, report detail, benchmark detail, and methodology.
5. Component inventory with variants and every required state.
6. Design token output as CSS variables or JSON, using the exact palette above.
7. SVG logo deliverables: mark-only, dark lockup, light lockup, monochrome,
   favicon, and social avatar.
8. Social-card templates: result, comparison, report, and video title card.
9. Synthetic seed data that demonstrates verified, estimated, pending, locked,
   invalid, missing, and stale states.
10. Responsive behavior notes for 1440, 1280, 1024, 768, 390, and 360 widths.
11. Accessibility, SEO, and interaction/motion notes.
12. Visual QA checklist and unresolved assumptions.

If you can generate code, also provide production-oriented React/Vite or
Next.js component structure with semantic HTML, CSS token usage, accessible
states, and data-driven rendering. Do not add a backend or model API call.
If you cannot generate code, provide implementation-ready component specs and
exact measurements instead.

======================================================================
12. ACCEPTANCE CHECKLIST
======================================================================

The design is acceptable only if:

- the DHEvals logo is recognizable at favicon, nav, and social sizes;
- the first viewport communicates the product in under 20 seconds;
- the public platform feels like a research publication, not a generic SaaS;
- the leaderboard is dense but readable and URL-shareable;
- quality and evidence confidence are visually separate;
- missing, pending, locked, and invalid data are not confused with zero;
- the comparison page cannot declare a winner on incomparable data;
- the report page leads from summary to task-level evidence;
- the design works in a 16:9 video frame and on 390px mobile;
- every chart has a non-visual equivalent;
- the social cards remain legible at 1200×630;
- no credentials, private prompts, or unverified claims appear;
- no copied assets or copied copy from the reference websites appear;
- the system has loading, empty, stale, error, locked, and reduced-motion states.

Start with the design thesis, then show the brand board and information
architecture before presenting page designs. Make the result decisive and
specific. Do not return a generic moodboard or a list of vague suggestions.
~~~
