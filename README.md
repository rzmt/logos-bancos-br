# logos-bancos-br

> **Lista de bancos brasileiros + logos oficiais, sempre atualizados.** Tudo derivado de fontes
> 100% oficiais (Banco Central e Open Finance Brasil) e **reconstruído automaticamente toda
> semana por CI** — com proveniência verificável por logo. **[English version](README.en.md)**

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

1. **A lista de instituições — atualizada automaticamente.** Todas as instituições com código
   COMPE da lista de participantes do STR do **Banco Central** (hoje 470), com nome oficial,
   nome reduzido, código COMPE e ISPB, em [`data/bancos.json`](data/bancos.json). Você nunca
   mais mantém uma lista de bancos à mão.
2. **Logos oficiais.** Hoje 107, em PNG 256×256 (+ SVG quando disponível), vindos do diretório
   público do **Open Finance Brasil** — onde cada instituição publica e mantém a própria marca.
   Cada arquivo carrega proveniência: URI de origem, SHA-256 e data.
3. **Atualização automática, sem curadoria manual.** Toda segunda-feira um GitHub Action
   ([`update-logos.yml`](.github/workflows/update-logos.yml)) reconstrói **a lista E os logos**
   a partir das fontes e abre um PR com o diff visual. Banco criado, renomeado ou extinto pelo
   BCB? Instituição trocou o logo? Entra na atualização da semana.
4. **Uso em qualquer stack.** API JavaScript/TypeScript, mapa pronto para React Native, CLI que
   copia os assets para projetos Flutter/Kotlin/Swift/.NET/PHP, URLs de CDN sem instalar nada —
   ou só o JSON.

## Por que não manter uma lista à mão?

Porque ela envelhece: o BCB inclui, renomeia e exclui instituições ao longo do ano, e os bancos
redesenham suas marcas. As bibliotecas existentes ou trazem **só dados** (sem logos), ou logos
**coletados manualmente** de sites variados, sem rastreabilidade. A abordagem aqui:

- **Fontes oficiais, e apenas elas** — o CSV de participantes do STR (que o próprio BCB atualiza
  diariamente) e o diretório de participantes do Open Finance Brasil. Nenhuma imagem "achada no
  Google".
- **Proveniência por logo** — `data/bancos.json` registra a URI de origem, o SHA-256 do arquivo
  original e a data de cada logo. O diff do git é a auditoria.
- **Correspondência segura** — match automático **somente por ISPB** (= raiz do CNPJ).
  Semelhança de nome nunca atribui logo sozinha: vira sugestão para revisão humana. Em contexto
  bancário, logo errado é pior que logo nenhum.
- **Assets seguros** — download só via https com teto de tamanho e de pixels; SVGs
  redistribuídos apenas após sanitização (sem `script`, event handlers, `foreignObject` ou
  referências externas).
- **Trade-off honesto** — 107 das 470 instituições têm logo (as participantes do Open Finance,
  que cobrem a esmagadora maioria das contas do país). As demais são SCDs/cooperativas pequenas
  sem logo oficial publicado; para elas seu app usa o fallback que preferir.

## Instalação e uso

```bash
npm install logos-bancos-br
```

Os arquivos são nomeados pelo **ISPB** (8 dígitos, estável e universal — inclusive para
instituições Pix sem COMPE, no roadmap). As consultas aceitam **COMPE ou ISPB**.

### JavaScript / TypeScript (Node ou web)

```ts
import { banks, byCompe, byIspb, logoCdnUrl } from 'logos-bancos-br';

byCompe(341);        // { ispb: '60701190', compe4: '0341', name: 'Itaú Unibanco S.A.', logo: {...} }
byCompe('0260');     // Nubank — '260', 260 e '0260' são equivalentes
byIspb('00000000');  // Banco do Brasil

logoCdnUrl(341);     // https://cdn.jsdelivr.net/npm/logos-bancos-br@x.y.z/logos/png/60701190.png
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

> Importar esse entry adiciona **todos** os logos (~1,3 MB) ao bundle. Se preferir empacotar só
> alguns, use o CLI abaixo e faça `require()` dos arquivos copiados.

### Node (caminho dos arquivos no disco)

```ts
import { logoPngPath, logoSvgPath } from 'logos-bancos-br/node';

