# DHEvals — traceability do Blueprint

Esta matriz liga os componentes da DOMEvals Platform descritos no Blueprint
(§13.1) à implementação atual do produto DHEvals. O objetivo é tornar a
auditoria verificável: cada linha aponta para código e, quando aplicável, para
um artefato público derivado.

| Componente do Blueprint | Implementação | Evidência pública |
| --- | --- | --- |
| Benchmark Engine | `dhevals_core.models`, `grading`, `audit` | suítes versionadas, matriz e auditorias |
| Dataset Registry | `scripts/build-dataset-catalog.mjs` | `public/data/dataset-catalog.json` |
| Evaluation Runner | `dhevals_core.runner`, adapters HTTP/CLI, `scripts/run-model.mjs` | `latest-run.json`, reports e verify |
| LLM-as-a-Judge Engine | `judge.py`, `judge_runner.py` | `latest-judge.json`, `/api/v1/judge/latest` |
| Human Evaluation Module | `calibration.py`, `calibration_sheet.py`, console reviewer | handoff e progress v0.3 |
| Safety Evaluation Suite | `safety.py` e suite safety pt-BR | artifact safety independente |
| Agent Evaluation Suite | `agent.py` e policy de traces | artifact agent independente |
| Dashboard | `src/App.jsx` e `src/CalibrationReviewer.jsx` | bundle `dist` e Playwright |
| API | `scripts/dhevals-api-server.mjs` | rotas read-only `/api/v1/*` |
| Leaderboard | `leaderboard.py`, `build-leaderboard.mjs` | `public/data/leaderboard.json` |
| Scorecards | `scorecard.py`, `build-scorecard.mjs` | `public/data/latest-scorecard.json` |
| Experiment Tracking | `build-experiment-catalog.mjs` | `public/data/experiment-catalog.json` |
| Reporting Engine | `reporting.py`, `build-report-artifacts.mjs` | JSON, HTML, CSV e YouTube pack |

O check `blueprint_components` em `npm run audit:goal` verifica a existência
de todos os caminhos desta tabela. A presença do componente não implica que
os gates externos estejam concluídos: endpoint/proveniência de uma lane real e
calibração humana continuam sendo estados separados da auditoria. O SaciLM é
uma lane futura e pode permanecer em `standby`.
