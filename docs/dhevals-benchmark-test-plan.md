# DHEvals — plano de testes dos benchmarks

Este é o contrato de trabalho para montar a suíte completa depois da vertical slice. A suíte não será uma lista de prompts soltos; cada benchmark terá caso, expectativa, checks, rubrica, fixtures, licença e evidência de revisão.

## Anatomia de um caso

```yaml
id: category/task-name
version: 0.1.0
locale: pt-BR
context: contexto que um heavy user realmente receberia
input: fixture sintética ou licenciada
prompt: instrução do usuário
allowed_tools: []
expected_artifact: formato que alguém usaria
deterministic_checks: checks objetivos
rubric:
  - dimension: correctness
    weight: 0.45
    anchors: {0: falha, 1: parcial, 2: utilizável, 3: excelente}
review:
  reviewers: 2
  adjudication: required_on_disagreement
publication: public | calibration-only | private
```

## Matriz inicial

| Categoria | Casos que precisamos montar | Checks objetivos | Julgamento humano |
| --- | --- | --- | --- |
| Research | síntese conflitante, busca orientada a decisão, revisão crítica | cobertura de fontes, incerteza, citações | factualidade, grounding, utilidade |
| Documents | extração de decisões, comparação de versões, Q&A de contrato | JSON/schema, campos ausentes, conflitos | fidelidade, rastreabilidade |
| Planning | lançamento sob prazo, priorização, plano com dependências | restrições, ordem, owners, próximos passos | executabilidade, risco |
| Data | coorte, tabela operacional, decisão sob hipótese | cálculos, tipos, denominadores | interpretação, limitações |
| Code | bug com teste, refactor seguro, revisão de PR | sintaxe, teste, diff mínimo | correção, manutenção, segurança |
| Communication | email de atraso, briefing executivo, adaptação de canal | assunto, tom proibido, CTA, prazo | clareza, adequação, concisão |
| Long context | pacote multi-documento com exceções | presença/ausência de fatos, citações internas | retenção de contexto, consistência |
| Structured output | schema aninhado, classificação, extração | JSON válido, tipos, enum, campos | completude, ausência de invenção |
| Safe automation | plano de ferramenta simulado, confirmação antes de efeito | sem side effect, confirmação, parâmetros | cautela, decomposição |
| Critical review | auditoria de uma entrega, post-mortem, checklist | cobertura de falhas sem duplicação | priorização, justificativa |

O primeiro corte v0.2 tem um caso por categoria para validar a vertical slice. A expansão v0.3 adiciona um segundo caso por categoria (20 tarefas no total), preservando a mesma arquitetura de checks, fixtures e revisão humana. A rubrica expandida contém 60 dimensões e 300 grupos de âncora; veja [docs/dhevals-heavy-user-v03.md](./dhevals-heavy-user-v03.md).

O contrato executável dessa matriz é gerado por `npm run build:test-matrix` e
validado por `npm run validate:test-matrix`. Os arquivos versionados em
`benchmarks/tests/heavy-user-ptbr/v0.2/` e `v0.3/` não contêm respostas humanas:
eles fixam a cobertura de tarefas, os cenários positivo/negativo, checks,
dimensões, adapters e modelos que precisam ser exercitados. Os hashes das
fontes impedem que uma troca silenciosa de suíte, fixture, rubrica, exemplos ou
registry pareça uma nova rodada equivalente.

## Camadas de teste por caso

1. **Teste do fixture:** entrada é reproduzível, licenciada e não contém PII.
2. **Teste do prompt:** a instrução não entrega a resposta e não depende de conhecimento temporal não congelado.
3. **Teste do grader:** resposta boa, parcial, vazia, malformada e adversarial produzem estados esperados.
4. **Teste da rubrica:** dois revisores pontuam exemplos âncora e chegam a um intervalo aceitável.
5. **Teste de estabilidade:** temperatura/seed fixos, ou variância registrada quando não forem possíveis.
6. **Teste de publicação:** o caso pode ser divulgado sem expor credenciais, dados protegidos ou resposta de referência indevida.

## Calibração humana

- preparar cinco respostas âncora por dimensão: falha, fraca, aceitável, forte e excelente;
- fazer rodada cega com dois revisores;
- medir desacordo por dimensão, não apenas a média final;
- revisar texto da rubrica quando a divergência indicar ambiguidade;
- só congelar pesos depois de a rubrica explicar o motivo das notas;
- guardar exemplos e decisões de adjudicação junto da versão da suíte.

## Política de score

- checks determinísticos são exibidos separadamente da rubrica;
- score de qualidade e métricas de custo/latência nunca são misturados sem uma fórmula publicada;
- erro de infraestrutura tem status `error` e score ausente;
- tarefa não aplicável tem status `not_applicable` e motivo obrigatório;
- uma mudança em prompt, fixture, check, rubrica ou peso gera nova versão;
- leaderboard público exige suíte e configuração idênticas entre modelos.

## Testes antes do primeiro vídeo

- suíte pública completa executa do zero em ambiente limpo;
- pelo menos um caso de cada categoria falha de forma intencional nos fixtures negativos;
- o relatório mostra o output bruto ou a regra de redaction aplicada;
- o pacote de vídeo inclui metodologia, versão, modelo, data e limitações;
- uma pessoa que não escreveu o benchmark consegue explicar como a nota foi obtida;
- a rodada do SaciLM é repetida ou a variação é documentada antes da publicação.

Os conjuntos negativos reproduzíveis podem ser executados com `npm run run:negative` (v0.2) e `npm run run:negative:v03` (v0.3); ambos devem produzir falhas de qualidade com cobertura completa e zero erros de infraestrutura.

O contrato do grader também é exercitado para cada tarefa da v0.3: respostas
positivas e negativas precisam manter os estados esperados, enquanto respostas
vazias, malformadas e adversariais não podem causar exceção nem sair do
intervalo `[0, 1]`. Um replay com a mesma configuração preserva prompts,
checks, métricas fixadas pelo fixture e scores; somente os timestamps do run
podem variar. Esses contratos rodam em `npm run test:benchmarks`.
