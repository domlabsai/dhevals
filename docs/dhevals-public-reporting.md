# DHEvals — contrato de publicação

O artefato de execução é a fonte primária. A console não recalcula uma nota diferente do runner: ela consome `latest-run.json` e os derivados canônicos.

Quando a rodada recebe preços opcionais de entrada/saída, `estimated_cost_usd` aparece por tarefa, categoria e total. Sem preços configurados, o campo permanece ausente/nulo; latência, tokens e qualidade continuam métricas separadas.

## Derivados

| Arquivo | Uso | Regra |
| --- | --- | --- |
| `latest-report.json` | agregação por categoria, score, cobertura, latência e tokens | reconstruível a partir do run |
| `latest-report.html` | leitura humana independente da console | self-contained e derivado do JSON canônico |
| `latest-results.csv` | análise em planilha e recorte para produção | uma linha por tarefa, com métricas e saída |
| `latest-youtube-pack.json` | hook, fatos, breakdown e limitações | não inventa baseline ou causalidade |
| `latest-verification.json` | prova de identidade e reprodutibilidade do run/report | promoção só ocorre com status `valid` |
| `latest-audit.json` | integridade da suíte, fixtures, rubrica, âncoras e registry | rodada v0.2 só inicia com status `ready` |
| `latest-release-gate.json` | decisão consolidada de publicação | `ready` ou `blocked` com motivos verificáveis |
| `suite-catalog.json` | registry de versões, hashes, auditorias e calibração | não mistura manifestos; marca a versão pública atual |
| `run-catalog.json` | histórico de runs e reports arquivados | deduplica por run id, marca a rodada pública e mantém fixtures locked |
| `model-catalog.json` | registry de modelos avaliáveis | mostra suites, adapter (HTTP ou CLI) e configuração apenas como booleano, sem URL/chave/comando |
| `test-matrix-catalog.json` | cobertura executável de cenários, checks, rubrica, anchors e lanes | derivado dos manifestos versionados; não contém notas humanas |
| `leaderboard.json` | ranking de modelos comparáveis | score de fixture nunca é publicado |

## Elegibilidade do leaderboard

Uma entrada só recebe `publication_status: eligible` quando:

- o provider não é `fixture`;
- a cobertura é 100%;
- não há erros de infraestrutura;
- existe score de qualidade;
- suite, versão e hash estão identificados.
- o resumo de calibração humana está em `ready`.

Caso contrário, a entrada permanece visível como `locked` com o motivo explícito. Isso permite gravar o processo no YouTube sem transformar uma fixture de desenvolvimento em alegação de qualidade do SaciLM.

O release gate reconcilia suite/hash, run, report, verificação, auditoria, calibração humana e leaderboard antes de qualquer promoção pública. Em desenvolvimento ele deve permanecer `blocked` até existir endpoint real e a revisão humana dupla.
