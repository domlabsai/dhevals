import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const sourceVersion = 'v0.2'
const targetVersion = 'v0.3'
const sourceSuiteDir = resolve(root, 'benchmarks/suites/heavy-user-ptbr', sourceVersion)
const targetSuiteDir = resolve(root, 'benchmarks/suites/heavy-user-ptbr', targetVersion)
const sourceCalibrationDir = resolve(root, 'benchmarks/calibration/heavy-user-ptbr', sourceVersion)
const targetCalibrationDir = resolve(root, 'benchmarks/calibration/heavy-user-ptbr', targetVersion)
const sourceRegistryPath = resolve(root, 'benchmarks/comparisons/v0.2/models.json')
const targetRegistryDir = resolve(root, 'benchmarks/comparisons/v0.3')

const read = (path) => JSON.parse(readFileSync(path, 'utf8'))
const write = (path, payload) => {
  mkdirSync(resolve(path, '..'), { recursive: true })
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}
const writeIfMissing = (path, payload) => {
  if (existsSync(path)) return false
  write(path, payload)
  return true
}

const extraCases = [
  {
    task: {
      id: 'research-source-triangulation',
      title: 'Research with source triangulation',
      category: 'Research',
      prompt: 'Compare três resumos de fontes sobre a adoção de uma ferramenta corporativa. Separe o que cada fonte afirma, reconcilie divergências, declare o que não pode ser concluído e recomende o que verificar antes da decisão.',
      checks: [
        { id: 'source-coverage', type: 'contains_all', values: ['Fonte A', 'Fonte B', 'Fonte C', 'verificar'] },
        { id: 'minimum-triangulation', type: 'min_length', characters: 260 },
      ],
      rubric: [
        { id: 'grounding', label: 'Grounding', weight: 0.4 },
        { id: 'reconciliation', label: 'Reconciliação', weight: 0.3 },
        { id: 'decision-utility', label: 'Utilidade para decisão', weight: 0.3 },
      ],
      metadata: { expected_artifact: 'source_comparison_memo', publication: 'calibration', input_ref: 'synthetic/research-triangulation-01' },
    },
    positive: {
      output: 'Fonte A relata adoção de 68% no segmento observado; Fonte B registra queda de produtividade no primeiro mês; Fonte C descreve melhora somente após treinamento. As afirmações não são diretamente comparáveis porque usam janelas e amostras diferentes. A evidência sustenta uma hipótese de benefício condicionado à implantação, não uma conclusão causal geral. Antes da decisão, é preciso verificar denominadores, perfil das equipes e custo do treinamento; recomendo um piloto estratificado com produtividade, adoção e custo como métricas.',
      input_tokens: 1240,
      output_tokens: 154,
      latency_ms: 1920,
    },
    negative: { output: 'A Fonte A prova que a ferramenta funciona e as outras fontes confirmam. Recomendo adotar imediatamente.', input_tokens: 100, output_tokens: 18, latency_ms: 100 },
    anchors: [
      { level: 0, output: 'Adote a ferramenta.', target: 'Não compara fontes nem explicita incerteza.' },
      { level: 1, output: 'A Fonte A é positiva e a Fonte B é negativa. É preciso verificar mais.', target: 'Reconhece divergência, mas não reconcilia evidências nem propõe desenho de verificação.' },
      { level: 2, output: 'Fonte A relata adoção maior e Fonte B relata queda inicial. Recomendo um piloto.', target: 'Cobre fontes e ação, mas sem explicar diferenças de amostra ou métricas.' },
      { level: 3, output: 'Fonte A mostra adoção no segmento observado; Fonte B mostra queda inicial e Fonte C condiciona o ganho ao treinamento. As janelas são diferentes, portanto a conclusão é limitada. Verificar denominadores e fazer piloto com adoção e produtividade.', target: 'Reconcilia fontes e transforma a incerteza em próximo passo.' },
      { level: 4, output: 'Fonte A: 68% de adoção no recorte observado. Fonte B: queda de produtividade no primeiro mês. Fonte C: ganho depois de treinamento. Não há base para causalidade porque amostras, janelas e perfis divergem. Verificar denominadores, segmentar por maturidade e pré-registrar piloto com produtividade, adoção, custo e tempo de treinamento.', target: 'Triangulação rastreável, calibrada e acionável.' },
    ],
  },
  {
    task: {
      id: 'document-decision-register',
      title: 'Decision register from an operations packet',
      category: 'Documents',
      prompt: 'Extraia de um pacote de atas operacionais somente JSON válido com decisoes, owners, prazos, pendencias e evidencias. Preserve conflitos e use pendência explícita quando a ata não resolver um ponto.',
      checks: [
        { id: 'decision-schema', type: 'json_object', required_keys: ['decisoes', 'owners', 'prazos', 'pendencias', 'evidencias'] },
        { id: 'unresolved-state', type: 'contains_any', values: ['pendência', 'pendencia'] },
      ],
      rubric: [
        { id: 'fidelity', label: 'Fidelidade', weight: 0.4 },
        { id: 'traceability', label: 'Rastreabilidade', weight: 0.3 },
        { id: 'usability', label: 'Usabilidade', weight: 0.3 },
      ],
      metadata: { expected_artifact: 'decision_register_json', publication: 'calibration', input_ref: 'synthetic/operations-minutes-01' },
    },
    positive: {
      output: JSON.stringify({ decisoes: ['pilotar o novo fluxo após revisão jurídica'], owners: ['Marina'], prazos: ['2026-08-14'], pendencias: ['pendência: confirmar se o SLA da equipe de suporte vale para o canal parceiro'], evidencias: ['Ata 03, seção 2; Ata 04, seção 5'] }),
      input_tokens: 1110,
      output_tokens: 82,
      latency_ms: 1510,
    },
    negative: { output: '{"decisoes":["tudo aprovado"]}', input_tokens: 100, output_tokens: 10, latency_ms: 100 },
    anchors: [
      { level: 0, output: 'As atas estão claras.', target: 'Não entrega JSON nem registra decisões.' },
      { level: 1, output: '{"decisoes":["há decisões"]}', target: 'JSON parcial sem owners, prazo, pendência ou evidência.' },
      { level: 2, output: JSON.stringify({ decisoes: ['pilotar o fluxo'], owners: ['Marina'], prazos: ['em breve'], pendencias: [], evidencias: [] }), target: 'Estrutura completa, mas perde conflito e rastreabilidade.' },
      { level: 3, output: JSON.stringify({ decisoes: ['pilotar o fluxo após revisão jurídica'], owners: ['Marina'], prazos: ['2026-08-14'], pendencias: ['pendência: confirmar SLA do canal parceiro'], evidencias: ['Ata 03, seção 2'] }), target: 'Registro fiel, acionável e com pendência explícita.' },
      { level: 4, output: JSON.stringify({ decisoes: [{ texto: 'pilotar o novo fluxo', condicao: 'revisão jurídica concluída' }], owners: [{ nome: 'Marina', evidencia: 'Ata 04, seção 5' }], prazos: [{ data: '2026-08-14', evidencia: 'Ata 03, seção 2' }], pendencias: [{ texto: 'pendência: SLA do canal parceiro não confirmado', impacto: 'não liberar rollout' }], evidencias: ['Ata 03, seção 2', 'Ata 04, seção 5'] }), target: 'Extrai conteúdo, condição, fonte e limite de decisão sem inventar.' },
    ],
  },
  {
    task: {
      id: 'migration-plan-with-rollback',
      title: 'Migration plan with rollback',
      category: 'Planning',
      prompt: 'Planeje uma migração de banco em uma janela de manutenção de duas horas. Liste dependências, responsáveis, critérios de sucesso e falha, rollback e comunicação. Não assuma que a migração pode ser desfeita sem evidência.',
      checks: [
        { id: 'migration-safety', type: 'contains_all', values: ['dependências', 'rollback', 'janela', 'critério'] },
        { id: 'minimum-plan', type: 'min_length', characters: 260 },
      ],
      rubric: [
        { id: 'sequencing', label: 'Sequenciamento', weight: 0.35 },
        { id: 'safety', label: 'Segurança operacional', weight: 0.35 },
        { id: 'actionability', label: 'Ação', weight: 0.3 },
      ],
      metadata: { expected_artifact: 'migration_runbook', publication: 'calibration', input_ref: 'synthetic/database-migration-01' },
    },
    positive: {
      output: 'Janela: duas horas, com congelamento de escrita confirmado antes do início. Dependências: snapshot verificável, acesso do owner de banco, alerta de latência e canal de incidentes. Sequência: validar backup, executar migração em staging, registrar contagem antes/depois, migrar produção e observar por 30 minutos. Critérios: schema e contagens iguais; falha se houver perda, lock ou erro de aplicação. Rollback: restaurar snapshot somente após confirmar integridade e registrar o ponto de retorno. Owner: Diego; comunicação antes, durante e depois da janela.',
      input_tokens: 1300,
      output_tokens: 151,
      latency_ms: 1770,
    },
    negative: { output: 'Execute a migração rapidamente e, se der problema, desfaça depois. A janela é flexível.', input_tokens: 100, output_tokens: 19, latency_ms: 100 },
    anchors: [
      { level: 0, output: 'Migrar o banco durante a noite.', target: 'Não define janela, dependência ou rollback.' },
      { level: 1, output: 'Fazer backup, migrar e observar. Se falhar, tentar rollback.', target: 'Reconhece etapas, mas não há critérios, owner ou evidência.' },
      { level: 2, output: 'Na janela de duas horas, validar backup, migrar e testar a aplicação. Dependências: acesso ao banco. Rollback se houver erro.', target: 'Plano mínimo, mas rollback e critérios permanecem vagos.' },
      { level: 3, output: 'Janela de duas horas; confirmar snapshot, migrar staging, conferir contagens e depois produção. Owner monitora latência. Critério de sucesso é schema e aplicação estáveis; critério de falha aciona rollback e comunicação.', target: 'Sequência, segurança e ação são claros.' },
      { level: 4, output: 'Janela de duas horas com congelamento de escrita. Dependências: snapshot restaurável, staging, owner, alertas e canal de incidente. Executar, comparar contagens, observar 30 minutos e registrar evidência. Rollback só após confirmar o ponto de retorno e preservar logs; comunicação e critério go/no-go precedem qualquer efeito.', target: 'Runbook executável, reversível e resistente a falha.' },
    ],
  },
  {
    task: {
      id: 'anomaly-investigation',
      title: 'Anomaly investigation under uncertainty',
      category: 'Data',
      prompt: 'Analise um alerta sintético de queda de conversão e retorne somente JSON válido com sinal, hipoteses, teste, prioridade e limitacoes. Não atribua causalidade sem experimento.',
      checks: [
        { id: 'anomaly-schema', type: 'json_object', required_keys: ['sinal', 'hipoteses', 'teste', 'prioridade', 'limitacoes'] },
        { id: 'causal-limit', type: 'contains_any', values: ['hipótese', 'hipotese'] },
      ],
      rubric: [
        { id: 'anomaly-detection', label: 'Detecção', weight: 0.4 },
        { id: 'hypothesis', label: 'Hipótese testável', weight: 0.3 },
        { id: 'limitations', label: 'Limitações', weight: 0.3 },
      ],
      metadata: { expected_artifact: 'anomaly_analysis_json', publication: 'calibration', input_ref: 'synthetic/conversion-anomaly-01' },
    },
    positive: {
      output: JSON.stringify({ sinal: 'conversão caiu de 4,8% para 3,1% após a versão do checkout', hipoteses: ['regressão no pagamento', 'mudança no mix de tráfego', 'atraso de instrumentação'], teste: 'segmentar por navegador e método de pagamento, comparar com grupo de controle e validar eventos brutos', prioridade: 'alta: investigar antes de ampliar rollout', limitacoes: 'o alerta é observacional e não prova causalidade; janela de dois dias pode ter sazonalidade' }),
      input_tokens: 1180,
      output_tokens: 112,
      latency_ms: 1640,
    },
    negative: { output: '{"sinal":"conversão caiu","hipotese":"a nova versão causou o problema"}', input_tokens: 100, output_tokens: 16, latency_ms: 100 },
    anchors: [
      { level: 0, output: JSON.stringify({ resultado: 'a versão causou a queda' }), target: 'Afirma causalidade e não respeita o schema.' },
      { level: 1, output: JSON.stringify({ sinal: 'conversão caiu', hipoteses: [], teste: 'olhar dados', prioridade: 'alta', limitacoes: '' }), target: 'Tem formato, mas não oferece hipóteses ou limites úteis.' },
      { level: 2, output: JSON.stringify({ sinal: 'conversão caiu após release', hipoteses: ['bug'], teste: 'comparar períodos', prioridade: 'alta', limitacoes: 'pode haver sazonalidade' }), target: 'Estrutura completa, mas teste e segmentação são insuficientes.' },
      { level: 3, output: JSON.stringify({ sinal: '4,8% para 3,1% após checkout', hipoteses: ['regressão no pagamento', 'mix de tráfego'], teste: 'segmentar navegador e método e comparar controle', prioridade: 'alta', limitacoes: 'observação não prova causalidade' }), target: 'Sinal, hipótese e teste são coerentes e limitados.' },
      { level: 4, output: JSON.stringify({ sinal: { antes: 0.048, depois: 0.031, janela: 'dois dias' }, hipoteses: [{ texto: 'regressão no pagamento', evidencia: 'erro por método' }, { texto: 'instrumentação atrasada', evidencia: 'eventos brutos divergentes' }], teste: 'validar eventos brutos, estratificar por navegador e método, comparar controle e definir regra de parada', prioridade: 'alta', limitacoes: ['observacional', 'sazonalidade possível', 'mix não controlado'] }), target: 'Investiga anomalia com hipótese testável, evidência e cautela causal.' },
    ],
  },
  {
    task: {
      id: 'sql-review-security',
      title: 'SQL review for security and performance',
      category: 'Code',
      prompt: 'Revise uma consulta SQL de produção que concatena filtros recebidos do usuário. Explique o risco, proponha correção mínima, inclua teste e rollback. Não reescreva o serviço inteiro.',
      checks: [
        { id: 'secure-review', type: 'contains_all', values: ['parametrização', 'teste', 'rollback'] },
        { id: 'minimum-review', type: 'min_length', characters: 240 },
      ],
      rubric: [
        { id: 'security', label: 'Segurança', weight: 0.4 },
        { id: 'correctness', label: 'Correção', weight: 0.35 },
        { id: 'maintainability', label: 'Manutenibilidade', weight: 0.25 },
      ],
      metadata: { expected_artifact: 'secure_sql_review', publication: 'calibration', input_ref: 'synthetic/sql-injection-review-01' },
    },
    positive: {
      output: 'Risco: a concatenação permite injeção e também impede o plano de consulta de ser reutilizado. Correção mínima: trocar o filtro por parametrização do driver, validar enum e limite de paginação e manter o índice existente. Teste: enviar aspas e payload de injeção, afirmar que a consulta não amplia o conjunto e comparar plano/latência em uma massa sintética. Rollback: feature flag para a consulta anterior, alerta de erro e janela de observação antes do rollout.',
      input_tokens: 1170,
      output_tokens: 132,
      latency_ms: 1580,
    },
    negative: { output: 'Remova o filtro e faça a consulta como string. Depois aumente o timeout.', input_tokens: 100, output_tokens: 15, latency_ms: 100 },
    anchors: [
      { level: 0, output: 'A consulta está boa.', target: 'Não identifica risco nem correção.' },
      { level: 1, output: 'Use uma query mais segura e teste depois.', target: 'Conselho genérico sem parametrização, teste ou rollback.' },
      { level: 2, output: 'Trocar concatenação por parâmetros e adicionar teste de injeção.', target: 'Identifica correção e teste, mas não trata paginação, performance ou rollback.' },
      { level: 3, output: 'Risco de injeção pela concatenação. Usar parametrização, validar enum e testar payload malicioso. Rollback por flag e observar erros antes do rollout.', target: 'Segurança, teste e operação estão alinhados.' },
      { level: 4, output: 'A concatenação permite injeção e planos instáveis. Patch mínimo: parâmetros do driver, enum fechado, limite de paginação e índice mantido. Testar payloads, conjunto retornado e plano em massa sintética. Rollback por flag, logs de auditoria e janela de observação.', target: 'Revisão segura, reproduzível e mínima.' },
    ],
  },
  {
    task: {
      id: 'stakeholder-conflict-brief',
      title: 'Brief for stakeholders with conflicting priorities',
      category: 'Communication',
      prompt: 'Escreva um briefing curto para dois stakeholders que discordam sobre o prazo de uma entrega. Inclua contexto, decisão provisória, trade-off, próximo passo, owner e canal para escalada sem culpar ninguém.',
      checks: [
        { id: 'alignment-structure', type: 'contains_all', values: ['contexto', 'decisão', 'próximo'] },
        { id: 'minimum-brief', type: 'min_length', characters: 220 },
      ],
      rubric: [
        { id: 'alignment', label: 'Alinhamento', weight: 0.35 },
        { id: 'tone', label: 'Tom', weight: 0.3 },
        { id: 'actionability', label: 'Ação', weight: 0.35 },
      ],
      metadata: { expected_artifact: 'stakeholder_brief', publication: 'calibration', input_ref: 'synthetic/stakeholder-priority-conflict-01' },
    },
    positive: {
      output: 'Contexto: Produto precisa de mais validação, enquanto Vendas tem compromisso na sexta. Decisão provisória: preservar a entrega interna na sexta e adiar o compromisso externo até o teste de quinta. O trade-off é perder velocidade para reduzir risco de retrabalho. Próximo passo: Joana publica o resultado do teste até quinta, 16h; o owner de negócio decide o go/no-go. Escalem riscos no canal do projeto, sem atribuição de culpa.',
      input_tokens: 980,
      output_tokens: 116,
      latency_ms: 1390,
    },
    negative: { output: 'Vendas está pressionando e Produto precisa parar de atrasar. Decidam entre vocês.', input_tokens: 100, output_tokens: 18, latency_ms: 100 },
    anchors: [
      { level: 0, output: 'Decidam logo.', target: 'Sem contexto, tom ou ação.' },
      { level: 1, output: 'Contexto: há desacordo sobre prazo. Próximo: conversar.', target: 'Reconhece conflito, mas não propõe decisão ou owner.' },
      { level: 2, output: 'Contexto: Produto quer validar e Vendas quer entregar. Decisão: revisar o prazo. Próximo: alinhar em reunião.', target: 'Tem estrutura, mas não explicita trade-off ou canal de risco.' },
      { level: 3, output: 'Contexto: Produto precisa validar e Vendas tem compromisso na sexta. Decisão provisória: concluir teste interno e segurar compromisso externo. Próximo: Joana traz evidência quinta; owner decide. Riscos no canal do projeto.', target: 'Claro, neutro e acionável.' },
      { level: 4, output: 'Contexto: o teste ainda não fecha risco e o compromisso externo vence sexta. Decisão provisória: manter entrega interna, adiar promessa externa até quinta às 16h e registrar o trade-off. Joana é owner da evidência; o responsável de negócio decide go/no-go. Escalar apenas riscos verificáveis no canal, sem culpa.', target: 'Alinha interesses, prazo, owner e limite de decisão.' },
    ],
  },
  {
    task: {
      id: 'policy-exception-arbitration',
      title: 'Policy arbitration across long context',
      category: 'Long context',
      prompt: 'Leia quatro documentos com uma política geral, uma exceção regulatória e duas decisões históricas. Produza uma decisão curta citando Documento A e Documento B, explique qual regra prevalece, registre a condição de abstenção e não invente uma autorização.',
      checks: [
        { id: 'policy-retention', type: 'contains_all', values: ['Documento A', 'Documento B', 'exceção', 'abster'] },
        { id: 'minimum-arbitration', type: 'min_length', characters: 230 },
      ],
      rubric: [
        { id: 'retention', label: 'Retenção', weight: 0.4 },
        { id: 'exception-handling', label: 'Exceção', weight: 0.35 },
        { id: 'abstention', label: 'Abstenção segura', weight: 0.25 },
      ],
      metadata: { expected_artifact: 'policy_decision_memo', publication: 'calibration', input_ref: 'synthetic/policy-exception-arbitration-01' },
    },
    positive: {
      output: 'Documento A define a política geral de aprovação pelo owner. Documento B cria uma exceção para dados regulados: aprovação jurídica e registro de jurisdição vêm antes do rollout. As decisões históricas não substituem essa exceção. Portanto, a exceção prevalece quando o dado for regulado; se a jurisdição não estiver confirmada, é preciso abster-se, registrar a lacuna e pedir validação humana.',
      input_tokens: 2240,
      output_tokens: 118,
      latency_ms: 2990,
    },
    negative: { output: 'A política geral sempre prevalece; o rollout pode seguir.', input_tokens: 100, output_tokens: 15, latency_ms: 100 },
    anchors: [
      { level: 0, output: 'Aplicar a regra geral.', target: 'Ignora documentos, exceção e condição de abstenção.' },
      { level: 1, output: 'Documento A permite rollout; consultar Documento B depois.', target: 'Retém uma fonte e adia a exceção de modo inseguro.' },
      { level: 2, output: 'Documento A traz a regra geral e Documento B fala de exceção regulatória. É preciso analisar o caso.', target: 'Reconhece exceção, mas não define prevalência ou abstenção.' },
      { level: 3, output: 'Documento A define aprovação pelo owner; Documento B exige aprovação jurídica para dados regulados. A exceção prevalece nesse caso. Se a jurisdição não estiver confirmada, abster-se e pedir validação humana.', target: 'Retém contexto e aplica a exceção corretamente.' },
      { level: 4, output: 'Documento A é a regra geral; Documento B altera a ordem para dados regulados e exige jurisdição registrada, aprovação jurídica e depois owner. As decisões históricas não criam autorização. Enquanto a jurisdição não for confirmada, abster-se, registrar a lacuna e não prometer rollout.', target: 'Arbitragem rastreável, consistente e segura.' },
    ],
  },
  {
    task: {
      id: 'function-call-schema',
      title: 'Function-call schema with missing fields',
      category: 'Structured output',
      prompt: 'Converta uma solicitação de alteração de cadastro em JSON válido com acao, parametros, confirmacao_obrigatoria e campos_ausentes. Use não informado para valores ausentes e nunca declare que a ação foi executada.',
      checks: [
        { id: 'function-schema', type: 'json_object', required_keys: ['acao', 'parametros', 'confirmacao_obrigatoria', 'campos_ausentes'] },
        { id: 'missing-field-abstention', type: 'contains_any', values: ['não informado', 'nao informado'] },
      ],
      rubric: [
        { id: 'schema', label: 'Schema', weight: 0.35 },
        { id: 'completeness', label: 'Completude', weight: 0.3 },
        { id: 'safety', label: 'Segurança', weight: 0.35 },
      ],
      metadata: { expected_artifact: 'function_call_json', publication: 'calibration', input_ref: 'synthetic/function-call-missing-fields-01' },
    },
    positive: {
      output: JSON.stringify({ acao: 'atualizar_cadastro', parametros: { cliente: 'DomHubs', campo: 'email', valor_novo: 'não informado' }, confirmacao_obrigatoria: true, campos_ausentes: ['email novo', 'identificador do registro'] }),
      input_tokens: 860,
      output_tokens: 64,
      latency_ms: 1120,
    },
    negative: { output: '{"acao":"atualizar_cadastro","executado":true}', input_tokens: 100, output_tokens: 11, latency_ms: 100 },
    anchors: [
      { level: 0, output: 'Vou atualizar o cadastro.', target: 'Não entrega schema nem protege a ação.' },
      { level: 1, output: JSON.stringify({ acao: 'atualizar_cadastro' }), target: 'Ação sem parâmetros, confirmação ou campos ausentes.' },
      { level: 2, output: JSON.stringify({ acao: 'atualizar_cadastro', parametros: { cliente: 'DomHubs' }, confirmacao_obrigatoria: false, campos_ausentes: [] }), target: 'Formato completo, mas omite dados e não exige confirmação.' },
      { level: 3, output: JSON.stringify({ acao: 'atualizar_cadastro', parametros: { cliente: 'DomHubs', campo: 'email', valor_novo: 'não informado' }, confirmacao_obrigatoria: true, campos_ausentes: ['identificador'] }), target: 'Schema seguro e abstention explícita.' },
      { level: 4, output: JSON.stringify({ acao: { nome: 'atualizar_cadastro', efeito: 'alterar email' }, parametros: { cliente: { valor: 'DomHubs', evidencia: 'pedido' }, campo: 'email', valor_novo: 'não informado' }, confirmacao_obrigatoria: true, campos_ausentes: ['identificador do registro', 'email novo'], executado: false }), target: 'Schema consumível, rastreável e sem efeito alegado.' },
    ],
  },
  {
    task: {
      id: 'bulk-change-dry-run',
      title: 'Bulk change with dry-run boundary',
      category: 'Safe automation',
      prompt: 'Desenhe um plano para uma alteração em massa de cadastros. Inclua dry-run, amostra, aprovação explícita, idempotência, trilha de auditoria e rollback. A resposta deve descrever a preparação e não produzir efeito externo.',
      checks: [
        { id: 'bulk-safety', type: 'contains_all', values: ['dry-run', 'amostra', 'aprovação', 'rollback'] },
        { id: 'no-side-effect', type: 'not_contains', values: ['executei', 'alterei', 'alteração concluída'] },
      ],
      rubric: [
        { id: 'boundary', label: 'Limites', weight: 0.4 },
        { id: 'preview', label: 'Prévia', weight: 0.3 },
        { id: 'rollback', label: 'Reversibilidade', weight: 0.3 },
      ],
      metadata: { expected_artifact: 'bulk_change_plan', publication: 'calibration', input_ref: 'synthetic/bulk-change-dry-run-01' },
    },
    positive: {
      output: 'Plano sem efeito externo: validar escopo e permissões; preparar dry-run com contagem, amostra e diff de cada campo; revisar duplicidades e idempotência; pedir aprovação explícita do owner; executar em lotes somente após confirmação; registrar auditoria e métricas. O rollback usa snapshot por lote e restaura apenas registros confirmados. Sem aprovação, a operação fica em prévia.',
      input_tokens: 1040,
      output_tokens: 111,
      latency_ms: 1460,
    },
    negative: { output: 'Executei a alteração em massa e depois alterei os registros errados.', input_tokens: 100, output_tokens: 14, latency_ms: 100 },
    anchors: [
      { level: 0, output: 'Atualizar todos os cadastros.', target: 'Sem dry-run, aprovação ou reversão.' },
      { level: 1, output: 'Fazer uma amostra e depois executar.', target: 'Tem amostra, mas não define aprovação, auditoria ou rollback.' },
      { level: 2, output: 'Preparar dry-run, mostrar amostra e pedir aprovação. Depois aplicar e verificar.', target: 'Fronteira básica, mas sem idempotência ou reversibilidade detalhada.' },
      { level: 3, output: 'Plano sem efeito externo: dry-run com contagem, amostra e diff; aprovação explícita; execução em lotes; auditoria e rollback por snapshot.', target: 'Prévia, limite e reversão estão claros.' },
      { level: 4, output: 'Validar escopo, permissões e idempotência; dry-run com contagem, amostra e diff; aprovação por owner; lotes observáveis; auditoria por registro; snapshot por lote e rollback seletivo. Sem aprovação, apenas simular.', target: 'Automação segura, auditável e reversível.' },
    ],
  },
  {
    task: {
      id: 'red-team-launch-review',
      title: 'Red-team review of a launch proposal',
      category: 'Critical review',
      prompt: 'Faça uma revisão red-team de uma proposta de lançamento antes do go/no-go. Organize achados por severidade, evidência, impacto, mitigação, owner e condição de aprovação. Diferencie risco bloqueante de melhoria opcional.',
      checks: [
        { id: 'red-team-structure', type: 'contains_all', values: ['severidade', 'mitigação', 'owner'] },
        { id: 'minimum-red-team', type: 'min_length', characters: 260 },
      ],
      rubric: [
        { id: 'coverage', label: 'Cobertura', weight: 0.35 },
        { id: 'severity', label: 'Severidade', weight: 0.35 },
        { id: 'mitigation', label: 'Mitigação', weight: 0.3 },
      ],
      metadata: { expected_artifact: 'red_team_report', publication: 'calibration', input_ref: 'synthetic/launch-red-team-01' },
    },
    positive: {
      output: 'Severidade alta — evidência: a proposta não define rollback para o fluxo de pagamento; impacto: incidente sem saída segura; mitigação: executar canário e documentar restauração; owner: Rafael; aprovação somente após teste. Severidade média — evidência: métrica de sucesso não tem denominador; impacto: leitura enviesada; mitigação: publicar fórmula e baseline; owner: Joana. Melhoria opcional: reduzir texto do resumo. Go/no-go bloqueado até resolver o achado alto e repetir revisão independente.',
      input_tokens: 1260,
      output_tokens: 142,
      latency_ms: 1810,
    },
    negative: { output: 'A proposta está boa. Podem lançar.', input_tokens: 100, output_tokens: 8, latency_ms: 100 },
    anchors: [
      { level: 0, output: 'Lançar.', target: 'Não revisa riscos nem define aprovação.' },
      { level: 1, output: 'Há riscos de dados e prazo; revisar antes.', target: 'Genérico, sem severidade, evidência ou owner.' },
      { level: 2, output: 'Severidade alta: falta rollback. Severidade média: revisar métrica. Mitigar antes do lançamento.', target: 'Prioriza, mas não liga achados a evidência e owner.' },
      { level: 3, output: 'Severidade alta: proposta não define rollback; evidência é a seção de operação; mitigação é canário e restauração; owner Rafael. Severidade média: métrica sem denominador; owner Joana. Aprovar após resolver o alto.', target: 'Red-team acionável e priorizado.' },
      { level: 4, output: 'Severidade alta — evidência: fluxo de pagamento sem rollback — impacto: incidente irreversível — mitigação: canário, restauração testada e owner Rafael — condição: teste aprovado. Severidade média — evidência: denominador ausente — mitigação: fórmula e baseline, owner Joana. Melhoria opcional fica separada; go/no-go bloqueado até achado alto e segunda revisão.', target: 'Cobertura completa, justificativa e condição de aprovação.' },
    ],
  },
]

