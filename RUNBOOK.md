# Runbook operacional

O que este projeto faz sozinho, o que exige uma pessoa, e como consertar quando
quebra. Escrito para que qualquer pessoa com acesso ao repositório consiga
operá-lo — não só quem o criou.

Guia de contribuição (adicionar logo, promover sugestão, rodar o pipeline):
[CONTRIBUTING.md](CONTRIBUTING.md).

## O ciclo normal (nenhuma ação humana)

Toda segunda, 06:23 (Brasília; 09:23 UTC), o workflow
[`update-logos.yml`](.github/workflows/update-logos.yml):

1. roda o pipeline contra BCB (STR + Pix) e Open Finance;
2. confere o **guard de permanência** (abaixo);
3. classifica o diff:
   - **só dados**, churn de até 3 ISPBs e nenhuma instituição perdendo ou
     trocando de logo → valida, faz merge e libera release sozinho (até 3
     instituições ganhando o logo da marca pela regra de cooperativas também
     passam: é a cooperativa que o BCB renomeia com o nome do sistema);
   - **mexe em `logos/`**, ou alguma instituição que já existia **perdeu,
     trocou de logo ou ganhou logo fora da regra de marca**, ou mais de 3
     ganharam pela regra de marca (mesmo sem arquivo novo: afiliadas de
     cooperativas dividem um arquivo por marca) → abre PR, com a lista no
     corpo, e **espera revisão visual humana**;
4. em caso de falha, abre/atualiza a issue `Pipeline semanal falhou` (label
   `pipeline-falhou`), que fecha sozinha na próxima rodada verde.

Push na `main` que toque `package.json`, `data/` ou `logos/` dispara
[`release.yml`](.github/workflows/release.yml): testes → build +
`npm run test:package` → `npm publish --provenance` → tag → GitHub Release. É
idempotente: disparar de novo é sempre seguro. Push só de workflows, docs ou
código sem bump não dispara release.

**Portanto:** só aja quando aparecer (a) um PR aguardando revisão visual ou
(b) uma issue `pipeline-falhou`.

## Revisar o PR semanal de logos

O único trabalho humano recorrente. No PR, olhe o diff visual dos PNGs: todo
logo `atualizado` deve ser um rebrand real. Se virou página de erro
rasterizada, logo de parceiro ou algo irreconhecível, a fonte quebrou —
acrescente a URL em `denylistUris` (`pipeline/config.json`), rode
`npm run pipeline` localmente e atualize o PR. Aprovado, é só mergear: o
release sai sozinho.

A seção **"Logo diferente em instituições"** do corpo do PR lista quem
perdeu, ganhou ou trocou de arquivo, e quem entrou nas listas já com o logo
da marca. Isso pode não aparecer no diff de `logos/`. Confira cada linha.
Dezenas de afiliadas de uma marca
perdendo o logo de uma vez costuma ser a organização do sistema fora do
diretório Open Finance naquela semana: não faça merge; a próxima rodada
refaz o PR (ou o fecha, se não sobrar diferença).

Checklist detalhado: [CONTRIBUTING.md](CONTRIBUTING.md).

## Guard de permanência

Consumidores externos (BrasilAPI, BancosBrasileiros) fixam as URLs dos logos,
então **arquivo publicado não é removido** — nem quando a instituição sai das
listas do BCB (ela vira "órfã" no relatório e o arquivo fica).

O workflow baixa o `logo-urls.min.json` publicado no npm e confere que todo
arquivo referenciado ainda existe na árvore. Se algum sumiu: o diff vira
revisão humana, o relatório lista os ausentes e uma issue é aberta. Nesse
caso, **restaure os arquivos** (`git checkout <commit> -- logos/...`) em vez de
seguir em frente, e depois feche a issue — ela não fecha sozinha.

## Alertas (issues `pipeline-falhou`)

Uma label, três assuntos, cada um com título próprio, e cada passo só mexe
no alerta do próprio assunto. Falha repetida do pipeline ou do release
comenta na issue aberta do mesmo título em vez de abrir outra; o guard não
duplica a issue dele.

