# logos-bancos-br

> Logos e dados de bancos brasileiros a partir de **fontes 100% oficiais** — com proveniência
> verificável por logo e atualização automatizada. **[English version](README.en.md)**

[![CI](https://github.com/rafael-matos-dev/logos-bancos-br/actions/workflows/ci.yml/badge.svg)](https://github.com/rafael-matos-dev/logos-bancos-br/actions/workflows/ci.yml)
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

## Por que esta biblioteca?

Todo app que exibe transferências, Pix ou boletos precisa mostrar o logo da instituição — e as
opções existentes ou trazem **só dados** (sem logos), ou logos **coletados à mão** de sites
aleatórios, sem rastreabilidade e desatualizados. Aqui a abordagem é outra:

| | logos-bancos-br |
|---|---|
| **Fontes oficiais** | Lista de participantes do **STR (Banco Central)** — ISPB, código COMPE e nomes oficiais, atualizada diariamente — cruzada com o **diretório de participantes do Open Finance Brasil**, onde **cada instituição publica e mantém o próprio logo**. |
| **Proveniência por logo** | `data/bancos.json` registra, para cada logo: URI de origem, SHA-256 do arquivo original e data de atualização. Nada entra "de paraquedas". |
| **Atualização automatizada** | GitHub Action semanal roda o pipeline e **abre um PR com o diff visual** (o GitHub renderiza os PNGs) — revisão humana antes de publicar, nunca push direto. |
| **Correspondência segura** | Match automático **somente por ISPB** (= raiz do CNPJ). Semelhança de nome nunca atribui logo sozinha — vira sugestão para revisão humana. Em contexto bancário, logo errado é pior que logo nenhum. |
| **Assets seguros** | Download só via https com teto de tamanho e limite de pixels; SVGs redistribuídos apenas se passarem por sanitização (sem `script`, event handlers, `foreignObject` ou referências externas). |

O trade-off, dito com franqueza: **107 das 470 instituições** com código COMPE têm logo — as que
participam do Open Finance (que cobrem a esmagadora maioria das contas do país). As demais são
SCDs/cooperativas pequenas sem logo oficial publicado; para elas seu app usa o fallback que
preferir. Cobertura menor que a de repositórios manuais; confiança maior em cada arquivo.

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

### CDN — sem instalar nada

```
https://cdn.jsdelivr.net/npm/logos-bancos-br@0.1.0/logos/png/60701190.png
https://cdn.jsdelivr.net/npm/logos-bancos-br@0.1.0/logos/svg/18236120.svg
```

Fixe sempre uma versão (`@0.1.0`) — a correspondência COMPE→ISPB está em
[`data/bancos.json`](data/bancos.json).

### Só os dados

```ts
import dados from 'logos-bancos-br/data/bancos.json';
// 470 instituições: ispb, compe, compe4, nome oficial, nome reduzido, logo (ou null)
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

## Como funciona

1. **Espinha dorsal**: o CSV público de participantes do STR do Banco Central define *quais
   instituições existem* (ISPB + COMPE + nomes oficiais).
2. **Logos**: o diretório público de participantes do Open Finance Brasil traz, por CNPJ, o logo
   que cada instituição publica para ser exibido por terceiros.
3. **Ponte**: `ISPB == 8 primeiros dígitos do CNPJ` (é assim que o BCB os atribui na esmagadora
   maioria dos casos). Quando não bate — segundas marcas como XP CCTVM, Nu Invest, Bradesco BBI —
   entra o `forcedMatches`, revisado à mão a partir das sugestões do relatório.
4. **Normalização**: cada arte vira PNG 256×256; o SVG original é mantido quando seguro.
5. Tudo idempotente e versionado — o diff do git *é* a auditoria.

Detalhes de manutenção (rodar o pipeline, promover sugestões, overrides, denylist):
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

## Licença

Código e dataset sob [MIT](LICENSE). Logos: ver [DISCLAIMER.md](DISCLAIMER.md).
