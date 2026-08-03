# Checklist da primeira rodada real do SaciLM

O caminho local já possui fixtures e wrappers. A primeira rodada real deve ser
feita em etapas para não substituir a baseline pública antes dos gates.

## 1. Congelar proveniência

Defina no ambiente local (nunca no JSON versionado) o checkpoint, hash do
dataset, commit do post-training, imagem/runtime do RunPod e revisão do modelo.
Depois materialize o manifesto:

```bash
npm run finalize:sacilm-manifest
npm run check:sacilm-readiness
```

O readiness precisa sair de `blocked/pending` para `ready` no manifesto e no
endpoint. O arquivo não imprime a URL nem qualquer chave.

## 2. Validar o endpoint

```bash
npm run preflight:sacilm
npm run check:sacilm-readiness
```

O endpoint deve aceitar `POST /v1/chat/completions`, devolver `choices[0].message.content`
e informar uso de tokens quando possível. O preflight é uma chamada única e
tem validade limitada.

## 3. Rodar sem publicar

Comece com a suíte expandida em modo archive-only:

```bash
DHEVALS_SACILM_SUITE_PATH=benchmarks/suites/heavy-user-ptbr/v0.3/suite.json \
npm run run:sacilm
```

Inspecione o report, a verificação, o custo, a latência e os erros de
infraestrutura. A v0.3 não altera `public/data` sem `DHEVALS_SACILM_PROMOTE=1`.

## 4. Calibrar e promover

Preencha os dois CSVs cegos de cada pack, importe adjudicações quando houver
desacordo e confirme `ready`:

```bash
npm run import:calibration:v03
npm run build:calibration
npm run check:sacilm-readiness
```

Só então rode a v0.2 com `npm run run:sacilm`. A promoção é staged e o release
gate precisa retornar `ready`; manifesto draft, calibração pendente, fixture,
erro de infraestrutura ou ranking inconsistente deixam a baseline anterior
intacta.
