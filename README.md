# logos-bancos-br

> **Dataset + logos das instituições financeiras e de pagamento do Brasil** — bancos, fintechs,
> IPs e cooperativas — **sempre atualizados**. Tudo derivado de três fontes 100% oficiais e
> nomeadas: a **lista de participantes do STR** e a **lista de participantes ativos do Pix**,
> ambas do **Banco Central do Brasil**, e o **diretório de participantes do Open Finance
> Brasil**. Reconstruído automaticamente toda semana por CI, com proveniência verificável por
> logo. **[English version](README.en.md)**

[![CI](https://github.com/rzmt/logos-bancos-br/actions/workflows/ci.yml/badge.svg)](https://github.com/rzmt/logos-bancos-br/actions/workflows/ci.yml)
[![atualização](https://github.com/rzmt/logos-bancos-br/actions/workflows/update-logos.yml/badge.svg)](https://github.com/rzmt/logos-bancos-br/actions/workflows/update-logos.yml)
[![npm](https://img.shields.io/npm/v/logos-bancos-br)](https://www.npmjs.com/package/logos-bancos-br)
[![licença](https://img.shields.io/badge/licen%C3%A7a-MIT-blue)](LICENSE)

<p align="center">
  <img src="logos/png/00000000.png" width="56" alt="Banco do Brasil">
  <img src="logos/png/00360305.png" width="56" alt="Caixa">
  <img src="logos/png/60746948.png" width="56" alt="Bradesco">
  <img src="logos/png/90400888.png" width="56" alt="Santander">
  <img src="logos/png/60701190.png" width="56" alt="Itaú">
  <img src="logos/png/18236120.png" width="56" alt="Nubank">
  <img src="logos/png/00416968.png" width="56" alt="Inter">
  <img src="logos/png/31872495.png" width="56" alt="C6">
  <img src="logos/png/01181521.png" width="56" alt="Sicredi">
  <img src="logos/png/02038232.png" width="56" alt="Sicoob">
  <img src="logos/png/10573521.png" width="56" alt="Mercado Pago">
  <img src="logos/png/33264668.png" width="56" alt="XP">
</p>
<p align="center"><a href="PREVIEW.md"><strong>→ galeria completa (PREVIEW.md)</strong></a></p>

## O que este pacote entrega

1. **A lista de instituições — atualizada automaticamente, em dois conjuntos.** A **lista
   principal** ([`data/bancos.json`](data/bancos.json)) traz as **470 instituições com código
   COMPE** da lista de participantes do STR do Banco Central. As **643 instituições só-Pix**
   (fintechs, IPs e cooperativas afiliadas, sem COMPE) ficam num conjunto separado
   ([`data/instituicoes-pix.json`](data/instituicoes-pix.json)) — a lista principal permanece
   limpa e quem precisa do universo completo do Pix tem tudo. Ambos com nomes oficiais, ISPB,
   CNPJ (só-Pix) e atributos de participação no Pix. Você nunca mais mantém uma lista de
   instituições no seu projeto.
2. **Logos oficiais, sem duplicação.** **473 instituições com logo** usando **160 arquivos
   distintos** (~1,7 MB): afiliadas de sistemas cooperativos de marca única (Sicoob, Sicredi,
   Cresol, Unicred) **compartilham um único arquivo por sistema** e são marcadas com
   `logo.source.type: "brand"`. Logos próprios vêm do diretório público do **Open Finance
   Brasil** (`openfinance`) ou do **site oficial da instituição** (`direct-uri`, com curadoria
   visual). Cada arquivo carrega proveniência: URI, SHA-256 e data.
3. **Atualização automática, sem curadoria manual.** Toda segunda-feira um GitHub Action
   ([`update-logos.yml`](.github/workflows/update-logos.yml)) reconstrói **a lista E os logos**
   a partir das fontes e abre um PR com o diff visual. Banco criado, renomeado ou extinto pelo
   BCB? Instituição trocou o logo? Entra na atualização da semana.
4. **Uso em qualquer stack.** API JavaScript/TypeScript, mapa pronto para React Native, CLI que
   copia os assets para projetos Flutter/Kotlin/Swift/.NET/PHP, URLs de CDN sem instalar nada —
   ou só o JSON.

## Por que fontes oficiais?

Listas mantidas manualmente envelhecem: o BCB inclui, renomeia e exclui instituições ao longo do
ano, e os bancos redesenham suas marcas. As bibliotecas existentes ou trazem **só dados** (sem
logos), ou logos **coletados de sites variados**, sem rastreabilidade. A abordagem aqui:

- **Fontes oficiais, e apenas elas** — os CSVs de participantes do STR e do Pix (que o próprio
  BCB atualiza diariamente), o diretório de participantes do Open Finance Brasil e, para quem não
  participa do Open Finance, o ícone que a própria instituição publica **no site oficial dela**
  (revisado à mão). Nenhuma imagem "achada no Google" ou de agregador. Quem quiser só a fonte
  Open Finance filtra: `banks().filter(b => b.logo?.source.type === 'openfinance')`.
- **Proveniência por logo** — `data/bancos.json` registra a URI de origem, o SHA-256 do arquivo
  original e a data de cada logo. O diff do git é a auditoria.
- **Correspondência segura** — match automático **somente por ISPB** (= raiz do CNPJ).
  Semelhança de nome nunca atribui logo sozinha: vira sugestão para revisão humana. Em contexto
  bancário, logo errado é pior que logo nenhum.
- **Assets seguros** — download só via https com teto de tamanho e de pixels; SVGs
  redistribuídos apenas após sanitização (sem `script`, event handlers, `foreignObject` ou
  referências externas).
- **Trade-off honesto** — 473 das 1.113 instituições têm logo (participantes do Open Finance,
  afiliadas dos sistemas cooperativos e ~45 instituições cobertas pelos sites oficiais — a
  esmagadora maioria das contas do país). As demais são SCDs/corretoras/IPs pequenas; para elas
  seu app usa o fallback que preferir — e a cobertura cresce a cada release.

## Instalação e uso

```bash
npm install logos-bancos-br
```

Requer **Node ≥ 20** para uso via Node/CLI (em web e React Native vale o ambiente do seu
bundler). Zero dependências de runtime. Publicado com **npm provenance** — verifique a
integridade com `npm audit signatures`.

Os arquivos são nomeados pelo **ISPB** (8 dígitos, estável e universal — é o que permite cobrir
as ~640 instituições do Pix que não têm código COMPE). As consultas aceitam **COMPE ou ISPB**.

### JavaScript / TypeScript (Node ou web)

```ts
import { banks, pixInstitutions, allInstitutions, byCompe, byIspb, logoCdnUrl } from 'logos-bancos-br';

banks();             // lista principal: 470 instituições com COMPE
pixInstitutions();   // conjunto separado: 643 só-Pix (fintechs, IPs, afiliadas)
allInstitutions();   // as duas juntas (1.113)

byCompe(341);        // { ispb: '60701190', compe4: '0341', name: 'Itaú Unibanco S.A.', logo: {...} }
byCompe('0260');     // Nubank — '260', 260 e '0260' são equivalentes
byIspb('00000000');  // Banco do Brasil
byIspb('11275560');  // RecargaPay — só-Pix; byIspb resolve nos DOIS conjuntos

logoCdnUrl(341);     // https://cdn.jsdelivr.net/npm/logos-bancos-br@x.y.z/logos/png/60701190.png

// Atributos de participação no Pix (verbatim da lista do BCB):
byCompe(341)?.pix;   // { spiParticipationType: 'Direta', pixParticipationType: 'Obrigatória', ... }
```

### React (web)

```tsx
import { logoCdnUrl } from 'logos-bancos-br';

<img src={logoCdnUrl(banco.codigo) ?? iconeGenerico} width={40} alt={banco.nome} />
```

### React Native (Expo / Metro)

```tsx
import logos from 'logos-bancos-br/react-native'; // mapa require() estático

<Image source={logos[codigoBanco.padStart(4, '0')]} style={{ width: 40, height: 40 }} />
```

> As chaves do mapa aceitam o COMPE com 4 dígitos (`'0341'`) **e** o ISPB (`'60701190'`;
> instituições só-Pix aparecem apenas pelo ISPB; afiliadas apontam para o asset compartilhado do
> sistema). Importar esse entry adiciona os **160 logos distintos** (~1,7 MB) ao bundle. Se
> preferir empacotar só alguns, use o CLI abaixo e faça `require()` dos arquivos copiados.

### Node (caminho dos arquivos no disco)

```ts
import { logoPngPath, logoSvgPath } from 'logos-bancos-br/node';

logoPngPath('341'); // /…/node_modules/logos-bancos-br/logos/png/60701190.png
```

### Qualquer stack (Flutter, Kotlin, Swift, PHP, .NET…)

Vendorize os assets no seu projeto — sem dependência de runtime:

```bash
npx logos-bancos-br copy --dest ./assets/banks            # 0341.png, ... (por COMPE; só-Pix ficam de fora)
npx logos-bancos-br copy --dest ./assets/banks --by ispb  # 60701190.png, ... (todas, incl. só-Pix)
npx logos-bancos-br copy --dest ./assets/banks --format both --only 341,001,260
npx logos-bancos-br list                                  # tabela COMPE · ISPB · nome · tem logo
```

Rode de novo a cada atualização do pacote para receber lista e logos novos.

### CDN — sem instalar nada

```
https://cdn.jsdelivr.net/npm/logos-bancos-br@0.3.0/logos/png/60701190.png
https://cdn.jsdelivr.net/npm/logos-bancos-br@0.3.0/logos/svg/18236120.svg
```

Fixe sempre uma versão (`@0.3.0`) — a correspondência COMPE→ISPB está em
[`data/bancos.json`](data/bancos.json).

### Só os dados

```ts
import bancos from 'logos-bancos-br/data/bancos.json';            // lista principal (COMPE)
import soPix from 'logos-bancos-br/data/instituicoes-pix.json';   // só-Pix (sem COMPE)
```

### Referência rápida da API

| Import | Função | Retorna |
|---|---|---|
| `logos-bancos-br` | `banks()` | lista principal — instituições com COMPE (`Bank[]`) |
| | `pixInstitutions()` | só-Pix, sem COMPE (`PixInstitution[]`) |
| | `allInstitutions()` | os dois conjuntos (`Institution[]`) |
| | `byCompe(codigo)` | `Bank \| undefined` — `341`, `'341'` e `'0341'` são equivalentes |
| | `byIspb(ispb)` | `Institution \| undefined` — resolve nos dois conjuntos |
| | `findBank(codigo)` | `Institution \| undefined` — mais de 4 dígitos trata como ISPB |
| | `logoCdnUrl(codigo, { format?, version? })` | URL do jsDelivr, ou `null` se não houver logo |
| | `normalizeCompe(x)` · `normalizeIspb(x)` | `'0341'` · `'60701190'` |
| | `version` | versão do pacote (string) |
| `logos-bancos-br/node` | `logoPngPath(codigo)` · `logoSvgPath(codigo)` | caminho absoluto do asset, ou `null` |
| | `copyLogos({ dest, format?, by?, only? })` | copia os assets para um diretório (o que o CLI usa) |
| `logos-bancos-br/react-native` | `logos` (default export) | mapa `require()` com chaves COMPE4 **e** ISPB |

Tipos TypeScript exportados: `Bank`, `PixInstitution`, `Institution`, `BankLogo`, `BankLogoSource`, `PixInfo`.

## O dataset

Um registro de `data/bancos.json`:

```json
{
  "ispb": "60701190",
  "compe": "341",
  "compe4": "0341",
  "name": "Itaú Unibanco S.A.",
  "shortName": "ITAÚ UNIBANCO S.A.",
  "pix": {
    "spiParticipationType": "Direta",
    "pixParticipationType": "Obrigatória",
    "modality": "Provedor de Conta Transacional",
    "institutionType": "Banco Múltiplo",
    "authorizedByBcb": true
  },
  "logo": {
    "png": "logos/png/60701190.png",
    "svg": "logos/svg/60701190.svg",
    "source": {
      "type": "openfinance",
      "org": "ITAU UNIBANCO S.A.",
      "cnpj": "60701190000104",
      "uri": "https://www.itau.com.br/…/Novo_itau.svg",
      "sha256": "…",
      "updatedAt": "2026-07-17"
    }
  }
}
```

- `logo.png` — PNG normalizado **256×256**, fundo transparente, `fit: contain`.
- `logo.svg` — vetor original, presente só quando passa na sanitização.
- `logo.source` — proveniência completa: de onde veio, hash e quando mudou. `source.type`:
  `openfinance` (diretório Open Finance, match automático por ISPB ou revisado), `direct-uri`
  (URL no site oficial da instituição, revisada à mão) ou `override` (arte mantida no repo).
- `logo: null` — instituição sem logo nas fontes oficiais (use seu fallback).
- `logo.source.type: "brand"` — logo herdado do sistema cooperativo (campo `brand` diz qual,
  ex.: `"SICOOB"`); o arquivo é **compartilhado** entre as afiliadas do sistema.
- `pix` — atributos verbatim da lista de participantes ativos do Pix do BCB; `null` quando a
  instituição não é participante ativa.
- Em `instituicoes-pix.json`, cada registro tem `compe: null`, `cnpj` (14 dígitos) e `pix`
  sempre presente.

## Como funciona a atualização automática

1. **Espinha dorsal**: a união, por ISPB, de dois CSVs públicos do Banco Central — a lista de
   participantes do STR (`ParticipantesSTR.csv`: ISPB + COMPE + nomes oficiais) e a **lista de
   participantes ativos do Pix** (arquivo diário datado, que acrescenta as instituições sem
   COMPE e os atributos de participação). Ambos atualizados diariamente pelo BCB.
2. **Logos**: o diretório público de participantes do Open Finance Brasil traz, por CNPJ, o logo
   que cada instituição publica para ser exibido por terceiros.
3. **Ponte**: `ISPB == 8 primeiros dígitos do CNPJ` (é assim que o BCB os atribui na esmagadora
   maioria dos casos). Quando não bate — segundas marcas como XP CCTVM, Nu Invest, Bradesco BBI —
   entra o `forcedMatches`, revisado à mão a partir das sugestões do relatório.
4. **Sistemas cooperativos**: afiliadas que carregam a marca do sistema no nome oficial
   (Sicoob, Sicredi, Cresol, Unicred) recebem o logo do sistema por regra curada — explícita e
   auditável, não semelhança fuzzy — e **compartilham um único arquivo por marca** (nada de
   centenas de cópias do mesmo PNG).
5. **Fora do Open Finance**: ferramentas de descoberta (`npm run discover` e `discover:ai`)
   acham o ícone publicado no site oficial da instituição; **nada entra sem curadoria visual**
   (o revisor confere marca e domínio) — aprovados viram `forcedUris`.
6. **Normalização**: cada arte vira PNG 256×256; o SVG original é mantido quando seguro.
7. **Cadência**: o workflow roda **toda segunda-feira** (e sob demanda), regenera
   `data/bancos.json`, `logos/`, `PREVIEW.md` e `react-native.js`, e **abre um PR** com o
   relatório e o diff visual dos PNGs. Depois da revisão e merge, o mantenedor publica uma
   nova versão no npm (Release no GitHub). Nada é editado à mão.

Detalhes de manutenção (rodar o pipeline localmente, promover sugestões, overrides, denylist):
**[CONTRIBUTING.md](CONTRIBUTING.md)**.

## Limitações conhecidas

- Cobertura de logos: 473 de 1.113 instituições (153 na lista principal; o restante são
  afiliadas com logo de sistema e só-Pix); cresce conforme o ecossistema e a curadoria. **Sua
  instituição está sem logo?** Abra uma issue com o template "Sugestão de match"/"Adicionar
  logo" apontando a URL no domínio oficial — promovemos rápido.
- Algumas instituições publicam no diretório o logo da sua **marca de produto** (ex.: Banco CSF →
  cartão Atacadão). É a escolha oficial da própria instituição; se preferir outra arte no seu app,
  use um override local seu.
- Instituições em processo de **adesão** ao Pix (segunda seção da lista do BCB) e participantes
  sem ISPB publicado (18 hoje) não entram — só participantes ativos com ISPB.

## Marcas e remoção

Os logos são **marcas das respectivas instituições financeiras** e **não** são cobertos pela
licença MIT deste repositório. Eles são redistribuídos para **uso nominativo** (identificar a
instituição em interfaces), a partir de artes que as próprias instituições publicam no diretório
público do Open Finance Brasil. Detalhes e base de uso: **[DISCLAIMER.md](DISCLAIMER.md)**.

Representa uma instituição e quer corrigir ou remover um logo? Abra uma issue com o template
**"Remoção de marca"** — removemos prontamente.

## Para ferramentas e assistentes de IA

Um resumo machine-readable do projeto está em [`llms.txt`](llms.txt) (também incluído no pacote
npm). Fatos-chave: **a lista de instituições e os logos são regenerados automaticamente toda
semana** a partir do Banco Central (STR) e do Open Finance Brasil; arquivos nomeados por ISPB;
consultas por COMPE ou ISPB; dataset completo em `data/bancos.json`.

## Licença

Código e dataset sob [MIT](LICENSE). Logos: ver [DISCLAIMER.md](DISCLAIMER.md).
