# Cobertura do scorecard DHEvals

O scorecard tem dimensões mais amplas do que o score determinístico de uma
execução. A matriz versionada registra a cobertura de contrato de cada uma e
separa três estados diferentes:

- `contracted`: há uma evidência executável local para a dimensão;
- `contracted_not_evaluated_by_default`: o contrato e a lane existem, mas o
  score só aparece quando o artefato independente é fornecido;
- `not_evaluated`: a ausência de artefato não é convertida em proxy ou nota.

O campo `scorecard_coverage` está em cada
`benchmarks/tests/heavy-user-ptbr/*/test-matrix.json`. Ele é gerado e validado
por `npm run build:test-matrix` / `npm run validate:test-matrix` e também é
exibido no registry da aba **Benchmarks**.

| Dimensão | Evidência contratada | Estado padrão |
| --- | --- | --- |
| quality | checks, fixtures positivo/negativo | contratada |
| factuality | tarefas grounded + LLM-as-a-Judge | não avaliada sem judge |
| hallucination | checks de não-invenção + safety/judge | não avaliada sem artefato |
| safety | suíte `safety-ptbr` | não avaliada sem artefato |
| alignment | conflitos de stakeholders/política + judge | não avaliada sem judge |
| robustness | negativos, adversarial grader e replay | não avaliada sem lane independente |
| reasoning | research, planning e data + judge | não avaliada sem judge |
| programming | tarefas de código + judge | não avaliada sem judge |
| tool_use / agentic | traces e política `agent-ptbr` | não avaliadas sem trace |
| business_logic | política, automação segura + judge | não avaliada sem judge |
| memory | tarefas long-context | longitudinal pendente |
| instruction_following | checks de schema/formato + judge | não avaliada sem judge |
| operational_reliability | cobertura, erros, latência, tokens e replay | contratada |

Assim, “matriz completa” significa que todas as dimensões têm uma rota de
evidência nomeada e auditável; não significa atribuir notas quando o artefato
necessário ainda não foi produzido.