| Issue | Quem abre | Quem fecha |
|---|---|---|
| `Pipeline semanal falhou` | `update-logos.yml` | ele mesmo, na próxima rodada verde |
| `Release automático falhou` | `release.yml` | ele mesmo, no próximo release verde na ponta da `main` (npm em dia com a `main`) |
| `Guard de permanência: asset publicado sumiu da árvore` | guard de permanência | uma pessoa, depois de restaurar os arquivos |

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
3. em **Allowed actions**, marque **`npm publish`**: configurações criadas
   depois de 03/09/2026 vêm só com `npm stage publish`, e aí o `npm publish`
   do workflow é recusado;
4. dispare o release **logo em seguida** (idempotente):
   `gh workflow run release.yml --ref main`. Não use *Re-run* nos runs
   antigos linkados na issue: ele repete o commit e o workflow daquele run.
   Configuração nova sem uma publicação bem-sucedida em 2 dias expira; aí,
   apague e crie de novo. Se houver PR semanal aberto, faça o merge dele
   antes (o push do merge publica a versão pendente); se a versão sair antes
   do merge, rode `gh workflow run update-logos.yml` para o PR ganhar o bump;
5. com a publicação funcionando, em **Settings → Publishing access** marque
   *Require two-factor authentication and disallow tokens* e apague o secret
   `NPM_TOKEN` do GitHub — não sobra segredo para vencer ou vazar. O token
   vencido pode ser apagado antes: sem ele, falha de OIDC aparece como erro de
   autenticação (`ENEEDAUTH`), e não como o E404 enganoso.

A issue `Release automático falhou` fecha sozinha quando o release passar.

O workflow já está pronto para os dois modos: o npm tenta OIDC primeiro e só
usa o `NPM_TOKEN` se não houver trusted publisher configurado.

**Paliativo — token novo (vence de novo):**

1. npm → Access Tokens → **Generate New Token** → *Granular Access Token*;
2. permissão de **read and write** apenas no pacote `logos-bancos-br`;
3. GitHub → Settings → Secrets and variables → Actions → atualize `NPM_TOKEN`;
4. reexecute o release: `gh workflow run release.yml --ref main`.

### Release falhou em "Teste do pacote empacotado"

Nada foi publicado: o tarball que iria para o npm não passou no
`npm run test:package` (require/import, `logos-bancos-br/node`, dados, CLI,
`react-native.js` e tipos). Reproduza com `npm ci && npm run build && npm run
test:package`, corrija na `main` e dispare o release de novo
(`gh workflow run release.yml --ref main`).

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

O push só dispara o release se tocar `package.json`, `data/` ou `logos/`, e
merge feito com o `GITHUB_TOKEN` (de dentro de um workflow) não dispara
gatilho de push nenhum. Rode `gh workflow run release.yml --ref main`.

### `main` e npm divergentes

`release.yml` detecta "versão órfã": se a versão do `package.json` já foi
publicada a partir de outro commit e o dataset mudou, ele **falha de
propósito** (alerta `Release automático falhou`) em vez de terminar verde
com o npm defasado. Como push em `data/` ou `logos/` também dispara o
release, isso aparece no próprio push que trouxe dataset sem bump (ex.: PR
semanal cujo número de versão foi usado por um patch manual nesse
meio-tempo). Se a `main` já estiver numa versão mais nova (bump num push logo
depois dos dados), o run antigo só deixa um aviso e o run do bump publica.
Conserto: um bump novo (`npm version patch --no-git-tag-version`, commit,
push), de preferência no mesmo push dos dados; o alerta fecha sozinho quando
a versão sair.

## Ruídos conhecidos (não são bugs)

- **CI vermelho semanal na branch `auto/atualizar-logos`**: nasce um run do
  evento `pull_request` que morre sem executar job. O CI que vale é o
  `workflow_dispatch`, disparado pelo próprio workflow e espelhado como commit
  status. Mitigado ao parar de apagar a branch no merge — se voltar a
  aparecer, é cosmético.
- **`pages-build-deployment` cancelado**: dois merges seguidos; o GitHub
  cancela o deploy anterior. O último conclui.
- **Órfãos no relatório**: esperado, ver guard de permanência.
- **Rodada de segunda atrasada**: o agendador do GitHub atrasa cron em horário
  de pico — no minuto cheio, a rodada chegou a começar 9h30 depois; por isso
  o cron é 09:23 UTC. Atraso de horas ainda é possível. Se a rodada não
  aparecer até o fim do dia, dispare à mão: `gh workflow run update-logos.yml`.

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
