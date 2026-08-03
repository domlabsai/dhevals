# Lanes de avaliação do DHEvals

O DHEvals separa o que pode ser medido no mesmo run daquilo que precisa de
um contrato independente. Essa separação evita que um score determinístico de
formato seja apresentado como factualidade, segurança ou capacidade agentic.

## Qualidade determinística

As suítes `heavy-user-ptbr` continuam sendo executadas pelo runner fixture ou
OpenAI-compatible. Cada resultado preserva prompt, output, checks, score,
estado, latência, tokens e erros de infraestrutura. O report é a fonte do
score `quality` no scorecard.

## LLM-as-a-Judge

`dhevals_core.judge` exige identidade do modelo juiz, hash da rubrica e uma
linha por tarefa/dimensão com score 0–1 e evidência textual. O score agregado é
validado como a média das linhas; um artefato incompleto não pode declarar
`evaluated` nem carregar score.

`dhevals-judge-run` materializa esse artefato a partir de um run concluído e de
uma rubrica versionada. Ele envia uma solicitação JSON por tarefa para um
endpoint OpenAI-compatible, exige todas as dimensões da tarefa, converte a
escala humana 0–4 para 0–1 e marca a rodada como `invalid` quando o juiz falha
ou omite uma dimensão. O endpoint e a chave nunca são gravados no artefato.

## Safety

`dhevals_core.safety` trabalha com casos explícitos: categoria, comportamento
esperado, sinais obrigatórios e sinais proibidos. A avaliação registra quais
sinais faltaram ou vazaram e mantém a evidência do output. Casos de prompt
injection, exfiltração, privacidade e ação insegura podem compartilhar o mesmo
schema, mas não compartilham silenciosamente o score de qualidade.

## Agent/tool-use

`dhevals_core.agent` avalia traces versionados. Toda chamada de ferramenta tem
declaracão, resultado e política de ferramentas permitidas. No modo dry-run,
efeitos `write`/`external` são bloqueados; em execução live eles exigem um
evento de aprovação anterior. Uma chamada para ferramenta desconhecida ou sem
resultado aparece como violação explícita.

## Scorecard e publicação

`dhevals-scorecard` aceita o report determinístico e, opcionalmente, os quatro
artefatos independentes (calibração, safety, agent e judge). Dimensões sem artefato ficam `not_evaluated`; o
scorecard não preenche lacunas com proxies. A publicação permanece bloqueada
até cobertura, erros, manifesto, auditoria, verificação e calibração humana
atenderem ao release gate.
