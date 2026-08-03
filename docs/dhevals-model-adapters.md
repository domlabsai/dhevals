# DHEvals — adapters de modelos e CLIs

O DHEvals separa a suíte, o grading e os artefatos do modo como um modelo é
acessado. O SaciLM é apenas uma lane futura; outros modelos podem ser avaliados
agora por endpoint OpenAI-compatible ou por um CLI local.

## Lane genérica

```bash
export DHEVALS_MODEL_ID="qwen-local"
export DHEVALS_MODEL_PROVIDER="qwen-cli"
export DHEVALS_MODEL_ADAPTER="command-line"
export DHEVALS_MODEL_CLI_COMMAND="qwen --model qwen3 --prompt"
export DHEVALS_MODEL_CLI_PROMPT_MODE="stdin"
export DHEVALS_MODEL_CLI_CWD="/tmp/dhevals-cli-sandbox"
export DHEVALS_MODEL_SUITE_PATH="benchmarks/suites/heavy-user-ptbr/v0.3/suite.json"
npm run run:model
```

O valor de `DHEVALS_MODEL_CLI_COMMAND` é dividido com `shlex` e executado com
`shell=false`; o prompt da tarefa nunca é interpolado em um shell. O stdout é
tratado como a resposta do modelo e stderr aparece apenas no diagnóstico local.
Cada tarefa tem timeout independente e falha de processo permanece como erro
de infraestrutura, nunca como nota zero. O `run:model` faz uma nova tentativa
automática somente quando há timeout (uma tentativa extra por padrão, com
timeout 2x maior). Configure `DHEVALS_MODEL_CLI_TIMEOUT_RETRIES=0` para
desativar ou `DHEVALS_MODEL_CLI_TIMEOUT_BACKOFF` para alterar o multiplicador.
Ao expirar, o grupo inteiro de processos do CLI é encerrado e recolhido; isso
evita que um processo filho do OpenCode continue consumindo cota depois do
registro do erro.

Quando o CLI possui um agente capaz de ler ou editar arquivos (como o modo
`build` do OpenCode), defina `DHEVALS_MODEL_CLI_CWD` para um diretório vazio e
temporário. O runner usará esse diretório como `cwd`, mantendo a tarefa
isolada do repositório e evitando alterações externas. O manifesto deve conter
um `context` textual quando a tarefa depender de brief, tabela, código ou
evidência; esse contexto é anexado de forma auditável ao prompt enviado.

O comando aceita os placeholders `{model}`, `{temperature}`, `{max_tokens}` e
`{prompt}`. Use `{prompt}` somente com `DHEVALS_MODEL_CLI_PROMPT_MODE=arg`.
Sem placeholder de prompt no modo `arg`, o runner acrescenta o prompt como o
último argumento.

## Exemplos de configuração

Os nomes e flags variam entre versões dos CLIs; confirme `--help` localmente e
conserve a configuração usada no registro do experimento.

```bash
# OpenCode — exemplo isolado, com prompt como argumento
export DHEVALS_MODEL_ID="opencode-local"
export DHEVALS_MODEL_PROVIDER="opencode-cli"
export DHEVALS_MODEL_CLI_COMMAND="opencode run --pure --model openai/gpt-oss"
export DHEVALS_MODEL_CLI_PROMPT_MODE="arg"
export DHEVALS_MODEL_CLI_CWD="/tmp/dhevals-opencode-sandbox"
npm run run:model

# OpenCode Go alternativo gratuito — DeepSeek V4 Flash
export DHEVALS_MODEL_ID="opencode/deepseek-v4-flash-free"
export DHEVALS_MODEL_PROVIDER="opencode"
export DHEVALS_MODEL_ADAPTER="command-line"
export DHEVALS_MODEL_CLI_COMMAND="opencode run --pure --variant minimal --model opencode/deepseek-v4-flash-free"
export DHEVALS_MODEL_CLI_PROMPT_MODE="arg"
export DHEVALS_MODEL_CLI_CWD="/tmp/dhevals-opencode-sandbox"
export DHEVALS_MODEL_CLI_TIMEOUT_SECONDS="180"
export DHEVALS_MODEL_CLI_TIMEOUT_RETRIES="1"
export DHEVALS_MODEL_CLI_TIMEOUT_BACKOFF="2"
npm run run:model

# Qwen — exemplo com prompt como argumento
export DHEVALS_MODEL_ID="qwen-local"
export DHEVALS_MODEL_PROVIDER="qwen-cli"
export DHEVALS_MODEL_CLI_COMMAND="qwen --model Qwen3-32B"
export DHEVALS_MODEL_CLI_PROMPT_MODE="arg"
npm run run:model

# Kimi — exemplo usando um wrapper local versionado
export DHEVALS_MODEL_ID="kimi-local"
export DHEVALS_MODEL_PROVIDER="kimi-cli"
export DHEVALS_MODEL_CLI_COMMAND="kimi --model kimi-k2"
export DHEVALS_MODEL_CLI_PROMPT_MODE="stdin"
npm run run:model
```

Quando o CLI exigir autenticação, mantenha a chave no ambiente do próprio CLI;
ela não é copiada para o run manifest, reports ou console. Não coloque tokens
no valor do comando, porque o processo pode aparecer no histórico do shell.

## Endpoint HTTP

Para servidores locais ou hospedados que expõem `/v1/chat/completions`:

```bash
export DHEVALS_MODEL_ID="qwen-vllm"
export DHEVALS_MODEL_PROVIDER="vllm"
export DHEVALS_MODEL_ADAPTER="openai-compatible"
export DHEVALS_MODEL_BASE_URL="http://127.0.0.1:8000/v1"
export DHEVALS_MODEL_API_KEY_ENV="DHEVALS_MODEL_API_KEY"
npm run run:model
```

O adapter HTTP envia `model`, `messages`, `temperature`, `max_tokens` e `seed`
e registra usage quando o servidor o fornece.

## Comparações e publicação

Para uma comparação multi-modelo, adicione uma entrada ao registry de uma
versão com `adapter: "command-line"`, `cli_command_env` e opcionalmente
`cli_prompt_mode`; para HTTP, use `adapter: "openai-compatible"` e
`base_url_env`. O campo `policy.primary_model_id` define qual lane pode ser
usada como primária durante uma promoção; não há dependência implícita do
SaciLM. Mesmo quando a execução é concluída, o contrato de comparação mantém
os scores bloqueados até verificação, calibração e release gate.

Um ponto de partida com três lanes CLI está em
[`benchmarks/comparisons/templates/cli-models.v0.3.example.json`](../benchmarks/comparisons/templates/cli-models.v0.3.example.json).
Copie-o para um registry de trabalho, configure `DHEVALS_QWEN_COMMAND`,
`DHEVALS_OPENCODE_COMMAND` e `DHEVALS_KIMI_COMMAND`, e execute:

```bash
export DHEVALS_COMPARISON_REGISTRY="/caminho/para/cli-models.v0.3.json"
export DHEVALS_COMPARISON_SUITE="benchmarks/suites/heavy-user-ptbr/v0.3/suite.json"
export DHEVALS_COMPARISON_PROMOTE=0
npm run run:comparison
```

O `run:model` é deliberadamente archive-only. A promoção pública continua sendo
uma operação transacional e exige um registry com `primary_model_id`, artefatos
de calibração e release gate válidos.
