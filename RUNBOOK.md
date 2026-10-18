# Runbook operacional

O que este projeto faz sozinho, o que exige uma pessoa, e como consertar quando
quebra. Escrito para que qualquer pessoa com acesso ao repositório consiga
operá-lo — não só quem o criou.

Guia de contribuição (adicionar logo, promover sugestão, rodar o pipeline):
[CONTRIBUTING.md](CONTRIBUTING.md).

## O ciclo normal (nenhuma ação humana)

Toda segunda, 06:00 (Brasília), o workflow
[`update-logos.yml`](.github/workflows/update-logos.yml):

1. roda o pipeline contra BCB (STR + Pix) e Open Finance;
2. confere o **guard de permanência** (abaixo);
3. classifica o diff:
   - **só dados**, churn de até 3 ISPBs → valida, faz merge e libera release
     sozinho;
   - **mexe em `logos/`** → abre PR e **espera revisão visual humana**;
4. em caso de falha, abre/atualiza a issue com a label `pipeline-falhou`.

Merge na `main` que toque `package.json` dispara
[`release.yml`](.github/workflows/release.yml): testes → `npm publish
--provenance` → tag → GitHub Release. É idempotente: reexecutar é sempre
seguro.

**Portanto:** só aja quando aparecer (a) um PR aguardando revisão visual ou
(b) uma issue `pipeline-falhou`.

## Revisar o PR semanal de logos

O único trabalho humano recorrente. No PR, olhe o diff visual dos PNGs: todo
logo `atualizado` deve ser um rebrand real. Se virou página de erro
rasterizada, logo de parceiro ou algo irreconhecível, a fonte quebrou —
acrescente a URL em `denylistUris` (`pipeline/config.json`), rode
`npm run pipeline` localmente e atualize o PR. Aprovado, é só mergear: o
release sai sozinho.

Checklist detalhado: [CONTRIBUTING.md](CONTRIBUTING.md).

## Guard de permanência

Consumidores externos (BrasilAPI, BancosBrasileiros) fixam as URLs dos logos,
então **arquivo publicado não é removido** — nem quando a instituição sai das
listas do BCB (ela vira "órfã" no relatório e o arquivo fica).

O workflow baixa o `logo-urls.min.json` publicado no npm e confere que todo
arquivo referenciado ainda existe na árvore. Se algum sumiu: o diff vira
revisão humana, o relatório lista os ausentes e uma issue é aberta. Nesse
caso, **restaure os arquivos** (`git checkout <commit> -- logos/...`) em vez de
seguir em frente.

## Quando quebrar

### Publicação no npm falhou (token vencido)

Sintoma: o `release.yml` falha em "Publicar no npm" com
`E404 Not Found - PUT https://registry.npmjs.org/logos-bancos-br` — é assim
que o npm responde a um token **vencido** (não aparece como erro de
autenticação). Tokens granulares do npm têm validade obrigatória, então isso
volta a acontecer enquanto a publicação depender do `NPM_TOKEN`.

**Conserto definitivo — trusted publishing (OIDC, sem token):**

1. npmjs.com → pacote `logos-bancos-br` → **Settings** → **Trusted Publisher**
   → *GitHub Actions*;
2. preencha (diferencia maiúsculas): organização/usuário `rzmt`, repositório
   `logos-bancos-br`, workflow `release.yml`, environment vazio;
3. reexecute o release: `gh workflow run release.yml --ref main` (idempotente);
4. com a publicação funcionando, em **Settings → Publishing access** marque
   *Require two-factor authentication and disallow tokens* e apague o secret
   `NPM_TOKEN` do GitHub — não sobra segredo para vencer ou vazar.

O workflow já está pronto para os dois modos: o npm tenta OIDC primeiro e só
usa o `NPM_TOKEN` se não houver trusted publisher configurado.

**Paliativo — token novo (vence de novo):**

