# Contribuindo

Obrigado pelo interesse! Este repositório tem duas partes: o **pacote** (o que os consumidores
instalam: `data/`, `logos/`, `dist/`, `react-native.js`) e o **pipeline** (o que gera tudo isso a
partir das fontes oficiais).

## Setup

Requisitos: Node >= 20.

```bash
npm install
npm test              # vitest
npm run lint          # biome
npm run typecheck     # tsc --noEmit
npm run build         # tsup -> dist/
```

Commits seguem [Conventional Commits](https://www.conventionalcommits.org/pt-br/) com descrição em
português (`feat:`, `fix:`, `docs:`, `build:`, `ci:` …).

## Rodando o pipeline

```bash
npm run pipeline                  # rodada completa (baixa fontes + logos, grava o que mudou)
npm run pipeline -- --dry-run     # não grava nada; só o relatório
npm run pipeline -- --only 341,0260,60701190   # subconjunto (COMPE ou ISPB), para depurar
npm run pipeline -- --force       # re-baixa e re-encoda tudo (ignora o manifest)
```

O pipeline é **idempotente**: rodar duas vezes seguidas não deve alterar nada na segunda. Ele
imprime um resumo e grava `pipeline/report.md` (usado como corpo do PR automático). Regras de
ouro: fonte fora do ar aborta sem tocar em nada; falha de download **nunca apaga** um logo já
publicado; arquivos órfãos só são removidos manualmente.

Saídas geradas (commitadas): `data/bancos.json`, `logos/png/<ispb>.png`,
`logos/svg/<ispb>.svg`, `PREVIEW.md`, `react-native.js`, `pipeline/manifest.json`.

## Adicionando/corrigindo logos (o fluxo mais comum)

O relatório lista **sugestões por nome** — instituições cujo ISPB não bate com nenhum CNPJ do
diretório Open Finance, mas cujo nome se parece com o de alguma organização. Elas **nunca** são
gravadas automaticamente. Para promover uma sugestão:

1. Confirme que é a mesma instituição/marca (fontes públicas: site da instituição, BCB).
2. **Olhe o logo** da organização sugerida (URI no relatório) — confirme visualmente.
3. Adicione em `pipeline/config.json` → `forcedMatches`: `"<ISPB(8)>": "<CNPJ(14) da organização>"`.
4. `npm run pipeline` e confira o diff das imagens no PR (o GitHub renderiza PNG).

Outras ferramentas do `pipeline/config.json`:

- `denylistUris` — URLs de logo quebradas/erradas publicadas pela instituição. Com a URL banida, o
  pick escolhe outro AuthorisationServer da mesma organização (se houver).
- `forcedUris` — `"<ISPB>": "https://…"` força uma URL específica (deve ser oficial; documente a
  origem no PR).
- `pipeline/overrides/<ISPB>.(svg|png)` — arte mantida à mão para casos fora do Open Finance.
  **Só com proveniência limpa** (press kit/manual de marca oficial): documente a origem no PR.
- `ignoreIspb` — instituições a pular por completo.

Logo errado em produção? Abra issue com o template **"Logo incorreto"**.

## Testes

`tests/` cobre parsing do CSV do BCB, indexação do diretório, precedência de matches, desempates
(matriz de conglomerado, URI majoritária), sanitização de SVG, dataset e a API pública. Toda regra
nova de matching precisa de teste — o custo de um logo errado é alto.

## Release / publicação no npm

1. `npm version <patch|minor|major>` (atualiza `package.json` + tag).
2. `git push && git push --tags`.
3. Crie uma **Release** no GitHub a partir da tag — o workflow `publish.yml` publica no npm com
   `--provenance` (build rastreável ao commit/Action).

Pré-requisito (uma vez): secret `NPM_TOKEN` no repositório (Settings → Secrets → Actions) com um
*granular access token* do npm com permissão de publicação neste pacote.

Convenção de versão: atualização de logos/dados → `patch`; mudanças na API/CLI → `minor`;
quebras → `major`.
