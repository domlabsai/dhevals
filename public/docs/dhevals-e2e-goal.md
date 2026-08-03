# Meta E2E do DHEvals

## Objetivo

Provar, com artefatos verificáveis, o caminho completo que começa na autoria de
uma suíte e termina na superfície pública usada para análise e gravação:

```text
suite versionada → hash/audit → fixture positivo/negativo
→ preflight/CLI smoke → adapter HTTP ou CLI → run do modelo → verify
→ report JSON/HTML/CSV/YouTube → catalogs → console
→ scorecard/dataset/experiment registries → API read-only → console
→ comparação multi-modelo → release gate
```

O SaciLM está em standby enquanto seu desenvolvimento não começa. A lane
principal do DHEvals é agnóstica: qualquer modelo com endpoint
OpenAI-compatible ou CLI local (OpenCode, Qwen, Kimi e equivalentes) pode ser
registrado e executado agora. Quando o SaciLM existir, ele entrará como mais
uma lane com manifesto próprio; Unsloth/RunPod não são requisitos do runner.

## Critérios de aceite

- uma suíte versionada valida e produz hash determinístico;
- o audit confirma tarefas, fixtures, rubrica, exemplos, anchors e registry;
- o fixture positivo completa 100% e o negativo expõe falhas de qualidade sem
  mascará-las como erro de infraestrutura;
- o preflight HTTP ou smoke de CLI registra identidade segura do modelo;
- o runner HTTP/CLI preserva prompts, ordem, configuração, métricas e manifesto
  quando houver um manifesto versionado;
- `dhevals-verify` valida run e report antes de qualquer promoção;
- os artefatos derivados alimentam run catalog, model catalog, leaderboard e
  console sem recalcular score no frontend;
- dataset catalog registra licença, privacidade, consumidores e proveniência;
- experiment catalog preserva configuração, métricas e hash do report;
- comparison execution contract registra as lanes escolhidas na mesma suíte,
  separa status de execução de score, define `primary_model_id` e mantém scores
  bloqueados antes do gate;
- scorecard mantém `not_evaluated` para dimensões sem evidência independente;
- API read-only retorna os mesmos artefatos sem permitir mutações;
- contratos independentes de judge, safety e agent/tool-use validam evidência,
  sinais de segurança e limites de aprovação;
- `dhevals-judge-run` executa uma rodada LLM-as-a-Judge por endpoint
  OpenAI-compatible, exige uma avaliação por dimensão e mantém o resultado
  independente do score determinístico;
- o artefato `latest-judge.json`, a rota `/api/v1/judge/latest` e o painel
  Reports exibem `not_evaluated` explicitamente quando a lane independente ainda
  não foi configurada, sem transformar a baseline fixture em nota de juiz;
- o check `blueprint_components` rastreia os 13 componentes da DOMEvals §13.1
  até código e artefatos, documentados em `dhevals-blueprint-traceability.md`;
- o modo Director e o pacote factual do YouTube são derivados do report;
- `run:model` executa uma lane HTTP ou CLI em archive-only, e `run:comparison`
  compara os modelos registrados com a mesma suíte;
- o release gate bloqueia fixture, rodada incompleta, manifesto `draft` ou
  calibração pendente;
- uma tentativa de promoção é staged fora de `public/data` e só toca a
  baseline depois que o release gate retorna `ready`;
- o workspace de calibração permite revisão local 0–4 e exporta CSV cego com o
  nome canônico do pack, mas nunca fabrica ou publica notas;
- o E2E Playwright comprova sincronização, histórico, registry, calibração,
  exportações, Director view e refresh sem alterar a baseline pública.
- o mesmo E2E verifica a console em viewport estreita, navegação horizontal e
  tabelas roláveis sob `prefers-reduced-motion`;
- `test:calibration-ready` percorre, em diretório temporário, duas planilhas
  completas e 600 respostas até `ready`, sem transformar scores sintéticos em
  calibração humana pública.
- a console Settings expõe o checklist seguro de readiness por gate, e os
  documentos operacionais apontados pela interface são servidos como Markdown
  no build de produção (não como fallback HTML da SPA).
- `test:matrix` executa os cenários positivo/negativo das versões v0.2 e v0.3,
  valida report/verify e materializa `test-execution-latest.json`.
- a matriz publica `scorecard_coverage` para as 14 dimensões do scorecard, e o
  grader matrix testa respostas positivas, negativas, vazias, malformadas e
  adversariais em todas as tarefas v0.3;
- `test:independent` executa os contratos judge, safety e agent em fixtures
  versionados e confirma que o scorecard público não é alterado.
- `test:model-cli` comprova uma comparação completa por CLI, sem shell e sem
  exigir qualquer artefato do SaciLM.
- `test:comparison-wrapper` verifica as duas lanes HTTP, o artefato de comparação
  arquivado e que nenhum score é exposto antes da promoção.

## Evidência executável

```bash
npm run test:benchmarks
npm run validate:test-matrix
npm run test:matrix
npm run test:independent
npm run test:judge-runner
npm run build:comparison-execution
npm run run:negative:v03
npm run audit:expanded
npm run test:sacilm-preflight
npm run test:sacilm-e2e
npm run test:sacilm-wrapper
npm run test:sacilm-promotion
npm run test:sacilm-promotion-ready
npm run test:manifest-finalizer
npm run test:calibration-import
npm run test:calibration-ready
npm run test:comparison-wrapper
npm run test:comparison-promotion
npm run test:api
npm run test:public-docs
npm run build
npm run test:production-bundle
npm run test:e2e
```

`npm run test:platform` é o atalho de evidência completa: executa a suíte
unitária, a matriz, preflight/HTTP, bloqueios e promoção staged, comparação,
API, build e Playwright. Ao terminar, regera `run:calibration` para devolver a
baseline fixture ao estado conhecido.

`npm run audit:goal` materializa `reports/audits/dhevals-goal-latest.json` e
`public/data/latest-goal-audit.json`. O artefato separa `local_status` — o E2E
offline que já pode ser verificado — de `external_status`, que permanece
pendente até o endpoint/checkpoint real e a calibração humana. A auditoria
também confirma que os dois CSVs cegos v0.3 possuem 300 linhas cada e zero
notas antes da revisão.

Esse diagnóstico é servido pela rota read-only `GET /api/v1/readiness/dhevals` e
aparece na aba Settings da console junto do handoff de calibração.

Os wrappers usam endpoints/CLIs locais descartáveis e exercitam o mesmo
contrato de execução. Eles validam o E2E offline sem inventar uma rodada real
de nenhum modelo.

## Gates ainda externos

O caminho local está validado. Para publicar uma rodada de qualquer modelo,
faltam:

1. endpoint ou CLI real, identidade/proveniência registradas e credenciais
   somente no ambiente;
2. duas revisões independentes dos 300 grupos v0.3, seguidas de adjudicação e
   congelamento da rubrica.

O manifesto e o endpoint do SaciLM permanecem explicitamente adiados. A
readiness já inicia em `standby` por padrão; se necessário, use
`DHEVALS_SACILM_EVALUATION_MODE=standby` explicitamente. A auditoria marca os
quatro checks do SaciLM como `deferred`, sem bloquear a execução de outras
lanes.

Até esses gates passarem, a v0.2 continua sendo a baseline pública de
desenvolvimento e qualquer execução v0.3 permanece arquivada.

`npm run check:sacilm-readiness` materializa um diagnóstico seguro em
`reports/readiness/sacilm-latest.json`: ele confirma manifesto, endpoint,
preflight, registry, execução da matriz e os dois tracks de calibração sem
registrar valores de endpoint ou credenciais.
