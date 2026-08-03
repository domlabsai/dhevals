# DHEvals Console

Console pública e núcleo de benchmark do DHEvals para avaliar modelos de IA em tarefas heavy-user, com lanes de CLI/HTTP, calibração e resultados reproduzíveis para pesquisa, análise e gravação de YouTube. O SaciLM é uma lane futura; a suíte já aceita OpenCode, Qwen, Kimi e outros modelos.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra o endereço exibido pelo Vite. A console consome o artefato mais recente em `public/data/`; fixtures continuam disponíveis para desenvolvimento offline e o mesmo contrato aceita rodadas reais de qualquer modelo compatível.

## Rodar o núcleo de benchmarks

```bash
npm run test:benchmarks
npm run test:model-cli # smoke E2E de uma lane CLI sem SaciLM
npm run run:fixture
npm run run:calibration
npm run run:negative
npm run run:negative:v03
npm run run:model # lane genérica para endpoint HTTP ou CLI local
npm run audit:benchmarks
npm run build:release-gate
npm run build:report
npm run build:calibration
npm run build:leaderboard
npm run build:suite-catalog
npm run build:run-catalog
npm run build:model-catalog
npm run build:dataset-catalog
npm run build:experiment-catalog
npm run build:comparison-execution
npm run build:scorecard
npm run build:calibration-review-data
npm run build:test-matrix
npm run validate:test-matrix
npm run test:matrix # executa positivo/negativo e verifica reports das versões v0.2/v0.3
npm run audit:goal # audita a meta E2E e separa gates locais de gates externos
npm run build:calibration-handoff # gera o handoff verificável dos 300 grupos v0.3
npm run test:independent # valida judge, safety e agent sem alterar scorecard público
npm run test:judge-runner # executa o LLM-as-a-Judge via endpoint compatível
npm run validate:sacilm-manifest
npm run validate:sacilm-ready # somente depois de congelar checkpoint/dataset/proveniência
npm run finalize:sacilm-manifest # lê DHEVALS_SACILM_* e grava model-ready.json
npm run test:calibration-import
npm run test:sacilm-preflight
npm run test:sacilm-e2e
npm run test:sacilm-wrapper
npm run test:sacilm-promotion
npm run test:sacilm-promotion-ready
npm run test:comparison-wrapper
npm run test:comparison-promotion
npm run test:api
npm run test:public-docs # confirma que a documentação pública não divergiu da fonte
npm run test:production-bundle # confirma que o build contém console, dados e docs
npm run export:calibration:v03
npm run verify:run -- --artifact public/data/latest-run.json --suite benchmarks/suites/heavy-user-ptbr/v0.2/suite.json --report public/data/latest-report.json
npm run test:e2e
npm run test:platform # regressão E2E completa; restaura a baseline fixture ao final
```

Para autoria e versionamento sem editar hashes manualmente:

```bash
uv run --python 3.12 --project packages/dhevals_core dhevals-suite validate \
  --suite benchmarks/suites/heavy-user-ptbr/v0.2/suite.json
uv run --python 3.12 --project packages/dhevals_core dhevals-suite hash \
  --suite benchmarks/suites/heavy-user-ptbr/v0.2/suite.json
```

`dhevals-suite scaffold` cria um manifesto inicial e `dhevals-suite bump` grava uma nova versão em outro arquivo, preservando o original.

`npm run run:fixture` gera `reports/fixtures/sacilm-heavy-user-fixture-run.json`. Ele executa a suíte histórica v0.1 com o adapter offline e registra score, checks, latência, tokens, cobertura e hash da suíte. Para a matriz heavy-user atual, use `npm run run:calibration`; para trocar o fixture por um endpoint compatível com chat completions, use `npm run run:sacilm` e mantenha o mesmo manifesto v0.2.

Depois de `npm run finalize:sacilm-manifest`, os comandos de readiness,
preflight, execução, comparação e auditoria preferem automaticamente
`benchmarks/models/sacilm/v0.1/model-ready.json`. Defina
`DHEVALS_SACILM_MODEL_MANIFEST` somente quando quiser apontar explicitamente
para outro manifesto.

O `test:e2e` sobe uma console isolada em `127.0.0.1:4174` por padrão (ou na porta definida por `DHEVALS_E2E_PORT`), executa uma rodada fixture do zero, verifica que o artefato chegou à interface e exercita seleção de tarefa, sources, Director view e refresh de uma segunda rodada. O Browser plugin não é necessário: o projeto usa o Playwright instalado como dependência de desenvolvimento.