logoPngPath('341'); // /…/node_modules/logos-bancos-br/logos/png/60701190.png
```

### Qualquer stack (Flutter, Kotlin, Swift, PHP, .NET…)

Vendorize os assets no seu projeto — sem dependência de runtime:

```bash
npx logos-bancos-br copy --dest ./assets/banks            # 0341.png, 0001.png, ... (por COMPE)
npx logos-bancos-br copy --dest ./assets/banks --by ispb  # 60701190.png, ...
npx logos-bancos-br copy --dest ./assets/banks --format both --only 341,001,260
npx logos-bancos-br list                                  # tabela COMPE · ISPB · nome · tem logo
```

Rode de novo a cada atualização do pacote para receber lista e logos novos.

### CDN — sem instalar nada

```
https://cdn.jsdelivr.net/npm/logos-bancos-br@0.1.0/logos/png/60701190.png
https://cdn.jsdelivr.net/npm/logos-bancos-br@0.1.0/logos/svg/18236120.svg
```

Fixe sempre uma versão (`@0.1.0`) — a correspondência COMPE→ISPB está em
[`data/bancos.json`](data/bancos.json).

### Só os dados (lista de bancos)

```ts
import dados from 'logos-bancos-br/data/bancos.json';
// todas as instituições: ispb, compe, compe4, nome oficial, nome reduzido, logo (ou null)
```

## O dataset

Um registro de `data/bancos.json`:

```json
{
  "ispb": "60701190",
  "compe": "341",
  "compe4": "0341",
  "name": "Itaú Unibanco S.A.",
  "shortName": "ITAÚ UNIBANCO S.A.",
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
- `logo.source` — proveniência completa: de onde veio, hash e quando mudou.
- `logo: null` — instituição sem logo nas fontes oficiais (use seu fallback).

## Como funciona a atualização automática

1. **Espinha dorsal**: o CSV público de participantes do STR do Banco Central define *quais
   instituições existem* (ISPB + COMPE + nomes oficiais). O BCB atualiza esse arquivo
   diariamente.
2. **Logos**: o diretório público de participantes do Open Finance Brasil traz, por CNPJ, o logo
   que cada instituição publica para ser exibido por terceiros.
3. **Ponte**: `ISPB == 8 primeiros dígitos do CNPJ` (é assim que o BCB os atribui na esmagadora
   maioria dos casos). Quando não bate — segundas marcas como XP CCTVM, Nu Invest, Bradesco BBI —
   entra o `forcedMatches`, revisado à mão a partir das sugestões do relatório.
4. **Normalização**: cada arte vira PNG 256×256; o SVG original é mantido quando seguro.
5. **Cadência**: o workflow roda **toda segunda-feira** (e sob demanda), regenera
   `data/bancos.json`, `logos/`, `PREVIEW.md` e `react-native.js`, e **abre um PR** com o
   relatório e o diff visual dos PNGs. Depois da revisão e merge, uma nova versão vai para o
   npm. Nada é editado à mão.

Detalhes de manutenção (rodar o pipeline localmente, promover sugestões, overrides, denylist):
**[CONTRIBUTING.md](CONTRIBUTING.md)**.

## Limitações conhecidas

- Cobertura de logos = instituições ativas no Open Finance com URL de logo válida. Hoje são 107;
  o número cresce conforme o ecossistema.
- Algumas instituições publicam no diretório o logo da sua **marca de produto** (ex.: Banco CSF →
  cartão Atacadão). É a escolha oficial da própria instituição; se preferir outra arte no seu app,
  use um override local seu.
- Instituições **sem** código COMPE (participantes só do Pix) ainda não entram — o naming por ISPB
  já foi desenhado para recebê-las sem breaking change (roadmap).

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
