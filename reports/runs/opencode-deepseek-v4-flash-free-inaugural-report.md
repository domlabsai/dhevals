# DHEvals Inauguration Report — DeepSeek V4 Flash

**Generated:** 2026-08-03 19:31 UTC  
**Model:** `opencode/deepseek-v4-flash-free`  
**Runner:** OpenCode CLI · `minimal` variant · archive-only

## Executive result

The first three DHEvals heavy-user stages completed with **36/36 tasks**, **100%
coverage**, and **zero unresolved infrastructure errors**. The descriptive
task-weighted score across the three suites is **66.67%**. Version-specific
scores remain the canonical values because each stage has a different suite
manifest.

| Stage | Suite | Tasks | Score | Coverage | Pass | Partial | Fail | Errors |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 01 | v0.1.0 | 6 | 66.67% | 100% | 2 | 4 | 0 | 0 |
| 02 | v0.2.0 | 10 | 60.00% | 100% | 3 | 6 | 1 | 0 |
| 03 | v0.3.0 | 20 | 70.00% | 100% | 9 | 10 | 1 | 0 |

## Quality findings

- v0.1 completed with no quality failures.
- v0.2 quality failure: `structured-extraction`.
- v0.3 quality failure: `safe-automation-plan`.
- Partial rubric outcomes are reported as quality signals; they are not
  converted into infrastructure failures.

## Timeout resilience

The final runs used a 300-second per-attempt limit, one timeout-only retry, and
a 2× backoff. The v0.3 `critical-review-audit` task exceeded the first limit,
was terminated with its complete process group, and succeeded on the 600-second
retry. No timeout remained unresolved.

## Evidence and limitations

All three run manifests and derived reports passed DHEvals verification against
their recorded suite hashes. These results are deterministic task-check
aggregates for the Brazilian-Portuguese heavy-user suites. They are not a
universal model ranking and do not replace human calibration.

The inauguration is **archive-only**. The stages remain ineligible for the
public leaderboard until the applicable calibration and release gates are
complete.

## Artifacts

- [Stage 01 report](opencode-deepseek-v4-flash-free-v01-rerun.html)
- [Stage 02 report](opencode-deepseek-v4-flash-free-v02-final.html)
- [Stage 03 report](opencode-deepseek-v4-flash-free-v03-final.html)
- [Structured inauguration record](opencode-deepseek-v4-flash-free-inaugural-report.json)
- [Stage 02 + 03 summary](opencode-deepseek-v4-flash-free-final-summary.md)
