# DHEvals UI — fidelity ledger

**Concept:** `public/reference/dhevals-dashboard-concept.png`  
**Implementation surface:** React/Vite console at `/`  
**Reference viewport:** 1672 × 941  
**Verified viewport:** 1672 × 941 desktop and 390 × 844 mobile

## Comparison points

| Area | Concept evidence | Render evidence | Result |
| --- | --- | --- | --- |
| Composition | rail + top run bar + central comparison canvas + right inspector | same shell, with responsive collapse on mobile | matched |
| Palette | neutral graphite, electric lime current run, cobalt baseline | OKLCH tokens preserve the same roles and contrast | matched |
| Typography | compact research-console labels and large score | IBM Plex Sans/Mono, tabular metrics, readable table controls | matched with a deliberate type refinement |
| Evidence hierarchy | score, paired category traces, task table, selected-task evidence | same order and visual emphasis | matched |
| Interaction | selected task and detail context implied by the inspector | row/category selection updates inspector; sources expand inline | extended functionally |
| Video use | high-contrast 16:9 desktop frame | `Director view` hides navigation and inspector for a clean broadcast composition | intentional product addition |
| Responsive behavior | desktop concept only | mobile rail collapses, chart preserves horizontal readability, inspector moves below | verified extension |

## Above-the-fold copy diff

All concept anchor copy is present: `DHEvals`, the dynamic `Heavy User / v<version>` run label (the reference image used v0.1), `SaciLM`, `Run live`, `Overall score`, category names, legend labels, and selected-task evidence. The implementation adds `Run overview`, `Refresh run`, `Export data`, `Director view`, `Task run`, `Copy manifest`, `Selected task` and `Sources` as code-native controls required by the functional workflow. No concept anchor was removed.

## Verification notes

- `npm run build` passes.
- Playwright Chromium was used because Browser/IAB tools were not available in this environment.
- `view_image` was used on the accepted concept and the final desktop/mobile screenshots.
- Verified task selection, source expansion, director-mode toggle, nav restoration and no horizontal body overflow at 390px.
- Verified the console reads `public/data/latest-run.json` and updates the visible score/task state after `npm run run:fixture`.
- `impeccable` detector reports no remaining anti-pattern findings in the frontend files.
