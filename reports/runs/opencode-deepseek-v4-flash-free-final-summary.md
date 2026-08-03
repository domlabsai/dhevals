# DHEvals Final Evaluation Report — DeepSeek V4 Flash

**Generated:** 2026-08-03 19:31 UTC  
**Model:** `opencode/deepseek-v4-flash-free`  
**Execution:** OpenCode CLI, `minimal` variant, archive-only

## Executive result

Both benchmark versions completed with full coverage: **30/30 tasks**, **100%
coverage**, and **zero unresolved infrastructure errors**.

| Suite | Tasks | Score | Coverage | Pass | Partial | Fail | Errors |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| v0.2.0 | 10 | 60.00% | 100% | 3 | 6 | 1 | 0 |
| v0.3.0 | 20 | 70.00% | 100% | 9 | 10 | 1 | 0 |

The descriptive task-weighted score across both versions is **66.67%**. The
version-specific scores remain the canonical comparison values because v0.2 and
v0.3 are different suite manifests.

## Timeout resilience

The final runs used a 300-second per-attempt limit, one timeout-only retry, and
a 2× backoff. The v0.3 `critical-review-audit` task exceeded 300 seconds,
was terminated as a complete process group, and succeeded on the 600-second
retry. No timeout remained unresolved. Quality failures were not retried or
converted into infrastructure errors.

## Quality findings

- v0.2 quality failure: `structured-extraction`.
- v0.3 quality failure: `safe-automation-plan`.
- All other non-pass results are partial rubric outcomes, not execution errors.

## Reproducibility and artifacts

Both run manifests and derived reports passed DHEvals verification against the
recorded suite hashes. The complete artifacts are stored next to this summary:

- [v0.2 HTML report](opencode-deepseek-v4-flash-free-v02-final.html)
- [v0.3 HTML report](opencode-deepseek-v4-flash-free-v03-final.html)
- [Consolidated JSON summary](opencode-deepseek-v4-flash-free-final-summary.json)

These results remain **archive-only** until the applicable calibration and
release gates are completed.
