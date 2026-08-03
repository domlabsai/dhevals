# DHEvals

[English](./README.md) · [Português (Brasil)](./README.pt-BR.md)

DHEvals is a public benchmark console and evaluation harness for measuring AI
models on realistic heavy-user tasks. It combines reproducible benchmark
suites, deterministic checks, model adapters, calibration workflows, and
public run artifacts for research, engineering, and recorded benchmark
analysis.

## What this repository contains

- A React/Vite console for exploring runs, tasks, evidence, calibration, and
  leaderboard data.
- The `dhevals_core` Python package for suites, adapters, grading, verification,
  audits, calibration, and release gates.
- Portuguese (Brazil) heavy-user suites covering research synthesis, document
  QA, planning, data analysis, code generation, writing, and related tasks.
- CLI and OpenAI-compatible HTTP lanes for local, hosted, and subscription
  model providers.
- Versioned JSON, CSV, and HTML artifacts under `public/data/` and `reports/`.
- Independent evidence lanes for safety, agent/tool use, and LLM-as-a-Judge
  without silently changing the deterministic score.

## Current scope

- **v0.1** — six focused heavy-user tasks and a controlled CLI evaluation lane.
- **v0.2** — the ten-category baseline with fixtures, calibration structures,
  and public reporting artifacts.
- **v0.3** — an expanded offline matrix with 20 tasks, 60 dimensions, and 300
  anchor groups.

DHEvals is model-agnostic. The public console keeps a deterministic fixture as
its baseline; real model executions are archived under `reports/runs/` and do
not replace the public baseline implicitly.

## Requirements

