# API read-only do DHEvals

O servidor opcional expõe os artefatos já materializados pela pipeline. Ele
não executa modelos, não grava resultados e não recebe chaves. Isso mantém a
console, o site público e os vídeos consumindo a mesma fonte verificável.

```bash
npm run build:dataset-catalog
npm run build:experiment-catalog
npm run build:comparison-execution
npm run build:scorecard
npm run api
```

Por padrão, o processo escuta `127.0.0.1:8787`. Ajuste
`DHEVALS_API_HOST`, `DHEVALS_API_PORT` e `DHEVALS_API_ALLOW_ORIGIN` no ambiente
de deploy. Em produção, coloque-o atrás de um proxy com autenticação e TLS;
os artefatos continuam sem segredos.

## Rotas

| Rota | Artefato | Uso |
| --- | --- | --- |
| `GET /healthz` | diagnóstico | readiness do processo |
| `GET /api/v1/runs/latest` | `latest-run.json` | execução pública atual |
| `GET /api/v1/reports/latest` | `latest-report.json` | report canônico |
| `GET /api/v1/reports/youtube/latest` | `latest-youtube-pack.json` | pacote factual para vídeo |
| `GET /api/v1/runs` | `run-catalog.json` | histórico e publicação |
| `GET /api/v1/models` | `model-catalog.json` | registry de modelos |
| `GET /api/v1/suites` | `suite-catalog.json` | versões/hashes das suítes |
| `GET /api/v1/datasets` | `dataset-catalog.json` | licença, privacidade e origem |
| `GET /api/v1/scorecards/latest` | `latest-scorecard.json` | scorecard transparente |
| `GET /api/v1/judge/latest` | `latest-judge.json` | estado do LLM-as-a-Judge independente |
| `GET /api/v1/calibration` | `latest-calibration.json` | gate humano |
| `GET /api/v1/calibration/v0.3/handoff` | `calibration/v0.3/handoff.json` | pacote/fingerprint e estado de distribuição da revisão |
| `GET /api/v1/experiments` | `experiment-catalog.json` | lineage de runs |
| `GET /api/v1/comparisons/latest` | `comparison-execution-latest.json` | lanes same-suite e bloqueio de score |
| `GET /api/v1/test-matrices` | `test-matrix-catalog.json` | contrato executável de testes |
| `GET /api/v1/test-executions/latest` | `test-execution-latest.json` | última execução offline dos cenários |
| `GET /api/v1/leaderboard` | `leaderboard.json` | ranking e bloqueios |
| `GET /api/v1/release-gate` | `latest-release-gate.json` | decisão de publicação |
| `GET /api/v1/readiness/sacilm` | `latest-sacilm-readiness.json` | checklist seguro dos gates externos |
| `GET /api/v1/readiness/dhevals` | `latest-goal-audit.json` | auditoria E2E local versus gates externos |

Qualquer método de escrita retorna `405`. Um artefato ausente retorna `404`, em
vez de um score parcial inventado. `npm run test:api` inicia um processo
isolado, verifica todas as rotas, confirma o bloqueio de escrita e procura
campos que pareçam credenciais.
