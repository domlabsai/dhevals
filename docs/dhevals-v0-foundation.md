# DHEvals v0 — fundação do produto

**Status:** decisão consolidada da Fase 0; fundação para implementação  
**Data:** 2026-08-02  
**Responsável jurídico:** DomHubs (CNPJ)  
**Braço de pesquisa e desenvolvimento:** Dom Labs  
**Modelo inicialmente planejado:** SaciLM (em standby)

**Aditivo de escopo — 2026-08-03:** o desenvolvimento do SaciLM ainda não
começou. Seu manifesto, endpoint, preflight e rodada ficam adiados. O DHEvals
segue agora como plataforma agnóstica, com adapters HTTP e CLI para avaliar
OpenCode, Qwen, Kimi e outros modelos sem esperar a lane SaciLM.

## 1. Decisões que passam a valer

| Tema | Decisão | Consequência para o produto |
| --- | --- | --- |
| Estrutura | Todo o trabalho será executado via DomHubs; Dom Labs é o braço de pesquisa. | Documentação, contratos, infraestrutura e publicação devem refletir DomHubs como entidade jurídica. |
| Modelo inicial | SaciLM é um programa de modelo próprio, independente do Dom Labs, mas está em standby. | DHEvals trata qualquer modelo como lane externa; o SaciLM terá manifesto e versão próprios quando começar. |
| Pós-treinamento | Unsloth é a ferramenta inicial confirmada para o SaciLM, com execução de GPU preferencialmente no RunPod. | A trilha de treinamento e a trilha de avaliação ficam separadas; outras lanes podem registrar Axolotl, LLaMA-Factory, torchtune ou nenhuma etapa de treino. |
| Produto | O nome é **DHEvals**; DOMEvals deixa de ser o nome de produto. | Novos artefatos, código, URLs e interface usam DHEvals. DOMEvals pode aparecer apenas como referência histórica. |
| Uso público | O sistema será funcional e servirá a benchmarks robustos para heavy users de IA, inclusive em vídeos de YouTube. | O resultado precisa ser reproduzível, auditável e legível para público técnico e não técnico; não será apenas um painel interno. |

## 2. O que o DHEvals é

DHEvals é uma plataforma de avaliação de modelos que transforma uma suíte versionada de tarefas cotidianas difíceis em evidência comparável:

1. define tarefas, dados, critérios e regras de execução;
2. executa as mesmas tarefas contra um ou mais modelos;
3. captura resposta, custo, latência, tokens, erros e configuração;
4. aplica verificações determinísticas e rubricas revisáveis;
5. gera relatório técnico, artefatos de auditoria e um pacote pronto para explicar o resultado em vídeo.

O foco é medir utilidade real de um modelo em trabalho de alta exigência, não apenas acerto em jogos, perguntas triviais ou testes que favoreçam respostas curtas.

### Princípios de v0

- **Reprodução antes de ranking:** toda pontuação vem acompanhada da versão da suíte, do modelo, da configuração e dos dados.
- **Tarefas com artefato:** sempre que possível, a saída deve ser algo que uma pessoa realmente usaria (plano, tabela, decisão, código, síntese ou documento).
- **Separação entre fato e julgamento:** regras objetivas são calculadas pelo sistema; qualidade subjetiva fica explícita em rubrica e, quando necessário, revisão humana.
- **Comparação justa:** mesma tarefa, mesmo limite, mesmo contexto e mesma política de ferramentas para todos os modelos da rodada.
- **Transparência editorial:** o vídeo pode contar uma história, mas o relatório público preserva a suíte completa e registra falhas, não apenas os melhores exemplos.
- **Segurança por desenho:** v0 não executa ações destrutivas em serviços reais e não usa dados pessoais reais.

## 3. Recorte funcional do DHEvals v0

### Deve existir

1. **Manifesto de suíte versionado** — ID, versão, idioma, licença/proveniência, tarefas, limites e rubricas.
2. **Runner agnóstico de provedor** — adapters compatíveis com API no estilo OpenAI e CLIs locais, sem acoplar o DHEvals a um fornecedor de inferência.
3. **Modo fixture/offline** — permite validar o sistema e gerar um relatório sem uma GPU ou endpoint ativo.
4. **Registro completo da rodada** — prompt efetivo, parâmetros, versão do modelo, timestamp, seed quando aplicável, latência, tokens, custo estimado, erros e hash dos artefatos.
5. **Grading em camadas** — checks determinísticos, rubrica estruturada e revisão humana opcional. Um juiz LLM não será a única fonte de verdade de um ranking.
6. **Relatório reproduzível** — JSON para máquinas e HTML para leitura, com resultados por tarefa, categoria, métrica e modelo.
7. **Pacote de publicação** — relatório, CSV/JSON, manifesto da rodada, exemplos selecionados e roteiro factual para o fluxo de vídeo.
8. **Trilha de auditoria** — cada número publicado aponta para a execução que o produziu.