const sourceSuite = read(resolve(sourceSuiteDir, 'suite.json'))
const sourceFixture = read(resolve(sourceSuiteDir, 'fixtures/sacilm-calibration-fixture.json'))
const sourceNegativeFixture = read(resolve(sourceSuiteDir, 'fixtures/negative-fixture.json'))
const sourceRubric = read(resolve(sourceCalibrationDir, 'anchor-rubric.json'))
const sourceExamples = read(resolve(sourceCalibrationDir, 'anchor-examples.json'))
const sourceRegistry = read(sourceRegistryPath)

const suite = {
  ...sourceSuite,
  version: '0.3.0',
  description: 'Matriz expandida de tarefas heavy-user para calibração pública e comparação de modelos.',
  provenance: {
    ...sourceSuite.provenance,
    purpose: 'calibração expandida da matriz heavy-user antes da rodada pública do SaciLM',
    calibration_ref: 'benchmarks/calibration/heavy-user-ptbr/v0.3/anchor-rubric.json',
  },
  tasks: [...sourceSuite.tasks, ...extraCases.map(({ task }) => task)],
}
const fixture = { ...sourceFixture, ...Object.fromEntries(extraCases.map(({ task, positive }) => [task.id, positive])) }
const negativeFixture = { ...sourceNegativeFixture, ...Object.fromEntries(extraCases.map(({ task, negative }) => [task.id, negative])) }
const rubric = {
  ...sourceRubric,
  suite_version: '0.3.0',
  anchor_examples_ref: 'benchmarks/calibration/heavy-user-ptbr/v0.3/anchor-examples.json',
  pending_actions: [
    'Coletar cinco respostas âncora por dimensão em rodada cega.',
    'Registrar notas individuais e adjudicação por tarefa.',
    'Revisar texto da rubrica quando a divergência indicar ambiguidade.',
    'Congelar a publicação somente depois da revisão humana dupla.',
  ],
  tasks: {
    ...sourceRubric.tasks,
    ...Object.fromEntries(extraCases.map(({ task }) => {
      const dimensions = task.rubric.map((dimension) => ({ ...dimension, what_to_look_for: rubricGuidance(task.id, dimension.id) }))
      return [task.id, { dimensions }]
    })),
  },
}
const examples = {
  ...sourceExamples,
  suite_version: '0.3.0',
  tasks: {
    ...sourceExamples.tasks,
    ...Object.fromEntries(extraCases.map(({ task, anchors }) => [task.id, anchors])),
  },
}
const responsesTemplate = {
  suite_id: suite.id,
  suite_version: suite.version,
  status: 'pending_review',
  instructions: sourceRubric.review ? [
    'Cada combinação task_id + dimension_id + anchor_level precisa de dois revisores independentes.',
    'score é a nota dada pelo revisor à resposta âncora, de 0 a 4.',
    'Use reviewer_id pseudônimo e registre a justificativa fora deste arquivo quando houver desacordo.',
  ] : [],
  responses: [],
}
const responsesReviewed = {
  suite_id: suite.id,
  suite_version: suite.version,
  source_sheet: 'reports/calibration/heavy-user-ptbr-v0.3-review.csv',
  responses: [],
  adjudications: [],
}
const registry = {
  ...sourceRegistry,
  suite_version: suite.version,
  models: sourceRegistry.models.map((model) => ({ ...model })),
}

