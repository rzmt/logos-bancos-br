# Aviso sobre marcas (trademarks)

*(English below)*

## Os logos não são licenciados por este repositório

Os arquivos em `logos/` reproduzem **marcas registradas das respectivas instituições
financeiras**. Eles **não** são cobertos pela licença MIT deste repositório e permanecem
propriedade dos seus titulares. Nenhuma afiliação, patrocínio ou endosso por parte das
instituições é sugerido ou deve ser inferido.

## De onde vêm e por que são redistribuídos

- Cada logo provém de arte que **a própria instituição publica e mantém** no
  [diretório público de participantes do Open Finance Brasil](https://data.directory.openbankingbrasil.org.br/participants)
  (`AuthorisationServers[].CustomerFriendlyLogoUri`) — um cadastro oficial do ecossistema
  regulado pelo Banco Central, criado exatamente para que terceiros identifiquem visualmente as
  instituições — ou, em exceções revisadas à mão, de URL oficial da instituição.
- A proveniência de cada arquivo (URI de origem, SHA-256 do original, data) está registrada em
  [`data/bancos.json`](data/bancos.json) e no histórico do git.
- A finalidade da redistribuição é o **uso nominativo**: exibir o logo para identificar a
  instituição em interfaces (listas de bancos, extratos, comprovantes Pix/TED, DDA etc.).

## Responsabilidades de quem usa

- Use os logos apenas para **identificar a instituição correspondente** — não para sugerir
  parceria, endosso ou origem do seu produto.
- Não deforme, recolora ou combine as marcas com outros elementos de forma enganosa.
- Usos além do nominativo (material publicitário, impressos, co-branding) podem exigir autorização
  do titular da marca — consulte o manual de marca da instituição.
- O software e os dados são fornecidos "no estado em que se encontram", sem garantias.

## Correção e remoção (takedown)

Se você representa uma instituição e deseja **corrigir ou remover** um logo deste repositório:

1. Abra uma issue com o template **"Remoção de marca"** (ou "Logo incorreto"), identificando a
   instituição (ISPB/CNPJ) e a solicitação; ou
2. Se preferir contato privado, abra uma issue pedindo um canal de contato.

Pedidos legítimos são atendidos prontamente: o arquivo é removido/corrigido, a URL entra na
`denylist` do pipeline (para não voltar) e uma versão nova do pacote é publicada.

---

# Trademark notice (English)

The files under `logos/` reproduce **trademarks of their respective financial institutions**. They
are **not** covered by this repository's MIT license and remain the property of their owners. No
affiliation, sponsorship or endorsement is implied.

Each logo comes from artwork **published and maintained by the institution itself** in the public
[Open Finance Brasil participants directory](https://data.directory.openbankingbrasil.org.br/participants)
— an official registry of the Central Bank-regulated ecosystem, built precisely so third parties
can visually identify institutions — or, in hand-reviewed exceptions, from an official URL of the
institution. Per-file provenance (source URI, SHA-256, date) is recorded in
[`data/bancos.json`](data/bancos.json).

Redistribution is intended for **nominative use**: displaying a logo to identify the corresponding
institution in user interfaces. Do not use the marks to imply endorsement, and do not distort
them. Uses beyond nominative fair use may require the trademark owner's permission.

**Takedown**: institutions can request correction or removal via the "Remoção de marca" issue
template. Legitimate requests are handled promptly — the file is removed, the URL is denylisted in
the pipeline, and a new package version is released.