### Fica fora do v0

- billing, marketplace e multi-tenancy comercial;
- treinamento/fine-tuning dentro do DHEvals;
- agentes com acesso irrestrito a e-mail, arquivos ou sistemas de produção;
- leaderboard ocultando casos ou misturando versões incompatíveis;
- benchmark multimodal completo antes de a trilha textual estar estável;
- pontuação única sem decomposição por categoria e sem tamanho de amostra visível.

## 4. Primeiro conjunto: heavy-user cotidiano

A suíte inicial deve ser em **pt-BR**, com casos sintéticos ou licenciados para publicação, e representar tarefas compostas que exigem contexto, decisão e entrega utilizável.

| Categoria | Exemplo de capacidade observada | Evidência esperada |
| --- | --- | --- |
| Pesquisa e síntese | reunir evidências, reconciliar fontes e declarar incerteza | síntese com fontes, conflitos e conclusão calibrada |
| Documentos | extrair, classificar e transformar conteúdo longo | tabela/JSON/documento com campos completos |
| Planejamento | organizar projeto sob restrições e dependências | plano executável, riscos e próximos passos |
| Dados e planilhas | interpretar dados e tomar decisão | cálculo verificável, tabela e recomendação |
| Código e debugging | entender falha, corrigir e explicar trade-offs | patch/teste/explicação reproduzível |
| Comunicação | adaptar mensagem a público, canal e objetivo | texto pronto para uso, com tom e restrições atendidos |
| Contexto longo | manter fatos, instruções e exceções ao longo de um pacote | resposta com cobertura e citações internas corretas |
| Saída estruturada | respeitar schema, tipos e regras de validação | JSON válido, sem campos inventados ou ausentes |
| Automação segura | decompor uma tarefa em passos e pedir confirmação | plano de ferramenta simulado, sem efeito externo real |
| Revisão crítica | encontrar erros, lacunas e riscos numa entrega | lista priorizada com justificativa e correção |

O primeiro corte recomendado é uma suíte pequena e variada, com 1–2 tarefas por categoria. Ela será ampliada somente depois que o runner, o grading e o relatório sobreviverem a uma rodada real do SaciLM.

### O que cada tarefa precisa declarar

- `task_id` estável e versão;
- objetivo e contexto do usuário;
- entradas/fixtures e sua licença;
- idioma, limite de contexto e limite de saída;
- se ferramentas são permitidas e quais são simuladas;
- formato de saída esperado;
- checks determinísticos;
- rubrica com dimensões, escala e exemplos;
- política de privacidade e publicação;
- casos conhecidos de ambiguidade ou erro.

## 5. Contrato de execução

O DHEvals não assume onde o SaciLM é servido. O contrato mínimo do adaptador é:

```text
request(suite_task, model_config) -> response

response {
  text_or_structured_output,
  finish_reason,
  usage: {input_tokens?, output_tokens?, total_tokens?},
  latency_ms,
  provider_metadata?,
  error?
}
```

Para uma primeira integração, o endpoint deve ser compatível com uma API de chat/completions. Assim, o SaciLM pode ser servido por diferentes runtimes sem alterar a suíte ou o grading. Se ainda não houver endpoint, o modo fixture permite desenvolver o restante da plataforma em paralelo.

### Manifesto do SaciLM consumido pelo DHEvals

Cada rodada deve registrar, no mínimo:

- nome e versão do checkpoint;
- modelo-base e licença;
- commit/configuração do pós-treinamento;
- versão do dataset e seus hashes;
- configuração do Unsloth e quantização, quando aplicável;
- hardware/runtime de treinamento (RunPod ou outro);
- runtime de inferência e parâmetros de geração;
- data, seed e responsável pela publicação.

O fato de Unsloth/RunPod ser a trilha inicial de treinamento não transforma essas ferramentas em requisito do runner de avaliação. Essa separação evita lock-in e permite comparar o SaciLM com modelos de outros provedores.

## 6. Modelo de dados mínimo

