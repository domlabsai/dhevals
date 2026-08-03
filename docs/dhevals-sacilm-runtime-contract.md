# DHEvals — contrato de runtime do SaciLM

O DHEvals não acopla a avaliação ao provedor de GPU. O runtime do SaciLM precisa expor uma API compatível com Chat Completions para que o mesmo manifesto e os mesmos prompts possam ser executados no fixture, no fake HTTP e no endpoint real.

## Contrato mínimo

Endpoint configurado em `DHEVALS_SACILM_BASE_URL`:

```http
POST /v1/chat/completions
Content-Type: application/json
Authorization: Bearer <token opcional>
```

Payload enviado pelo adapter:

```json
{
  "model": "sacilm",
  "messages": [{"role": "user", "content": "<prompt da tarefa>"}],
  "temperature": 0.2,
  "max_tokens": 2048,
  "seed": 7
}
```

Resposta mínima esperada:

```json
{
  "choices": [{
    "message": {"content": "<resposta do modelo>"},
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 123,
    "completion_tokens": 456
  }
}
```

Respostas sem `choices[0].message.content`, JSON inválido, HTTP de erro e timeout tornam a tarefa `error`; elas não recebem score de qualidade.

## Manifesto versionado do SaciLM

O arquivo `benchmarks/models/sacilm/v0.1/model.json` é a fonte de proveniência do
modelo. Ele registra base model/licença, checkpoint, dataset e hash (quando
congelados), configuração do Unsloth, quantização, hardware do RunPod, engine
de inferência e parâmetros de geração. O manifesto inicial é `draft` porque a
seleção do base model, o checkpoint e o hash do dataset ainda precisam ser
fechados; isso não bloqueia fixtures nem runs archive-only.

Para `status: "ready"`, o validador exige valores congelados: revisão e
SHA-256 do checkpoint, SHA-256/licença do dataset, commit do post-training,
configuração de LoRA/seq length/packing e imagem concreta do runtime. Alterar
apenas o status não libera publicação.

Valide ou calcule o hash antes de uma rodada:

```bash
npm run validate:sacilm-manifest
uv run --python 3.12 --project packages/dhevals_core dhevals-model hash \
  --manifest benchmarks/models/sacilm/v0.1/model.json
# Depois de congelar a proveniência, use --require-ready para o gate de publicação.
uv run --python 3.12 --project packages/dhevals_core dhevals-model validate \
  --require-ready --manifest benchmarks/models/sacilm/v0.1/model.json
```

Para materializar o manifesto sem editar JSON manualmente, preencha as
variáveis `DHEVALS_SACILM_BASE_MODEL_ID`, `DHEVALS_SACILM_BASE_MODEL_LICENSE`,
`DHEVALS_SACILM_CHECKPOINT_REVISION`, `DHEVALS_SACILM_CHECKPOINT_SHA256`,
`DHEVALS_SACILM_DATASET_SHA256`, `DHEVALS_SACILM_DATASET_LICENSE`,
`DHEVALS_SACILM_QUANTIZATION`, `DHEVALS_SACILM_LORA`,
`DHEVALS_SACILM_SEQUENCE_LENGTH`, `DHEVALS_SACILM_PACKING`,
`DHEVALS_SACILM_HARDWARE`, `DHEVALS_SACILM_RUNTIME_IMAGE` e
`DHEVALS_SACILM_TRAINING_COMMIT`, depois execute
`npm run finalize:sacilm-manifest`. O padrão grava
`benchmarks/models/sacilm/v0.1/model-ready.json`; a chave nunca é gravada no
manifesto.

Após a finalização, `preflight:sacilm`, `run:sacilm`, `run:comparison`,
`check:sacilm-readiness` e `audit:goal` preferem esse manifesto pronto
automaticamente quando `DHEVALS_SACILM_MODEL_MANIFEST` não foi definido. Um
valor explícito nessa variável sempre tem precedência.

O runner embute uma cópia do manifesto em `run.model.extra.model_manifest` e
seu SHA-256 canônico em `run.model.extra.model_manifest_hash`. Credenciais não
são aceitas no arquivo; use apenas nomes de variáveis de ambiente.

## Proveniência obrigatória da rodada

O runner registra em `run.model.extra` os valores fornecidos pelo comando:

| Campo | Variável | Exemplo |
| --- | --- | --- |
| Checkpoint/revisão | `DHEVALS_SACILM_CHECKPOINT` | `sacilm-7b-sft-v0.1` |
| Runtime | `DHEVALS_SACILM_RUNTIME` | `Unsloth + vLLM on RunPod` |
| Commit de post-training | `DHEVALS_SACILM_TRAINING_COMMIT` | `a1b2c3d` |
| Manifesto do modelo | `DHEVALS_SACILM_MODEL_MANIFEST` | `benchmarks/models/sacilm/v0.1/model.json` |

