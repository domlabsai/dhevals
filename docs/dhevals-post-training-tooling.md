# DHEvals — mapa de tooling de pós-training

O treinamento do SaciLM fica fora do runner DHEvals. O runner consome apenas
um manifesto versionado e um endpoint de inferência. Essa separação permite
trocar a ferramenta de pós-training sem alterar a matriz, o grading ou os
relatórios. O campo `post_training.tool` do manifesto aceita a ferramenta
registrada para cada modelo; Unsloth é a escolha inicial do SaciLM, não uma
dependência para lanes externas.

## Caminho inicial

| Camada | Escolha inicial | Papel |
| --- | --- | --- |
| Fine-tuning | Unsloth | SFT/LoRA eficiente em memória e com configuração reproduzível |
| GPU sob demanda | RunPod | execução variável sem imobilizar infraestrutura |
| Treinamento base | PyTorch + Transformers/TRL | datasets, SFT e etapas de alinhamento quando necessárias |
| Serving | vLLM | endpoint OpenAI-compatible consumido pelo DHEvals |
| Tracking | Trackio, W&B ou MLflow | loss, configuração, artefatos e lineage do experimento |
| Dados | Hugging Face Datasets + DVC/equivalente | versionamento, hashes, cards e reprodutibilidade |

## Alternativas compatíveis

| Necessidade | Opções | Trade-off principal |
| --- | --- | --- |
| Pipeline declarativo de fine-tuning | Axolotl, LLaMA-Factory | acelera experimentos, mas exige validar defaults e proveniência |
| Stack PyTorch mais explícita | torchtune, Transformers + TRL | maior controle e integração, com mais configuração manual |
| Preference/post-training | TRL (DPO/ORPO), OpenRLHF | amplia alinhamento, mas exige dados de preferência e controles de avaliação |
| Serving de baixa latência | vLLM, SGLang, TGI | escolher por compatibilidade de modelo, batching e observabilidade |
| Serving local/edge | llama.cpp, Ollama | útil para smoke local, não substitui o contrato de produção sem medir limites |
| Tracking de experimentos | Trackio, W&B, MLflow | todos devem exportar commit, config, métricas e artefatos referenciáveis |

Nenhuma alternativa deve ser escolhida apenas por um score de treino. Antes de
trocar o caminho Unsloth/RunPod, registre no manifesto o método, versão da
ferramenta, commit, dataset/hash, checkpoint/hash, hardware, imagem e runtime
de inferência. Se esses campos não puderem ser congelados, o manifesto fica
`draft` e a rodada permanece archive-only.

## Critérios de seleção

1. reproduzir o mesmo checkpoint a partir do commit e dos hashes registrados;
2. exportar um formato servido pelo adapter OpenAI-compatible;
3. separar métricas de treino das métricas DHEvals;
4. permitir interromper ou repetir uma rodada sem substituir a baseline;
5. não introduzir credenciais ou dados pessoais nos artefatos públicos;
6. manter custo, hardware e limitações explícitos no model card.

O contrato operacional detalhado está em
[`dhevals-sacilm-runtime-contract.md`](./dhevals-sacilm-runtime-contract.md),
e o manifesto inicial em
`benchmarks/models/sacilm/v0.1/model.json`.
