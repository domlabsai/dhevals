# DHEvals — matriz heavy-user v0.3 expandida

A v0.2 continua sendo a baseline pública de desenvolvimento com 10 tarefas. A v0.3 adiciona um segundo caso em cada uma das dez categorias, sem alterar o manifesto nem os hashes da v0.2.

## Escopo

- 20 tarefas em pt-BR;
- 10 categorias, com dois casos por categoria;
- 60 dimensões de rubrica;
- 300 grupos de âncora (tarefa × dimensão × níveis 0–4);
- fixtures positivo e negativo reproduzíveis;
- registry de comparação com a mesma política de geração e calibração.
- contrato `scorecard_coverage` com rota de evidência para as 14 dimensões do
  scorecard, mantendo dimensões sem artefato como não avaliadas.

O gerador versionado está em `scripts/scaffold-heavy-user-v03.mjs`. Para recriar os artefatos determinísticos:

```bash
npm run scaffold:expanded
```

## Auditoria e execução offline

```bash
npm run audit:expanded
npm run run:expanded
```

O fluxo expandido grava somente em `reports/`; não substitui `public/data/latest-run.json` nem a baseline da console. A auditoria exige cobertura 100% no fixture positivo, ausência de `error` no fixture negativo, 20 tarefas, 60 dimensões e 300 âncoras.

## Calibração cega

As planilhas já podem ser regeneradas com:

```bash
uv run --python 3.12 --project packages/dhevals_core dhevals-calibration-sheet export-blind \
  --rubric benchmarks/calibration/heavy-user-ptbr/v0.3/anchor-rubric.json \
  --examples benchmarks/calibration/heavy-user-ptbr/v0.3/anchor-examples.json \
  --output-dir reports/calibration/heavy-user-ptbr-v0.3-blind \
  --manifest-output reports/calibration/heavy-user-ptbr-v0.3-blind/pack.json
```

O gate está deliberadamente `pending` em `reports/calibration/heavy-user-ptbr-v0.3-progress.json`: as 300 combinações ainda precisam de duas notas humanas independentes e adjudicação quando necessário. Nenhuma nota sintética é tratada como calibração final.

O `pack.json` acompanha os dois arquivos e protege a identidade das 300 âncoras; use-o no `import-blind` antes de gerar `responses-reviewed.json`.

## Próxima promoção

Depois do endpoint real do SaciLM, a v0.3 pode ser executada pelo mesmo adapter HTTP, comparada com os modelos do registry e promovida para a console somente após verificação, auditoria, calibração e release gate.