A console lê `public/data/latest-run.json` e faz polling a cada 5 segundos. Depois de uma nova execução, aguarde esse intervalo, clique em `Refresh run` ou recarregue `http://localhost:5173/`.

Os registries de dataset, experimentos, comparação e scorecard são artefatos derivados e
também podem ser servidos pelo API read-only documentado em
[docs/dhevals-api.md](./docs/dhevals-api.md). O scorecard mantém dimensões sem
medição como `not_evaluated`; safety, agentic e LLM-as-a-Judge só aparecem como
avaliados quando seus artefatos independentes passam por contrato próprio.
O contrato `comparison-execution-latest.json` registra as lanes SaciLM/baseline
na mesma suíte, mas mantém scores `locked` até o release gate e a calibração
humana, inclusive quando a execução foi apenas arquivada.

Na aba **Calibration**, `Open reviewer workspace` abre a revisão operacional dos anchors. O workspace carrega a matriz v0.3 por padrão (300 grupos), permite filtrar tarefa/dimensão, marcar uma nota de 0 a 4 e registrar notas de adjudicação. O rascunho fica somente no `localStorage` do navegador; use `Export blind CSV` para gerar o arquivo canônico e `Validate CSV` para reimportá-lo localmente, conferir nome, cabeçalho, ordem, anchors e scores antes do `import-blind --pack`. Nenhuma nota humana é fabricada ou gravada em `public/data` pela console.

Para executar o SaciLM real, exponha no RunPod um endpoint compatível com `POST /v1/chat/completions` e use:

O ponto de partida sem credenciais está em [.env.example](./.env.example); carregue-o apenas no shell local e mantenha chaves fora do repositório.

```bash
export DHEVALS_SACILM_BASE_URL="https://seu-endpoint/v1"
export DHEVALS_SACILM_API_KEY="..." # opcional, nunca gravar no repositório
export DHEVALS_SACILM_CHECKPOINT="sacilm/checkpoint-or-revision"
export DHEVALS_SACILM_RUNTIME="Unsloth + vLLM on RunPod"
export DHEVALS_SACILM_TRAINING_COMMIT="git-sha-do-post-training"
export DHEVALS_SACILM_MODEL_MANIFEST="benchmarks/models/sacilm/v0.1/model.json"
# Opcional: preço contratado em USD por 1.000 tokens
export DHEVALS_SACILM_INPUT_COST_PER_1K="0.00"
export DHEVALS_SACILM_OUTPUT_COST_PER_1K="0.00"
npm run preflight:sacilm
npm run check:sacilm-readiness
npm run run:sacilm
```

O preflight valida o contrato em uma única chamada antes de consumir a rodada completa. Depois, `run:sacilm` usa a suíte heavy-user v0.2 por padrão, grava a rodada em `public/data/latest-run.json` para a console e arquiva uma cópia imutável em `reports/runs/<run-id>.json`. O contrato completo do endpoint está em [docs/dhevals-sacilm-runtime-contract.md](./docs/dhevals-sacilm-runtime-contract.md). O roteiro seguro da primeira rodada real está em [docs/dhevals-sacilm-run-checklist.md](./docs/dhevals-sacilm-run-checklist.md).

Para avaliar as dimensões independentes com um LLM-as-a-Judge, use um endpoint compatível separado (a chave fica somente no ambiente):

```bash
export DHEVALS_JUDGE_BASE_URL="https://seu-juiz/v1"
export DHEVALS_JUDGE_API_KEY="..."
uv run --python 3.12 --project packages/dhevals_core dhevals-judge-run \
  --run reports/runs/<run-id>.json \
  --rubric benchmarks/calibration/heavy-user-ptbr/v0.3/anchor-rubric.json \
  --base-url "$DHEVALS_JUDGE_BASE_URL" \
  --api-key-env DHEVALS_JUDGE_API_KEY \
  --model-id "${DHEVALS_JUDGE_MODEL_ID:-judge}" \
  --output reports/runs/<run-id>.judge.json
```

O runner exige uma avaliação por dimensão, normaliza a escala humana 0–4 para 0–1 e marca o artefato como `invalid` quando houver falha ou omissão; ele nunca substitui o score determinístico.

O manifesto do SaciLM registra base model, licença, dataset/hash, configuração do Unsloth, quantização, RunPod, runtime de inferência e geração. Ele é embutido no artefato com um hash canônico; permanece `draft` até os campos `pending-*` serem substituídos e nunca contém chaves de API.
As alternativas de pós-training, serving e tracking estão catalogadas em
[docs/dhevals-post-training-tooling.md](./docs/dhevals-post-training-tooling.md),
sem transformar nenhuma delas em dependência do runner.

