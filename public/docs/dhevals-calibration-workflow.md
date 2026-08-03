# DHEvals — fluxo de calibração humana

A matriz v0.2 tem 150 grupos de âncora: dez tarefas, três dimensões por tarefa e cinco níveis de qualidade (0–4). O gate só publica a rubrica quando cada grupo tem duas notas independentes e a diferença entre as notas é de no máximo um ponto.

Antes de distribuir as planilhas, valide o bundle inteiro:

```bash
npm run audit:benchmarks
```

O audit confirma o hash da suíte, os fixtures positivo/negativo, a cobertura 0–4 dos exemplos, as 150 âncoras e o registry de modelos.

## 1. Exportar a planilha

```bash
uv run --python 3.12 --project packages/dhevals_core dhevals-calibration-sheet export \
  --rubric benchmarks/calibration/heavy-user-ptbr/v0.2/anchor-rubric.json \
  --examples benchmarks/calibration/heavy-user-ptbr/v0.2/anchor-examples.json \
  --output reports/calibration/heavy-user-ptbr-v0.2-review.csv
```

Cada linha identifica tarefa, dimensão e nível, traz o exemplo/target correspondente e inclui a orientação específica da dimensão (`dimension_guidance`). Assim a planilha permanece autocontida mesmo no fluxo cego. Os revisores preenchem `reviewer_a_score` e `reviewer_b_score` (0 a 4), além das notas opcionais. A coluna de adjudicação só é preenchida depois de um desacordo.

Para uma revisão realmente cega, gere arquivos independentes — nenhum revisor recebe a coluna do outro:

```bash
uv run --python 3.12 --project packages/dhevals_core dhevals-calibration-sheet export-blind \
  --rubric benchmarks/calibration/heavy-user-ptbr/v0.2/anchor-rubric.json \
  --examples benchmarks/calibration/heavy-user-ptbr/v0.2/anchor-examples.json \
  --output-dir reports/calibration/heavy-user-ptbr-v0.2-blind \
  --manifest-output reports/calibration/heavy-user-ptbr-v0.2-blind/pack.json
```

Depois de preencher `reviewer-a.csv` e `reviewer-b.csv`, importe os dois arquivos:

```bash
uv run --python 3.12 --project packages/dhevals_core dhevals-calibration-sheet import-blind \
  --sheet reports/calibration/heavy-user-ptbr-v0.2-blind/reviewer-a.csv \
  --sheet reports/calibration/heavy-user-ptbr-v0.2-blind/reviewer-b.csv \
  --rubric benchmarks/calibration/heavy-user-ptbr/v0.2/anchor-rubric.json \
  --pack reports/calibration/heavy-user-ptbr-v0.2-blind/pack.json \
  --output benchmarks/calibration/heavy-user-ptbr/v0.2/responses-reviewed.json
```

O `pack.json` fixa a identidade da rubrica, dos exemplos e da ordem/conteúdo
das âncoras. As colunas `score` e `notes` permanecem editáveis; qualquer
alteração nos exemplos, troca de arquivo ou reordenação é rejeitada no import.

### Revisão pela console

Para uma revisão mais confortável em vídeo ou durante a calibração, rode a
console e abra **Calibration → Open reviewer workspace**. O workspace usa v0.3
por padrão, mostra a fila completa de 300 grupos, permite selecionar o revisor,
filtrar tarefa/dimensão e atribuir notas de 0 a 4. O rascunho é local ao
navegador (`localStorage`) e não altera os artefatos públicos. Ao terminar,
clique em **Export blind CSV** e substitua o CSV do revisor no pacote cego; o
botão **Validate CSV** pode reabrir o arquivo no navegador e confere nome,
cabeçalho, ordem, exemplos, níveis e scores sem escrever no repositório. O
importador continua sendo a autoridade final que verifica cabeçalho, ordem,
hash e fingerprint do `pack.json`:

```bash
npm run build:calibration-review-data
uv run --python 3.12 --project packages/dhevals_core dhevals-calibration-sheet import-blind \
  --sheet reports/calibration/heavy-user-ptbr-v0.3-blind/reviewer-a.csv \
  --sheet reports/calibration/heavy-user-ptbr-v0.3-blind/reviewer-b.csv \
  --rubric benchmarks/calibration/heavy-user-ptbr/v0.3/anchor-rubric.json \
  --pack reports/calibration/heavy-user-ptbr-v0.3-blind/pack.json \
  --output benchmarks/calibration/heavy-user-ptbr/v0.3/responses-reviewed.json
```

O botão **Export JSON draft** é apenas um backup local; ele não é aceito pelo
gate no lugar do CSV cego. Assim a interface ajuda a revisar, mas não substitui
as validações reproduzíveis do pacote.

