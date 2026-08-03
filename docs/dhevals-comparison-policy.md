# DHEvals — política de modelos de comparação

O arquivo [models.json](../benchmarks/comparisons/v0.2/models.json) registra quais modelos podem participar de uma comparação. A suíte, hash, configuração de geração e política de calibração são comuns; adapter (HTTP ou CLI), configuração e proveniência variam. O campo `policy.primary_model_id` define a lane primária sem pressupor SaciLM.

O baseline GPT-4 Turbo está registrado como comparação-only e sem endpoint configurado. Ele não recebe score até uma rodada real ser executada. Fixtures e lanes incompletas permanecem bloqueadas no leaderboard.

O registry pode declarar variáveis de provenance por modelo. Para uma lane CLI,
use `adapter: "command-line"`, `cli_command_env` e `cli_prompt_mode`; para HTTP,
use `adapter: "openai-compatible"` e `base_url_env`. Variáveis de checkpoint,
runtime e commit acompanham a comparação quando estiverem disponíveis.

Se houver preço conhecido, `input_cost_env` e `output_cost_env` podem apontar para valores em USD por 1.000 tokens. O custo estimado é exibido separadamente da qualidade e não é usado para ordenar o leaderboard.

Mesmo uma rodada real, completa e sem erros permanece `locked` enquanto o resumo de calibração humana da matriz estiver diferente de `ready`. O script de publicação injeta esse gate automaticamente a partir de `reports/calibration/heavy-user-ptbr-v0.2-summary.json` (ou do caminho indicado em `DHEVALS_CALIBRATION_SUMMARY`).

Quando o SaciLM é incluído em `run:comparison` por HTTP, o orquestrador ainda
exige o mesmo preflight de `run:sacilm`; essa é uma regra específica dessa lane,
não do DHEvals. Se o preflight estiver ausente, expirado ou incompatível, o
SaciLM fica `blocked` e nenhuma rodada dele é consumida. Outras lanes HTTP/CLI
seguem seu próprio contrato de configuração.

O contrato completo do orquestrador é exercitado por `npm run test:comparison-wrapper`;
duas lanes passam pela mesma suíte v0.3 em endpoint local OpenAI-compatible, e
`npm run test:model-cli` cobre uma lane CLI sem shell. O modo archive-only deixa
`latest` e o leaderboard públicos inalterados.

Comparações com uma suíte diferente da baseline v0.2 ficam archive-only por padrão: reports entram em `reports/runs/`, mas não alteram leaderboard ou console. Para promover explicitamente uma versão, use `DHEVALS_COMPARISON_PROMOTE=1` e configure os caminhos de auditoria/calibração correspondentes.

Depois da rodada, `npm run build:release-gate` reconcilia os reports da comparação com a suíte, a auditoria e a calibração. Uma comparação só pode ser promovida quando o gate estiver `ready`; o diagnóstico fica disponível em `public/data/latest-release-gate.json`.

Na promoção, `run:comparison` primeiro grava o leaderboard e o gate candidato
fora de `public/data`, usando o `primary_model_id` selecionado para a
reconciliação. Somente depois de um gate `ready` ele atualiza a rodada pública,
o leaderboard e os catálogos. `npm run test:comparison-promotion` verifica que um manifesto
`draft` não altera a baseline; `npm run test:sacilm-promotion-ready` também
exercita a promoção positiva de um pacote pronto em ambiente local, incluindo
o preflight antes da execução e a verificação do release gate `ready`.
