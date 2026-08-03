# DHEvals — release gate

O release gate é a última barreira antes de transformar uma rodada em resultado público. Ele não altera score nem reexecuta o modelo; apenas reconcilia os artefatos canônicos da rodada.

```bash
npm run build:release-gate
```

O diagnóstico é salvo em `reports/release/latest.json` e publicado para leitura da console em `public/data/latest-release-gate.json`. O comando de CI é estrito:

```bash
npm run check:release
```

Uma publicação só fica `ready` quando todos os itens abaixo passam:

- a suíte, versão e hash do manifesto batem com o run e o report;
- `dhevals-verify` valida o artefato e o report derivado;
- `dhevals-audit` confirma fixtures, rubrica, exemplos, âncoras e registry;
- existem duas revisões humanas por grupo, sem pendências ou desacordos;
- o leaderboard está pronto, sem fixtures e sem entradas de outra versão;
- o provider da rodada não é `fixture`.

O gate não transforma uma lacuna independente em proxy: o artefato judge é
servido separadamente e aparece como `not_evaluated` no scorecard quando ainda
não foi configurado. Safety, agent/tool-use e judge só passam a contribuir
quando seus contratos independentes produzem evidência válida.

Enquanto qualquer gate estiver pendente, o diagnóstico permanece `blocked` e a console mostra os motivos. Isso é esperado no desenvolvimento da v0.2: o fixture prova o pipeline, mas não pode virar ranking público.