### Handoff v0.3

Para distribuir a tarefa sem copiar caminhos ou hashes manualmente, gere o
handoff versionado:

```bash
npm run build:calibration-handoff
```

Isso grava `reports/calibration/heavy-user-ptbr-v0.3-handoff.json` e
`public/data/calibration/v0.3/handoff.json`. O artefato confirma o `pack_id`, a
fingerprint das âncoras, o SHA-256 de cada CSV, 300 linhas por revisor e o
estado (`ready_for_review`, `in_progress` ou `ready_to_import`). Ele também
expõe os comandos de importação/adjudicação, mas nunca inclui notas humanas,
credenciais ou scores sintéticos.

O comando `npm run test:calibration-ready` exercita o caminho completo em um
diretório temporário: preenche os 300 anchors com notas marcadas explicitamente
como sintéticas, importa duas planilhas, valida 600 respostas e confirma
`ready`. Esse smoke prova o encadeamento técnico sem promover nem substituir
as planilhas públicas, e não é evidência de calibração humana.

## 2. Importar as notas

```bash
uv run --python 3.12 --project packages/dhevals_core dhevals-calibration-sheet import \
  --sheet reports/calibration/heavy-user-ptbr-v0.2-review.csv \
  --rubric benchmarks/calibration/heavy-user-ptbr/v0.2/anchor-rubric.json \
  --output benchmarks/calibration/heavy-user-ptbr/v0.2/responses-reviewed.json
```

O importador preserva as respostas dos dois revisores e grava adjudicações separadamente. Linhas ainda vazias permanecem ausentes para que o gate mostre exatamente o que falta.

## 3. Executar o gate

```bash
uv run --python 3.12 --project packages/dhevals_core dhevals-calibration \
  --rubric benchmarks/calibration/heavy-user-ptbr/v0.2/anchor-rubric.json \
  --responses benchmarks/calibration/heavy-user-ptbr/v0.2/responses-reviewed.json \
  --output reports/calibration/heavy-user-ptbr-v0.2-summary.json
```

Após cada importação ou adjudicação, gere também o artefato consumido pela console:

```bash
npm run build:calibration
```

Isso grava `public/data/latest-calibration.json` com cobertura, contagem por revisor, grupos pendentes/desacordados/adjudicados e as fontes da revisão. O arquivo é um diagnóstico derivado; o rubric e o payload de respostas continuam sendo as fontes de verdade.

Estados possíveis:

- `pending`: ainda existem grupos sem duas notas;
- `adjudication_required`: algum grupo tem diferença acima de um ponto;
- `ready`: matriz completa e dentro da tolerância;
- `invalid`: há campo inválido, grupo desconhecido ou resposta duplicada.

Se o estado for `adjudication_required`, gere uma planilha somente com os
grupos em desacordo a partir do payload importado:

```bash
uv run --python 3.12 --project packages/dhevals_core dhevals-calibration-sheet export-adjudication \
  --rubric benchmarks/calibration/heavy-user-ptbr/v0.3/anchor-rubric.json \
  --examples benchmarks/calibration/heavy-user-ptbr/v0.3/anchor-examples.json \
  --responses benchmarks/calibration/heavy-user-ptbr/v0.3/responses-reviewed.json \
  --output reports/calibration/heavy-user-ptbr-v0.3-adjudication.csv
```

Preencha `adjudicated_score` e `adjudication_notes`, valide o arquivo e
reimporte-o junto com as planilhas cegas:

```bash
export DHEVALS_CALIBRATION_ADJUDICATIONS=reports/calibration/heavy-user-ptbr-v0.3-adjudication.csv
npm run import:calibration:v03
```

O comando grava as adjudicações em `responses-reviewed.json` antes de rodar o
gate; não é necessário editar JSON manualmente.

Depois da adjudicação, a decisão deve ser registrada na planilha e o conjunto de respostas deve ser reimportado/revalidado antes de mudar o `status` do rubric para publicado.

Quando o resumo estiver `ready`, é possível congelar uma cópia não destrutiva do rubric:

```bash
uv run --python 3.12 --project packages/dhevals_core dhevals-calibration \
  --rubric benchmarks/calibration/heavy-user-ptbr/v0.2/anchor-rubric.json \
  --responses benchmarks/calibration/heavy-user-ptbr/v0.2/responses-reviewed.json \
  --output reports/calibration/heavy-user-ptbr-v0.2-summary.json \
  --freeze-rubric benchmarks/calibration/heavy-user-ptbr/v0.2/anchor-rubric-calibrated.json
```

O leaderboard público recebe esse resumo automaticamente. Enquanto o status não for `ready`, rodadas reais ficam `locked`; fixtures continuam bloqueadas em qualquer circunstância.
