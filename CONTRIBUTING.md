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

## Primeira contribuição (e Hacktoberfest)

Quer começar? As issues com label
[`good first issue`](https://github.com/rzmt/logos-bancos-br/labels/good%20first%20issue) pedem
uma coisa só: achar a URL do logo oficial de uma instituição no site dela — o pipeline faz todo o
resto (download, sanitização, PNG 256px, proveniência). Em outubro, elas valem para o
Hacktoberfest.

## Adicionando/corrigindo logos (o fluxo mais comum)

O relatório lista **sugestões por nome** — instituições cujo ISPB não bate com nenhum CNPJ do
diretório Open Finance, mas cujo nome se parece com o de alguma organização. Elas **nunca** são
gravadas automaticamente. Para promover uma sugestão:

1. Confirme que é a mesma instituição/marca (fontes públicas: site da instituição, BCB).
2. **Olhe o logo** da organização sugerida (URI no relatório) — confirme visualmente.
3. Adicione em `pipeline/config.json` → `forcedMatches`: `"<ISPB(8)>": "<CNPJ(14) da organização>"`.
4. `npm run pipeline` e confira o diff das imagens no PR (o GitHub renderiza PNG).

Se a sugestão estiver **errada** (empresa diferente, logo que não serve), registre o par em
`rejectedMatches` (mesmo formato) — ela para de aparecer no relatório semanal. Uma sugestão
diferente para o mesmo ISPB continua aparecendo.

### Descobrindo ícones de sites oficiais (`npm run discover`)

Para instituições **fora do Open Finance**, a fonte é o ícone que a própria instituição publica
no site oficial dela:

1. Adicione o domínio oficial em `pipeline/sites.json` (`"<ISPB>": "https://site-oficial"`).
   **Em dúvida sobre o domínio, fique de fora.**
2. `npm run discover` — visita os sites, extrai candidatos (apple-touch-icon, ícones, og:image),
   filtra (sanitização de SVG, tamanho mínimo, proporção) e gera `pipeline/discovery-report.md`
   + `pipeline/discovery-sheet.png` (thumbnails com o **domínio** exposto).
3. **Curadoria visual obrigatória**: confira marca e domínio na folha; rejeite banners/fotos de
   og:image e qualquer host que não seja claramente da instituição.
4. Promova os aprovados a `forcedUris` (linha pronta no relatório) e rode `npm run pipeline`.

### Descoberta assistida por IA (`npm run discover:ai`)

Para o **resíduo** (sem logo e sem entrada no sites.json), a IA atua como *batedora* — encontra
o site oficial com busca na web e apresenta a evidência; o código determinístico valida o ícone
com os mesmos guardrails. Requer `ANTHROPIC_API_KEY`; `--limit` (padrão 15) controla o lote.
A saída é o `pipeline/discovery-ai-report.md` com domínio + evidência + linhas prontas. **Nada
é gravado automaticamente** — o risco específico desse fluxo é domínio parecido/falso, então a
curadoria aqui confere o domínio antes de tudo.

Outras ferramentas do `pipeline/config.json`:

- `denylistUris` — URLs de logo quebradas/erradas publicadas pela instituição. Com a URL banida, o
  pick escolhe outro AuthorisationServer da mesma organização (se houver).
- `forcedUris` — `"<ISPB>": "https://…"` força uma URL específica (deve ser oficial; documente a
  origem no PR).
- `pipeline/overrides/<ISPB>.(svg|png)` — arte mantida à mão para casos fora do Open Finance.
  **Só com proveniência limpa** (press kit/manual de marca oficial): documente a origem no PR.
- `ignoreIspb` — instituições a pular por completo.

Logo errado em produção? Abra issue com o template **"Logo incorreto"**.

## Revisando o PR automático da semana

Toda segunda-feira o workflow `update-logos.yml` roda o pipeline e, havendo mudança, abre um PR
(sem mudança, não abre nada). O que acontece depois depende do diff:

- **Diff só de dados** (nenhum arquivo em `logos/` alterado, nenhuma instituição existente
  perdendo ou trocando de logo, delta de até 3 instituições): o workflow valida (lint +
  typecheck + testes + build + teste do pacote), dispara o CI no PR, faz o **merge sozinho** e
  chama o `release.yml` — versão nova no npm sem intervenção humana. Até 3 instituições ganhando
  o logo da marca pela regra de cooperativas também passam.
- **Diff com logos** (novos, atualizados), **instituição existente que perdeu, trocou de logo
  ou ganhou logo fora da regra de marca**, mais de 3 ganhos pela regra de marca (mesmo sem
  arquivo novo — afiliadas de cooperativas dividem um arquivo por marca) ou delta grande: o PR
  **fica aberto para revisão visual humana** — em contexto bancário, logo errado é pior que
  logo nenhum.
- **Pipeline falhou**: a issue `Pipeline semanal falhou` (label `pipeline-falhou`) é
  aberta/atualizada e fecha sozinha na próxima rodada verde. Só é preciso agir quando essa issue
  (ou um PR aguardando revisão) aparecer. O alerta de release fecha sozinho no próximo release
  verde; o do guard de permanência, à mão ([RUNBOOK](RUNBOOK.md#alertas-issues-pipeline-falhou)).

Checklist de revisão para os PRs que ficam abertos:

1. **Leia o resumo** no corpo do PR: novos · atualizados · falhas · sugestões · órfãos.
2. **Confira o diff visual dos PNGs** (o GitHub renderiza antes/depois). Todo logo `atualizado`
   deve fazer sentido — rebrand real da instituição. Se um logo virou algo estranho (página de
   erro rasterizada, marca de parceiro), a fonte quebrou: adicione a URL em `denylistUris`,
   rode o pipeline de novo e atualize o PR.
3. **Logo diferente em instituições** (seção ⚠️ no corpo do PR): quem perdeu, ganhou ou trocou
   de arquivo, mesmo sem aparecer no diff dos PNGs. Confira cada linha; dezenas de afiliadas de
   uma marca perdendo o logo de uma vez costuma ser a organização do sistema fora do diretório
   Open Finance naquela semana — não faça merge.
4. **Novos bancos** na lista (o BCB incluiu/renomeou instituições) não exigem nada — só conferir
   que os nomes fazem sentido.
5. **Falhas**: o relatório separa *fonte quebrada* (precisa de ação: URL nova em `forcedUris`
   ou `denylistUris`), *certificado* (problema no servidor da instituição) e *bloqueio de rede*
   (dobrado; alguns WAFs bloqueiam os IPs do GitHub Actions mas aceitam requisições locais).
   Falha nunca remove um logo já publicado; se precisar forçar a atualização de um logo que o CI
   não alcança, rode `npm run pipeline` localmente e suba num PR. Detalhes no
   [RUNBOOK](RUNBOOK.md).
6. **Sugestões novas** → promova a `forcedMatches` ou rejeite em `rejectedMatches` (seção acima).
7. **Merge** → pronto. O PR já traz o bump de versão (quando a atual já está no npm); o merge
   dispara o `release.yml`, que cria a tag + Release no GitHub e publica no npm sozinho.

## Testes

`tests/` cobre parsing do CSV do BCB, indexação do diretório, precedência de matches, desempates
(matriz de conglomerado, URI majoritária), sanitização de SVG, dataset e a API pública. Toda regra
nova de matching precisa de teste — o custo de um logo errado é alto.

`npm run test:package` (precisa de `npm run build` antes) testa o pacote como ele chega ao usuário:
faz o `npm pack`, instala o tarball offline num projeto temporário e confere `require`/`import`,
`logos-bancos-br/node`, os subpaths de dados, o CLI, os `require()` do `react-native.js` e os tipos
com `tsc` (node16 ESM/CJS e bundler) — roda no CI e antes de cada publicação no npm.

## Release / publicação no npm

O release é automático: o workflow `release.yml` roda a cada push na `main` que altere
`package.json`, `data/` ou `logos/` (e via `workflow_dispatch`) e publica **qualquer versão ainda
não lançada** — cria a tag + Release no GitHub e publica no npm com `--provenance` (build
rastreável ao commit/Action). É idempotente: tag já criada e versão já publicada são puladas. Push
só de workflows, docs ou código sem bump não dispara nada.

- **Patch semanal**: o PR automático traz o bump quando preciso; merge = release. Nada a fazer.
- **Minor/major manual**: `npm version <minor|major> --no-git-tag-version`, commit
  (`build: vX.Y.Z`) e push na `main` — o `release.yml` faz o resto. Não crie a tag à mão.
- **Logo ou dado à mão**: suba o bump no mesmo push. Se `data/` ou `logos/` mudar e a versão do
  `package.json` já estiver no npm, o release **falha de propósito** e abre o alerta
  `Release automático falhou` — dataset novo não fica fora do npm em silêncio.

Pré-requisito (uma vez): *trusted publisher* do GitHub Actions configurado no npmjs.com para o
workflow `release.yml` — publicação por OIDC, sem token para vencer. Em **Allowed actions**, marque
`npm publish` (configurações criadas depois de 03/09/2026 vêm só com `npm stage publish`) e rode
o release logo depois de criar: sem publicação bem-sucedida em 2 dias, a configuração expira. Não
há token de npm no repositório; se a publicação falhar, o passo a passo está no
[RUNBOOK](RUNBOOK.md).

Convenção de versão: atualização de logos/dados → `patch`; mudanças na API/CLI → `minor`;
quebras → `major`.
