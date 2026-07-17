# logos-bancos-br

> Brazilian bank logos and data from **official sources only** — with verifiable per-logo
> provenance and automated updates. **[Versão em português](README.md)**

[![CI](https://github.com/rafael-matos-dev/logos-bancos-br/actions/workflows/ci.yml/badge.svg)](https://github.com/rafael-matos-dev/logos-bancos-br/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/logos-bancos-br)](https://www.npmjs.com/package/logos-bancos-br)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

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
<p align="center"><a href="PREVIEW.md"><strong>→ full gallery (PREVIEW.md)</strong></a></p>

## Why

Existing libraries either ship **data only** (no logos) or logos **hand-collected** from random
websites, with no traceability. This project takes a different approach:

- **Official sources**: the Central Bank of Brazil **STR participants list** (ISPB, COMPE code and
  official names, updated daily) joined with the **Open Finance Brasil participants directory**,
  where **each institution publishes and maintains its own logo**.
- **Per-logo provenance**: `data/bancos.json` records the source URI, SHA-256 of the original
  artwork and last-change date for every logo.
- **Automated updates**: a weekly GitHub Action runs the pipeline and **opens a PR with the visual
  diff** — human review, never a direct push.
- **Safe matching**: automatic matches happen **only via ISPB** (= first 8 digits of the CNPJ).
  Name similarity never assigns a logo by itself — it only produces suggestions for human review.
  In a banking context, a wrong logo is worse than no logo.
- **Safe assets**: https-only downloads with size/pixel caps; SVGs are redistributed only after
  sanitization (no scripts, event handlers, `foreignObject` or external references).

Honest trade-off: **107 of the 470** COMPE institutions have a logo (the Open Finance
participants, which cover the vast majority of accounts in Brazil). The rest are small credit
unions/SCDs with no officially published logo — your app decides the fallback.

## Install & use

```bash
npm install logos-bancos-br
```

Files are named by **ISPB** (8 digits). Lookups accept **COMPE or ISPB**.

```ts
import { banks, byCompe, byIspb, logoCdnUrl } from 'logos-bancos-br';

byCompe(341);        // { ispb: '60701190', compe4: '0341', name: 'Itaú Unibanco S.A.', logo: {...} }
byIspb('00000000');  // Banco do Brasil
logoCdnUrl(341);     // https://cdn.jsdelivr.net/npm/logos-bancos-br@x.y.z/logos/png/60701190.png
```

**React Native (Expo/Metro)** — static require() map (bundles all logos, ~1.3 MB):

```tsx
import logos from 'logos-bancos-br/react-native';
<Image source={logos['0341']} style={{ width: 40, height: 40 }} />
```

**Node filesystem paths**:

```ts
import { logoPngPath, logoSvgPath } from 'logos-bancos-br/node';
```

**Any stack (Flutter, Kotlin, Swift, PHP, .NET…)** — vendor the assets, no runtime dependency:

```bash
npx logos-bancos-br copy --dest ./assets/banks [--by compe|ispb] [--format png|svg|both] [--only 341,001]
npx logos-bancos-br list
```

**CDN, no install** (always pin a version):

```
https://cdn.jsdelivr.net/npm/logos-bancos-br@0.1.0/logos/png/60701190.png
```

**Data only**:

```ts
import data from 'logos-bancos-br/data/bancos.json';
```

## Dataset shape

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
    "source": { "type": "openfinance", "org": "…", "cnpj": "…", "uri": "https://…", "sha256": "…", "updatedAt": "2026-07-17" }
  }
}
```

`logo.png` is a normalized transparent 256×256 PNG; `logo.svg` is the original vector when safely
redistributable; `logo: null` means the institution has no logo in the official sources.

## Trademarks

The logos are **trademarks of their respective financial institutions** and are **not** covered by
this repository's MIT license. They are redistributed for **nominative use** (identifying the
institution in user interfaces), from artwork the institutions themselves publish in the public
Open Finance Brasil directory. See **[DISCLAIMER.md](DISCLAIMER.md)**. Institutions can request
correction or removal via the **"Remoção de marca"** issue template — handled promptly.

Maintenance details (running the pipeline, promoting suggestions, overrides):
[CONTRIBUTING.md](CONTRIBUTING.md). License: [MIT](LICENSE) for code and dataset.