Se `DHEVALS_SACILM_SUITE_PATH` apontar para a v0.3 expandida, o comportamento padrão é archive-only: a rodada e seus reports são verificados em `reports/runs/` sem substituir os artefatos públicos da v0.2. A promoção exige `DHEVALS_SACILM_PROMOTE=1`.

Cada rodada também gera `public/data/latest-report.json`, `public/data/latest-report.html`, `public/data/latest-results.csv`, `public/data/latest-youtube-pack.json`, `public/data/latest-verification.json` e `public/data/leaderboard.json`. `npm run audit:benchmarks` valida a matriz v0.2 inteira e publica `public/data/latest-audit.json`. O preflight publica seu diagnóstico seguro em `public/data/latest-preflight.json`. O leaderboard mantém fixtures e rodadas incompletas como `locked`; nenhum score de fixture é publicado como ranking.

`npm run build:suite-catalog` atualiza `public/data/suite-catalog.json` com todas as versões encontradas, seus hashes, quantidade de tarefas, auditoria e progresso de calibração. A aba **Datasets** exibe esse registry e identifica qual versão está alimentando a console pública.

Antes de qualquer promoção, o verificador `dhevals-verify` confirma que o hash, versão, prompts, tarefas, estados, agregações e relatório derivado ainda correspondem ao manifesto original. Os scripts de fixture, SaciLM e comparação executam esse gate automaticamente. Quando preços opcionais são configurados, o runner também registra `estimated_cost_usd` por tarefa e no total da rodada; custo nunca altera o score de qualidade.

Quando os endpoints/CLIs estiverem configurados no registry, `npm run run:comparison` executa a mesma suíte para cada modelo, arquiva os resultados em `reports/runs/` e registra configurações ausentes como `skipped` em `reports/comparisons/latest.json`. A comparação é archive-only por padrão; a promoção exige `DHEVALS_COMPARISON_PROMOTE=1` e um `primary_model_id` concluído.

O DHEvals também pode executar qualquer modelo por um CLI local, sem depender de
manifesto do SaciLM. Defina `DHEVALS_MODEL_ID`, `DHEVALS_MODEL_ADAPTER=command-line`
e `DHEVALS_MODEL_CLI_COMMAND` (o prompt vai por `stdin` por padrão) e rode
`npm run run:model`. O comando é executado sem shell, com timeout por tarefa, e
gera somente artefatos arquivados em `reports/runs/`. Exemplos para OpenCode,
Qwen e Kimi, incluindo o modo de prompt como argumento, estão em
[docs/dhevals-model-adapters.md](./docs/dhevals-model-adapters.md).

A matriz heavy-user v0.2 já está versionada em [benchmarks/suites/heavy-user-ptbr/v0.2/suite.json](./benchmarks/suites/heavy-user-ptbr/v0.2/suite.json), cobrindo dez categorias. O fixture correspondente passa por todos os checks determinísticos; as notas humanas ainda permanecem em estado `draft` em [anchor-rubric.json](./benchmarks/calibration/heavy-user-ptbr/v0.2/anchor-rubric.json), com exemplos de cinco níveis em [anchor-examples.json](./benchmarks/calibration/heavy-user-ptbr/v0.2/anchor-examples.json).

A matriz expandida v0.3 está em [docs/dhevals-heavy-user-v03.md](./docs/dhevals-heavy-user-v03.md): 20 tarefas, 60 dimensões e 300 grupos de âncora. Ela é auditada e executada offline em `reports/`, mas não substitui a baseline v0.2 da console até passar pela revisão humana e pelo endpoint real.

As lanes independentes de LLM-as-a-Judge, safety e agent/tool-use estão em
`packages/dhevals_core/src/dhevals_core/{judge,safety,agent}.py`. Cada uma exige
evidência, identidade da rubrica/política e agregação reproduzível; nenhuma
altera silenciosamente a pontuação determinística da suíte heavy-user.