```yaml
suite:
  id: dhevals-heavy-user-ptbr
  version: 0.1.0
  locale: pt-BR
  tasks: [ ... ]

run:
  id: <run-id>
  suite_id: dhevals-heavy-user-ptbr
  suite_version: 0.1.0
  model_id: sacilm
  model_revision: <revision>
  adapter: openai-compatible
  generation: {temperature: 0.2, max_tokens: <n>, seed: <optional>}
  runtime: {provider: <provider>, hardware: <optional>}
  started_at: <timestamp>

result:
  task_id: <task-id>
  output: <raw-or-redacted-output>
  checks: [{id: <check-id>, passed: true, details: <...>}]
  rubric: {correctness: <score>, completeness: <score>, usability: <score>}
  metrics: {latency_ms: <n>, input_tokens: <n>, output_tokens: <n>, cost_usd: <optional>}
  status: pass | partial | fail | error
```

Os nomes podem evoluir na implementação; o princípio é manter o registro suficiente para reconstruir o número publicado e distinguir erro do modelo de erro de infraestrutura.

## 7. Grading e publicação

### Pontuação

- cada check objetivo produz `pass`, `fail` ou valor graduado claramente definido;
- cada rubrica subjetiva declara escala, critérios e quem avaliou;
- resultados agregados mostram cobertura, tamanho da amostra e distribuição, não somente média;
- custo e latência aparecem como métricas separadas da qualidade;
- falha de endpoint, timeout e saída inválida não são convertidos silenciosamente em zero de qualidade.

### Pacote para YouTube

Uma rodada marcada como `youtube` deve exportar:

1. relatório HTML público;
2. dados brutos ou redigidos em JSON/CSV;
3. manifesto de reprodução;
4. tabela comparativa por categoria;
5. seleção de exemplos com `task_id`, prompt, resposta e critério;
6. roteiro factual contendo metodologia, limitações e resultados;
7. lista de casos que falharam ou ficaram inconclusivos.

O roteiro é uma camada editorial sobre os dados, não uma alteração dos dados. A publicação deve informar modelo, versão, configuração, data, custo/latência quando disponíveis e se houve revisão humana.

## 8. Proveniência, segurança e ética

- usar somente fixtures próprias, sintéticas ou com licença de redistribuição;
- remover segredos e PII das entradas, saídas e logs públicos;
- manter chaves de API apenas em variáveis de ambiente/secret manager;
- simular ferramentas e bloquear efeitos externos no v0;
- hashear entradas e artefatos para detectar troca após a execução;
- publicar versão e changelog da suíte quando uma tarefa mudar;
- separar dados privados de desenvolvimento dos artefatos públicos;
- registrar limitações, viés de idioma/domínio e casos não avaliados.

## 9. Critérios de aceite da primeira vertical slice

O DHEvals v0 estará pronto para a primeira rodada do SaciLM quando:

- uma suíte pt-BR versionada puder ser executada em modo fixture;
- o mesmo runner aceitar um endpoint compatível sem mudar as tarefas;
- uma rodada registrar respostas, métricas, erros e hashes;
- pelo menos um check determinístico e uma rubrica estruturada funcionarem por tarefa;
- o relatório mostrar resultados por tarefa e categoria, com configuração completa;
- o pacote de YouTube puder ser gerado sem editar manualmente os números;
- uma segunda pessoa conseguir reproduzir a rodada a partir do manifesto;
- o sistema distinguir claramente qualidade, custo, latência e falha de infraestrutura.

## 10. Sequência de implementação

1. congelar o schema de suíte, tarefa, rodada e resultado;
2. criar a suíte fixture heavy-user v0.1;
3. implementar runner e adaptador compatível com API de chat;
4. implementar checks, rubricas e agregação;
5. gerar JSON/HTML e pacote de publicação;
6. configurar a primeira execução live de uma lane escolhida (SaciLM ou outro modelo);
7. revisar casos, pesos e transparência com base nos resultados;
8. só então expandir a superfície web, leaderboard público e integrações.

## 11. Decisões ainda necessárias antes da rodada pública

Estas perguntas não bloqueiam a fundação, mas precisam ser fechadas antes da publicação do primeiro vídeo:

1. Qual endpoint ou CLI servirá a primeira lane real? O runtime/endpoint do SaciLM pode ser decidido depois.
2. Qual será a lista fechada de tarefas do heavy-user v0.1 e quais poderão ser divulgadas integralmente?
3. O primeiro relatório será público desde a primeira execução ou haverá uma rodada privada de calibração?
4. Qual hardware, orçamento e limite de tempo por rodada serão aceitos?
5. Qual política definirá empate, revisões humanas e mudanças de versão da suíte?

Até essas respostas, o padrão de trabalho é: pt-BR, casos publicáveis, ferramentas simuladas, suíte variada, execução reproduzível e lanes de modelo configuráveis. O SaciLM permanece em standby.