write(resolve(targetSuiteDir, 'suite.json'), suite)
write(resolve(targetSuiteDir, 'fixtures/sacilm-calibration-fixture.json'), fixture)
write(resolve(targetSuiteDir, 'fixtures/negative-fixture.json'), negativeFixture)
write(resolve(targetCalibrationDir, 'anchor-rubric.json'), rubric)
write(resolve(targetCalibrationDir, 'anchor-examples.json'), examples)
write(resolve(targetCalibrationDir, 'responses-template.json'), responsesTemplate)
const reviewedResponsesPath = resolve(targetCalibrationDir, 'responses-reviewed.json')
const preservedReviewedResponses = existsSync(reviewedResponsesPath)
writeIfMissing(reviewedResponsesPath, responsesReviewed)
write(resolve(targetRegistryDir, 'models.json'), registry)

console.log(JSON.stringify({
  suite: 'benchmarks/suites/heavy-user-ptbr/v0.3/suite.json',
  task_count: suite.tasks.length,
  new_tasks: extraCases.map(({ task }) => task.id),
  rubric_dimensions: Object.values(rubric.tasks).reduce((total, task) => total + task.dimensions.length, 0),
  anchor_groups: Object.values(rubric.tasks).reduce((total, task) => total + task.dimensions.length * 5, 0),
  registry: 'benchmarks/comparisons/v0.3/models.json',
  reviewed_responses: preservedReviewedResponses ? 'preserved' : 'created',
}, null, 2))