- Node.js 20 or newer
- Python 3.12
- [`uv`](https://docs.astral.sh/uv/)

## Run the console locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173/`). The console
reads the latest public artifacts from `public/data/` and remains usable with
the checked-in fixtures when no model endpoint is configured.

## Run the validation suite

```bash
# Python benchmark and grading tests
npm run test:benchmarks

# CLI adapter smoke test
npm run test:model-cli

# Browser-level console test
npm run test:e2e

# Full local platform regression; restores the fixture baseline at the end
npm run test:platform
```

## Generate offline runs and catalogs

```bash
npm run run:fixture
npm run run:calibration
npm run run:negative
npm run run:negative:v03
npm run audit:benchmarks
npm run build:report
npm run build:leaderboard
npm run build:suite-catalog
npm run build:run-catalog
npm run build:model-catalog
npm run build:dataset-catalog
npm run build:experiment-catalog
npm run build:comparison-execution
npm run build:scorecard
npm run build:test-matrix
npm run validate:test-matrix
```

The generated reports include deterministic scores, checks, latency, token
usage when available, suite hashes, verification metadata, and a YouTube-ready
summary pack.

## Evaluate a model through a local CLI

The generic model runner accepts any executable that can receive a prompt via
stdin or an argument. The prompt is passed without shell interpolation, each
task has its own timeout, and failures remain infrastructure errors instead of
being converted into quality zeros.

```bash
export DHEVALS_MODEL_ID="my-model"
export DHEVALS_MODEL_PROVIDER="my-provider"
export DHEVALS_MODEL_ADAPTER="command-line"
export DHEVALS_MODEL_CLI_COMMAND="my-model-cli --model my-model"
export DHEVALS_MODEL_CLI_PROMPT_MODE="stdin" # use "arg" when the CLI expects an argument
export DHEVALS_MODEL_CLI_TIMEOUT_SECONDS="120"
export DHEVALS_MODEL_CLI_CWD="/tmp/dhevals-model-sandbox"
export DHEVALS_MODEL_SUITE_PATH="benchmarks/suites/heavy-user-ptbr/v0.1/suite.json"
export DHEVALS_RUN_ID="my-model-heavy-user-v01"

npm run run:model
```

For an OpenCode-style CLI, the command can be configured like this:

```bash
export DHEVALS_MODEL_CLI_COMMAND="opencode run --pure --model provider/model"
export DHEVALS_MODEL_CLI_PROMPT_MODE="arg"
npm run run:model
```

Use an empty temporary `DHEVALS_MODEL_CLI_CWD` for agents that can read or edit
files. This keeps the evaluation isolated from the repository. Supported
placeholders are `{model}`, `{temperature}`, `{max_tokens}`, and `{prompt}`;
`{prompt}` is available when prompt mode is `arg`.

## Evaluate an OpenAI-compatible HTTP endpoint

```bash
export DHEVALS_MODEL_ID="hosted-model"
export DHEVALS_MODEL_PROVIDER="hosted-provider"
export DHEVALS_MODEL_ADAPTER="openai-compatible"
export DHEVALS_MODEL_BASE_URL="http://127.0.0.1:8000/v1"
export DHEVALS_MODEL_API_KEY_ENV="DHEVALS_MODEL_API_KEY"
export DHEVALS_MODEL_SUITE_PATH="benchmarks/suites/heavy-user-ptbr/v0.2/suite.json"
export DHEVALS_RUN_ID="hosted-model-heavy-user-v02"

npm run run:model
```

Keep API keys in the environment of the adapter or provider. Never place a
credential in a command string, manifest, report, or committed file.

## Public artifacts and verification

The console consumes derived artifacts such as:

- `public/data/latest-run.json`
- `public/data/latest-report.json`
- `public/data/latest-report.html`
- `public/data/latest-results.csv`
- `public/data/latest-verification.json`
- `public/data/leaderboard.json`
- `public/data/run-catalog.json`

Model runs are written to `reports/runs/<run-id>.*`. Before publishing a run,
verify its suite identity, prompts, task states, aggregates, and derived report:

```bash
npm run verify:run -- \
  --artifact public/data/latest-run.json \
  --suite benchmarks/suites/heavy-user-ptbr/v0.2/suite.json \
  --report public/data/latest-report.json
```

The release gate combines suite identity, audit status, verification,
calibration readiness, leaderboard policy, and non-fixture run evidence. A
quality score is never changed by estimated cost.

## Calibration and independent evaluations

Calibration templates and anchor packs live under
`benchmarks/calibration/heavy-user-ptbr/`. Useful commands include:

```bash
npm run build:calibration
npm run export:calibration:v02
npm run export:calibration:v03
npm run test:calibration-import
npm run test:independent
npm run test:judge-runner
```

Human review remains an explicit gate. The console stores reviewer drafts in
browser `localStorage`; canonical exports must be validated before import.

## Design and interaction

The console includes a Calibration reviewer workspace, source inspection,
evidence copying, responsive layouts, and a **Director view** composed for
16:9 recording. See:

- [DESIGN.md](./DESIGN.md) — visual tokens and interaction rules;
- [dashboard concept](./public/reference/dhevals-dashboard-concept.png) —
  approved visual reference;
- [v0 foundation](./docs/dhevals-v0-foundation.md) — functional contract and
  acceptance criteria;
- [public reporting](./docs/dhevals-public-reporting.md) — artifact and
  publication policy;
- [model adapters](./docs/dhevals-model-adapters.md) — CLI, HTTP, isolation,
  and comparison configuration.
- [public platform SDD](./docs/dhevals-public-platform-sdd.md) — public
  information architecture, data contract, routes, and release requirements;
- [public platform design system](./docs/dhevals-public-platform-design-system.md)
  — brand, tokens, components, visualization, motion, and social cards;
- [design LLM prompt](./docs/dhevals-public-platform-design-prompt.md) —
  copy/paste brief for generating the public platform design;
- [brand assets](./public/brand/) — versioned DHEvals logo SVGs.

## Repository layout

```text
benchmarks/              versioned suites, datasets, rubrics, and matrices
packages/dhevals_core/   Python evaluation core and tests
public/data/             checked-in artifacts consumed by the console
reports/                 fixture, calibration, audit, and model-run archives
scripts/                 catalog, runner, audit, and release tooling
src/                     React console
e2e/                     Playwright tests
docs/                    contracts, workflows, and research notes
```

## Safety and reproducibility

Do not commit credentials, private prompts, or unreviewed personal data. Keep
model configuration in local environment variables, record the exact suite and
model identity for every run, and treat generated reports as immutable evidence
once published.