Esses campos não substituem a hash da suíte: o artefato só é comparável quando modelo, configuração, prompt, fixture, checks e versão da suíte estão identificados.

## Smoke antes do full run

1. Iniciar o endpoint no RunPod.
2. Executar o preflight de uma única chamada:

```bash
export DHEVALS_SACILM_BASE_URL="https://seu-endpoint/v1"
export DHEVALS_SACILM_API_KEY="..." # opcional
export DHEVALS_SACILM_CHECKPOINT="sacilm-checkpoint"
export DHEVALS_SACILM_RUNTIME="Unsloth + vLLM on RunPod"
export DHEVALS_SACILM_TRAINING_COMMIT="git-sha-do-post-training"
export DHEVALS_SACILM_MODEL_MANIFEST="benchmarks/models/sacilm/v0.1/model.json"
npm run preflight:sacilm
```

O preflight grava `reports/preflight/sacilm-latest.json` sem armazenar a chave e valida HTTP, JSON, `choices[0].message.content`, latência, usage e provenance. Ele precisa retornar `status: ready` antes do full run.

Por segurança operacional, `run:sacilm` e `run:comparison` também exigem que o preflight tenha sido gerado nas últimas seis horas (`DHEVALS_SACILM_PREFLIGHT_MAX_AGE_MS` pode reduzir ou ampliar a janela). Um endpoint que mudou desde o smoke test precisa passar pelo preflight novamente.

O preço é opcional e não é consultado pelo preflight: se disponível, informe `DHEVALS_SACILM_INPUT_COST_PER_1K` e `DHEVALS_SACILM_OUTPUT_COST_PER_1K` em USD por 1.000 tokens. O runner registra a estimativa separadamente da qualidade.

3. Executar `npm run run:sacilm`. Por padrão, o comando usa a matriz heavy-user v0.2 com as dez tarefas; uma suíte alternativa só deve ser escolhida explicitamente por `DHEVALS_SACILM_SUITE_PATH`.
4. Conferir `summary.coverage`, tarefas `error` e `run.model.extra`.
5. Abrir a console e validar o `run-id` e a hash da suíte antes de publicar qualquer score.

Quando `DHEVALS_SACILM_SUITE_PATH` aponta para uma versão diferente da baseline v0.2, o run é `archive-only` por padrão e fica em `reports/runs/`; isso evita substituir a console pública acidentalmente. Para promover explicitamente uma versão, use `DHEVALS_SACILM_PROMOTE=1` e forneça também os caminhos de auditoria/calibração correspondentes.

O wrapper é exercitado offline por `npm run test:sacilm-wrapper`: um servidor OpenAI-compatible descartável responde as 20 tarefas da v0.3, confirma cobertura, score e verificação e prova que o artefato `latest` permanece inalterado.
O smoke `npm run test:sacilm-preflight` também exercita a chamada única e confirma que o diagnóstico registra a identidade do manifesto sem armazenar segredos.
O smoke `npm run test:sacilm-e2e` combina os dois contratos: executa o preflight, roda a suíte completa pelo mesmo adapter HTTP, verifica os artefatos e confirma que uma rodada archive-only não altera a baseline pública.

6. Executar `npm run check:release`. Se retornar `blocked`, não publicar: o arquivo `public/data/latest-release-gate.json` lista exatamente o artefato ausente ou incompatível (calibração, leaderboard, verificação ou provider).

`run:sacilm` aplica essa regra antes da promoção: o run, report, leaderboard e
gate candidato são escritos em `reports/runs/`; somente um gate `ready` copia
os artefatos para `public/data`. Um manifesto `draft` ou calibração pendente
continua disponível para diagnóstico no arquivo, mas não substitui a baseline
pública. O contrato é exercitado por `npm run test:sacilm-promotion` (gate
blocked) e `npm run test:sacilm-promotion-ready` (preflight, promoção local
controlada e release gate `ready` em um ambiente descartável).

## Configuração de geração

O runner envia a mesma configuração determinística para cada tarefa: temperatura `0.2`, `max_tokens` `2048` e seed `7`. Para uma rodada exploratória, esses valores podem ser substituídos sem alterar o manifesto:

```bash
export DHEVALS_SACILM_TEMPERATURE=0.2
export DHEVALS_SACILM_MAX_TOKENS=2048
export DHEVALS_SACILM_SEED=7
```

Se o processo falhar, o script não promove a rodada para `latest-run.json` nem gera report/leaderboard; assim uma rodada quebrada não substitui silenciosamente o artefato público anterior. O JSON bruto da tentativa permanece em `reports/runs/` para diagnóstico.
