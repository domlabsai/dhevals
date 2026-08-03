# DHEvals

[English](./README.md) · [Português (Brasil)](./README.pt-BR.md)

O DHEvals é uma console pública e um harness de avaliação para medir modelos
de IA em tarefas realistas de heavy user. Ele combina suítes reproduzíveis,
checks determinísticos, adapters de modelos, fluxos de calibração e artefatos
públicos de execução para pesquisa, engenharia e análise de benchmarks gravada.

## O que este repositório contém

- Uma console React/Vite para explorar execuções, tarefas, evidências,
  calibração e dados do leaderboard.
- O pacote Python `dhevals_core` para suítes, adapters, grading, verificação,
  auditorias, calibração e release gates.
- Suítes heavy-user em português do Brasil cobrindo síntese de pesquisa, QA de
  documentos, planejamento, análise de dados, geração de código, escrita e
  tarefas relacionadas.
- Lanes CLI e HTTP compatível com OpenAI para provedores locais, hospedados e
  de assinatura.
- Artefatos versionados em JSON, CSV e HTML em `public/data/` e `reports/`.
- Lanes independentes para safety, uso de agentes/ferramentas e LLM-as-a-Judge
  sem alterar silenciosamente o score determinístico.

## Escopo atual

- **v0.1** — seis tarefas heavy-user focadas e uma lane controlada de avaliação
  por CLI.
- **v0.2** — baseline com dez categorias, fixtures, estruturas de calibração e
  artefatos de publicação pública.
- **v0.3** — matriz offline expandida com 20 tarefas, 60 dimensões e 300 grupos
  de âncoras.

O DHEvals é agnóstico ao modelo. A console pública mantém um fixture
determinístico como baseline; execuções reais são arquivadas em `reports/runs/`
e não substituem a baseline pública de forma implícita.

## Requisitos

