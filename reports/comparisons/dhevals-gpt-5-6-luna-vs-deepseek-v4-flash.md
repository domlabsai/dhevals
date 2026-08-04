# DHEvals Comparative Evaluation

## GPT-5.6 Luna Max vs. DeepSeek V4 Flash

**Status:** archive-only · **Locale:** pt-BR · **Suite:** `dhevals-heavy-user-ptbr` · **Coverage:** 36/36 tasks for each model

This is the second DHEvals model evaluation set. GPT-5.6 Luna was run through the Codex CLI using the user's ChatGPT subscription, with `gpt-5.6-luna` and reasoning effort `max`. DeepSeek V4 Flash is the existing OpenCode CLI evaluation. Scores remain locked until human calibration and the release gate are complete.

## Result

| Stage | Tasks | GPT-5.6 Luna Max | DeepSeek V4 Flash | Delta |
|---|---:|---:|---:|---:|
| v0.1 | 6 | 91.67% | 66.67% | +25.00 pp |
| v0.2 | 10 | 85.00% | 60.00% | +25.00 pp |
| v0.3 | 20 | 80.00% | 70.00% | +10.00 pp |
| **Task-weighted total** | **36** | **83.33%** | **66.67%** | **+16.66 pp** |

The task-weighted total is calculated as `Σ(stage score × stage task count) / 36`; it is not the simple average of the three stage percentages.

Both runs achieved full coverage, zero unresolved infrastructure errors, and valid artifact verification. GPT-5.6 Luna had 25 pass, 10 partial, and 1 fail across the 36 tasks. DeepSeek had 14 pass, 20 partial, and 2 fails; one timeout was resolved by the configured retry policy.

## Interpretation

GPT-5.6 Luna Max produced the higher observed score in this benchmark set. This is a comparative signal for the tested configuration, not a universal ranking or a claim that one model is categorically better. The providers, account plans, CLI runtimes, and timeout budgets differ, and the benchmark has not yet completed human calibration.

The GPT-4 baseline has been removed from the public model projection. Historical registry and audit material remains internally available so that earlier decisions and artifacts remain traceable.

## Reproducibility

- GPT command: `codex exec --ephemeral --sandbox read-only --model gpt-5.6-luna -c model_reasoning_effort=max --color never --skip-git-repo-check`
- GPT parameters: temperature `0.2`, max tokens `2048`, seed `7`, timeout `900s`, one timeout-only retry.
- DeepSeek parameters: temperature `0.2`, max tokens `2048`, seed `7`, timeout `300s`, one timeout-only retry.
- The stage-level run IDs and source report basenames are recorded in the adjacent JSON artifact.