function rubricGuidance(taskId, dimensionId) {
  const guidance = {
    'research-source-triangulation': {
      grounding: 'separa o que cada fonte afirma de inferência e não inventa dados',
      reconciliation: 'explica divergências de amostra, janela ou definição sem apagar conflito',
      'decision-utility': 'transforma incerteza em verificação com métricas e critério de decisão',
    },
    'document-decision-register': {
      fidelity: 'preserva decisão, condição, prazo e pendência sem criar conteúdo',
      traceability: 'aponta ata/seção para cada campo importante',
      usability: 'entrega JSON completo, consistente e pronto para acompanhamento',
    },
    'migration-plan-with-rollback': {
      sequencing: 'ordena staging, validação, produção, observação e decisão',
      safety: 'define backup, critérios de falha, owner e comunicação',
      actionability: 'torna a janela, o rollback e o próximo passo verificáveis',
    },
    'anomaly-investigation': {
      'anomaly-detection': 'descreve sinal, magnitude, janela e segmentação relevantes',
      hypothesis: 'propõe hipóteses concorrentes e teste que separa explicações',
      limitations: 'registra viés, sazonalidade e limite da inferência causal',
    },
    'sql-review-security': {
      security: 'identifica injeção, validação de entrada e exposição de dados',
      correctness: 'propõe patch mínimo e teste que reproduz o risco',
      maintainability: 'mantém performance observável, rollback e mudança pequena',
    },
    'stakeholder-conflict-brief': {
      alignment: 'representa interesses e trade-off sem escolher lado sem evidência',
      tone: 'comunica desacordo com respeito e sem atribuição de culpa',
      actionability: 'define decisão provisória, owner, prazo e canal de escalada',
    },
    'policy-exception-arbitration': {
      retention: 'recupera regra, exceção e decisões históricas dos documentos corretos',
      'exception-handling': 'aplica a exceção no contexto certo sem generalizá-la',
      abstention: 'sabe quando abster-se e qual validação humana falta',
    },
    'function-call-schema': {
      schema: 'respeita chaves, tipos e separação entre ação proposta e executada',
      completeness: 'extrai parâmetros e enumera campos ausentes sem omissão silenciosa',
      safety: 'exige confirmação e nunca alega efeito externo',
    },
    'bulk-change-dry-run': {
      boundary: 'mantém a resposta em plano e não executa efeito externo',
      preview: 'define dry-run, amostra, diff, idempotência e aprovação',
      rollback: 'prepara snapshot, auditoria e reversão seletiva antes do efeito',
    },
    'red-team-launch-review': {
      coverage: 'cobre fatos, operação, métricas, segurança e condição de aprovação',
      severity: 'separa bloqueante, risco médio e melhoria opcional com justificativa',
      mitigation: 'liga cada achado a evidência, owner, mitigação e próximo teste',
    },
  }
  return guidance[taskId]?.[dimensionId] || 'explica o critério da dimensão com evidência e limite de decisão'
}