O contrato executável de casos está em `benchmarks/tests/heavy-user-ptbr/v0.2/test-matrix.json` e `v0.3/test-matrix.json`. Cada tarefa tem cenário positivo e negativo, checks determinísticos, dimensões de rubrica, lanes de adapter/modelo e invariantes de infraestrutura. `npm run validate:test-matrix` detecta qualquer drift entre suíte, fixtures, rubrica, exemplos e registry; o catálogo resumido fica em `public/data/test-matrix-catalog.json`.
O campo `scorecard_coverage` registra a rota de evidência das 14 dimensões do
scorecard sem transformar dimensões ainda sem artefato em notas. Veja a
[matriz de cobertura do scorecard](./docs/dhevals-scorecard-coverage.md).

Antes de publicar uma rodada, o release gate consolida a decisão em [latest-release-gate.json](./public/data/latest-release-gate.json). Ele exige simultaneamente identidade da suíte, auditoria `ready`, verificação válida, calibração humana `ready`, leaderboard sem fixtures e uma rodada não-fixture. A promoção do SaciLM é staged fora de `public/data` e só substitui a baseline após o gate retornar `ready`; `npm run test:sacilm-promotion` cobre o bloqueio de manifesto `draft`. `npm run build:release-gate` sempre materializa o diagnóstico para a console; `npm run check:release` é a versão estrita para CI e retorna código diferente de zero quando a publicação está bloqueada.

O gate de calibração exige duas notas por cada uma das 150 combinações tarefa/dimensão/âncora. O template está em [responses-template.json](./benchmarks/calibration/heavy-user-ptbr/v0.2/responses-template.json); para validar uma rodada preenchida:

```bash
uv run --python 3.12 --project packages/dhevals_core dhevals-calibration \
  --rubric benchmarks/calibration/heavy-user-ptbr/v0.2/anchor-rubric.json \
  --responses benchmarks/calibration/heavy-user-ptbr/v0.2/responses-template.json \
  --output reports/calibration/heavy-user-ptbr-v0.2-summary.json
```

O template vazio retorna `pending` por design; desacordo maior que um ponto retorna `adjudication_required`.

Para transformar a revisão em uma planilha operacional e importar as notas sem editar JSON manualmente:

```bash
uv run --python 3.12 --project packages/dhevals_core dhevals-calibration-sheet export \
  --rubric benchmarks/calibration/heavy-user-ptbr/v0.2/anchor-rubric.json \
  --examples benchmarks/calibration/heavy-user-ptbr/v0.2/anchor-examples.json \
  --output reports/calibration/heavy-user-ptbr-v0.2-review.csv

uv run --python 3.12 --project packages/dhevals_core dhevals-calibration-sheet import \
  --sheet reports/calibration/heavy-user-ptbr-v0.2-review.csv \
  --rubric benchmarks/calibration/heavy-user-ptbr/v0.2/anchor-rubric.json \
  --output benchmarks/calibration/heavy-user-ptbr/v0.2/responses-reviewed.json
```

O fluxo completo, incluindo adjudicação, está em [docs/dhevals-calibration-workflow.md](./docs/dhevals-calibration-workflow.md).
Os pacotes cegos incluem `pack.json`, que fixa hashes da rubrica/exemplos e a impressão digital das âncoras antes de qualquer nota humana.
Para preservar a independência dos revisores, prefira os subcomandos `export-blind` e `import-blind` descritos nesse workflow.

A meta e os critérios de aceite do caminho completo estão em [docs/dhevals-e2e-goal.md](./docs/dhevals-e2e-goal.md). Os wrappers locais validam o contrato de ponta a ponta sem substituir a rodada real do SaciLM.

Depois de importar ou atualizar as notas, `npm run build:calibration` materializa `public/data/latest-calibration.json`. A aba **Calibration** da console mostra cobertura, revisores, desacordos, adjudicações e as fontes do artefato; o status continua `pending`/`adjudication_required` até o gate realmente estar pronto.
`npm run build:calibration-review-data` (executado também por `run:fixture` e `run:calibration`) publica apenas os dados de rubric/exemplos necessários ao workspace, separados por versão em `public/data/calibration/v0.2/` e `public/data/calibration/v0.3/`.

## Interações da slice

- selecionar uma tarefa na tabela ou uma categoria no gráfico;
- abrir as fontes no inspector;
- copiar manifesto/evidência e simular exportação;
- alternar `Director view` para uma composição sem navegação, própria para captura 16:9;
- usar layout responsivo em viewport mobile.

## Referências de design

- [DESIGN.md](./DESIGN.md) — tokens, tipografia e regras visuais;
- [concept visual](./public/reference/dhevals-dashboard-concept.png) — referência aprovada para a primeira tela;
- [foundation do DHEvals v0](./docs/dhevals-v0-foundation.md) — contrato funcional e critérios de aceite.