1. npm → Access Tokens → **Generate New Token** → *Granular Access Token*;
2. permissão de **read and write** apenas no pacote `logos-bancos-br`;
3. GitHub → Settings → Secrets and variables → Actions → atualize `NPM_TOKEN`;
4. reexecute o release: `gh workflow run release.yml --ref main`.

### Falhas de download no relatório

**Falha nunca remove logo já publicado.** O relatório separa as falhas em três
grupos — só o primeiro pede ação:

- **Fonte quebrada** (404, página HTML no lugar da imagem, formato inválido):
  a URL não vai voltar sozinha. Ache a URL oficial certa (ou o novo domínio) e
  coloque em `forcedUris`; se a URL do diretório estiver obsoleta, ponha em
  `denylistUris`. Ex.: cooperativa que migrou de sistema e continua com o logo
  antigo no diretório → `denylistUris` + `forcedMatches` para o sistema novo.
- **Certificado com problema no servidor** (ex.: servidor sem o certificado
  intermediário): só a instituição corrige; o logo anterior segue publicado.
- **Bloqueio ou instabilidade de rede** (403, desafio anti-bot, conexão
  resetada, timeout): vários sites (Itaú, Inter, UBS…) recusam os IPs do
  GitHub Actions — são ~20 por semana, esperado. Para atualizar um logo que o
  CI não alcança, rode `npm run pipeline` localmente (de casa costuma passar)
  e suba num PR.

Ao garimpar manualmente, use User-Agent de navegador — muitos servidores
devolvem 403 para o `curl` padrão:

```sh
curl -sL -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" <url> -o logo.png
```

### Release não saiu depois de um merge

Merge feito pela linha de comando (`gh pr merge`) não dispara o gatilho de
push. Rode `gh workflow run release.yml --ref main`.

### `main` e npm divergentes

`release.yml` detecta "versão órfã": se a versão do `package.json` já foi
publicada a partir de outro commit e o dataset mudou, ele **falha de
propósito** em vez de terminar verde com o npm defasado. Conserto: um bump
novo (`npm version patch --no-git-tag-version`, commit, push).

## Ruídos conhecidos (não são bugs)

- **CI vermelho semanal na branch `auto/atualizar-logos`**: nasce um run do
  evento `pull_request` que morre sem executar job. O CI que vale é o
  `workflow_dispatch`, disparado pelo próprio workflow e espelhado como commit
  status. Mitigado ao parar de apagar a branch no merge — se voltar a
  aparecer, é cosmético.
- **`pages-build-deployment` cancelado**: dois merges seguidos; o GitHub
  cancela o deploy anterior. O último conclui.
- **Órfãos no relatório**: esperado, ver guard de permanência.

## Decisões que valem manter

- **Match só por ISPB.** Semelhança de nome nunca atribui logo sozinha: vira
  sugestão para revisão. Logo errado é pior que logo nenhum.
- **`displayName` é curado à mão**, nunca derivado do nome oficial (derivar
  produz "Banco Da Amazonia"). Sem curadoria, o campo é `null`.
- **Afiliadas de sistemas cooperativos compartilham um arquivo** sob o ISPB do
  sistema. Monte URLs pelo caminho real do asset (ou pelo
  `logo-urls.min.json`), nunca pelo ISPB da afiliada — daria 404 em ~310
  instituições.
- **Emissão determinística.** Os arquivos gerados não têm timestamp, para o
  `writeIfChanged` não produzir diff vazio toda semana.

## Acessos necessários

| O quê | Para quê |
|---|---|
| Admin no repositório | mergear, editar secrets, alterar proteção da `main` |
| Trusted publisher no npmjs.com (ou secret `NPM_TOKEN`, legado) | publicar no npm |
| Conta npm com acesso ao pacote | configurar o trusted publisher / gerar token |
| Conta Google dona do pacote no pub.dev | publicar `logos_bancos_br` (Dart) |