- Node.js 20 ou superior
- Python 3.12
- [`uv`](https://docs.astral.sh/uv/)

## Rodar a console localmente

```bash
npm install
npm run dev
```

Abra a URL exibida pelo Vite (normalmente `http://localhost:5173/`). A console
lê os artefatos públicos mais recentes em `public/data/` e continua funcionando
com os fixtures versionados quando nenhum endpoint de modelo está configurado.

## Rodar a suíte de validação

```bash
# Testes Python de benchmark e grading
npm run test:benchmarks

# Smoke test do adapter CLI
npm run test:model-cli

# Teste da console no navegador
npm run test:e2e

# Regressão completa da plataforma; restaura a baseline fixture ao final
npm run test:platform
```

## Gerar execuções offline e catálogos

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

Os reports gerados incluem scores determinísticos, checks, latência, uso de
tokens quando disponível, hashes das suítes, metadados de verificação e um
pacote-resumo pronto para YouTube.

## Avaliar um modelo por CLI local

O runner genérico aceita qualquer executável que receba o prompt por stdin ou
como argumento. O prompt é enviado sem interpolação em shell, cada tarefa tem
seu próprio timeout e falhas continuam sendo erros de infraestrutura, em vez
de serem convertidas em zeros de qualidade.

```bash
export DHEVALS_MODEL_ID="meu-modelo"
export DHEVALS_MODEL_PROVIDER="meu-provedor"
export DHEVALS_MODEL_ADAPTER="command-line"
export DHEVALS_MODEL_CLI_COMMAND="meu-cli --model meu-modelo"
export DHEVALS_MODEL_CLI_PROMPT_MODE="stdin" # use "arg" quando o CLI espera argumento
export DHEVALS_MODEL_CLI_TIMEOUT_SECONDS="120"
export DHEVALS_MODEL_CLI_CWD="/tmp/dhevals-model-sandbox"
export DHEVALS_MODEL_SUITE_PATH="benchmarks/suites/heavy-user-ptbr/v0.1/suite.json"
export DHEVALS_RUN_ID="meu-modelo-heavy-user-v01"

npm run run:model
```

Para um CLI no estilo OpenCode, configure o comando assim:

```bash
export DHEVALS_MODEL_CLI_COMMAND="opencode run --pure --model provider/model"
export DHEVALS_MODEL_CLI_PROMPT_MODE="arg"
npm run run:model
```

Use um `DHEVALS_MODEL_CLI_CWD` temporário e vazio para agentes que podem ler ou
editar arquivos. Isso mantém a avaliação isolada do repositório. Os
placeholders aceitos são `{model}`, `{temperature}`, `{max_tokens}` e
`{prompt}`; `{prompt}` fica disponível quando o modo do prompt é `arg`.

## Avaliar um endpoint HTTP compatível com OpenAI

```bash
export DHEVALS_MODEL_ID="modelo-hospedado"
export DHEVALS_MODEL_PROVIDER="provedor-hospedado"
export DHEVALS_MODEL_ADAPTER="openai-compatible"
export DHEVALS_MODEL_BASE_URL="http://127.0.0.1:8000/v1"
export DHEVALS_MODEL_API_KEY_ENV="DHEVALS_MODEL_API_KEY"
export DHEVALS_MODEL_SUITE_PATH="benchmarks/suites/heavy-user-ptbr/v0.2/suite.json"
export DHEVALS_RUN_ID="modelo-hospedado-heavy-user-v02"

npm run run:model
```

Mantenha chaves de API no ambiente do adapter ou do provedor. Nunca coloque uma
credencial na string do comando, no manifesto, no report ou em um arquivo
versionado.

## Artefatos públicos e verificação

A console consome artefatos derivados como:

- `public/data/latest-run.json`
- `public/data/latest-report.json`
- `public/data/latest-report.html`
- `public/data/latest-results.csv`
- `public/data/latest-verification.json`
- `public/data/leaderboard.json`
- `public/data/run-catalog.json`

As execuções de modelos são gravadas em `reports/runs/<run-id>.*`. Antes de
publicar uma execução, verifique identidade da suíte, prompts, estados das
tarefas, agregações e report derivado:

```bash
npm run verify:run -- \
  --artifact public/data/latest-run.json \
  --suite benchmarks/suites/heavy-user-ptbr/v0.2/suite.json \
  --report public/data/latest-report.json
```

O release gate combina identidade da suíte, status da auditoria, verificação,
prontidão da calibração, política do leaderboard e evidência de uma execução
não-fixture. Um score de qualidade nunca é alterado pelo custo estimado.

## Calibração e avaliações independentes

Templates de calibração e pacotes de âncoras ficam em
`benchmarks/calibration/heavy-user-ptbr/`. Comandos úteis:

```bash
npm run build:calibration
npm run export:calibration:v02
npm run export:calibration:v03
npm run test:calibration-import
npm run test:independent
npm run test:judge-runner
```

A revisão humana continua sendo um gate explícito. A console mantém rascunhos
dos revisores no `localStorage` do navegador; exports canônicos precisam ser
validados antes da importação.

## Design e interação

A console inclui workspace de revisão de Calibration, inspeção de fontes,
cópia de evidências, layouts responsivos e uma **Director view** composta para
gravação em 16:9. Consulte:

- [DESIGN.md](./DESIGN.md) — tokens visuais e regras de interação;
- [conceito do dashboard](./public/reference/dhevals-dashboard-concept.png) —
  referência visual aprovada;
- [fundação v0](./docs/dhevals-v0-foundation.md) — contrato funcional e
  critérios de aceite;
- [public reporting](./docs/dhevals-public-reporting.md) — política de
  artefatos e publicação;
- [model adapters](./docs/dhevals-model-adapters.md) — configuração de CLI,
  HTTP, isolamento e comparações.
- [SDD da plataforma pública](./docs/dhevals-public-platform-sdd.md) —
  arquitetura, rotas, contrato de dados e requisitos de release;
- [Design System da plataforma pública](./docs/dhevals-public-platform-design-system.md)
  — marca, tokens, componentes, visualização, motion e social cards;
- [prompt para LLM de design](./docs/dhevals-public-platform-design-prompt.md)
  — briefing pronto para copiar e gerar o design da plataforma;
- [assets da marca](./public/brand/) — SVGs versionados do logo DHEvals.

## Estrutura do repositório

```text
benchmarks/              suítes, datasets, rubricas e matrizes versionados
packages/dhevals_core/   núcleo Python de avaliação e testes
public/data/             artefatos versionados consumidos pela console
reports/                 arquivos de fixtures, calibração, auditoria e runs
scripts/                 ferramentas de catálogo, execução, auditoria e release
src/                     console React
e2e/                     testes Playwright
docs/                    contratos, workflows e notas de pesquisa
```

## Segurança e reprodutibilidade

Não faça commit de credenciais, prompts privados ou dados pessoais não
revisados. Mantenha a configuração do modelo em variáveis de ambiente locais,
registre a identidade exata da suíte e do modelo em cada execução e trate os
reports publicados como evidência imutável.
