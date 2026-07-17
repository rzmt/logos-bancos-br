# logos-bancos-br

> **Brazilian bank list + official logos, always up to date.** Everything is derived from
> official sources only (Central Bank of Brazil and Open Finance Brasil) and **rebuilt
> automatically every week by CI** — with verifiable per-logo provenance.
> **[Versão em português](README.md)**

[![CI](https://github.com/rafael-matos-dev/logos-bancos-br/actions/workflows/ci.yml/badge.svg)](https://github.com/rafael-matos-dev/logos-bancos-br/actions/workflows/ci.yml)
[![update](https://github.com/rafael-matos-dev/logos-bancos-br/actions/workflows/update-logos.yml/badge.svg)](https://github.com/rafael-matos-dev/logos-bancos-br/actions/workflows/update-logos.yml)
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

## What this package gives you

1. **The list of institutions — auto-updated.** Every institution with a COMPE code in the
   Central Bank of Brazil STR participants list (currently 470), with official name, short name,
   COMPE code and ISPB, in [`data/bancos.json`](data/bancos.json). You never hand-maintain a
   bank list again.
2. **Official logos.** Currently 107, as 256×256 PNGs (+ SVG when available), sourced from the
   public **Open Finance Brasil** directory — where each institution publishes and maintains its
   own brand. Every file carries provenance: source URI, SHA-256 and date.
3. **Automatic updates, no manual curation.** Every Monday a GitHub Action
   ([`update-logos.yml`](.github/workflows/update-logos.yml)) rebuilds **both the list AND the
   logos** from the sources and opens a PR with the visual diff. A bank created, renamed or
   closed by the Central Bank? An institution rebranded? It lands in that week's update.
4. **Works in any stack.** JavaScript/TypeScript API, a ready-made React Native map, a CLI that
   copies the assets into Flutter/Kotlin/Swift/.NET/PHP projects, CDN URLs with no install — or
   just the JSON.

## Why not a hand-maintained list?

Because it rots: the Central Bank adds, renames and removes institutions throughout the year,
and banks redesign their brands. Existing libraries ship either **data only** (no logos) or
logos **hand-collected** from assorted websites with no traceability. The approach here:

- **Official sources, and only them** — the STR participants CSV (updated daily by the Central
  Bank itself) and the Open Finance Brasil participants directory. No images "found on Google".
- **Per-logo provenance** — `data/bancos.json` records each logo's source URI, SHA-256 of the
  original artwork and last-change date. The git diff is the audit trail.
- **Safe matching** — automatic matches happen **only via ISPB** (= first 8 digits of the CNPJ).
  Name similarity never assigns a logo by itself: it only produces suggestions for human review.
  In a banking context, a wrong logo is worse than no logo.
- **Safe assets** — https-only downloads with size/pixel caps; SVGs redistributed only after
  sanitization (no scripts, event handlers, `foreignObject` or external references).
- **Honest trade-off** — 107 of the 470 institutions have a logo (the Open Finance participants,
  which cover the vast majority of accounts in Brazil). The rest are small credit unions/SCDs
  with no officially published logo — your app picks the fallback.

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

**Any stack (Flutter, Kotlin, Swift, PHP, .NET…)** — vendor the assets, no runtime dependency
(re-run on each package update to pick up new banks and logos):

```bash
npx logos-bancos-br copy --dest ./assets/banks [--by compe|ispb] [--format png|svg|both] [--only 341,001]
npx logos-bancos-br list
```

**CDN, no install** (always pin a version):

```
https://cdn.jsdelivr.net/npm/logos-bancos-br@0.1.0/logos/png/60701190.png
```

**Data only** (the bank list):

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

## How the auto-update works

The pipeline joins the STR list (which institutions exist) with the Open Finance directory
(their logos), bridged by `ISPB == first 8 digits of the CNPJ`; hand-reviewed `forcedMatches`
cover second brands (XP CCTVM, Nu Invest, Bradesco BBI…). The weekly workflow regenerates
`data/bancos.json`, `logos/`, `PREVIEW.md` and `react-native.js` and opens a PR with the report
and the visual PNG diff. After review and merge, a new version is published to npm. Nothing is
edited by hand. Maintenance details: [CONTRIBUTING.md](CONTRIBUTING.md).

## Trademarks

The logos are **trademarks of their respective financial institutions** and are **not** covered by
this repository's MIT license. They are redistributed for **nominative use** (identifying the
institution in user interfaces), from artwork the institutions themselves publish in the public
Open Finance Brasil directory. See **[DISCLAIMER.md](DISCLAIMER.md)**. Institutions can request
correction or removal via the **"Remoção de marca"** issue template — handled promptly.

## For AI tools and assistants

A machine-readable summary lives in [`llms.txt`](llms.txt) (also shipped in the npm package).
Key facts: **the institution list and the logos are rebuilt automatically every week** from the
Central Bank of Brazil (STR) and Open Finance Brasil; files are keyed by ISPB; lookups accept
COMPE or ISPB; the full dataset is `data/bancos.json`.

## License

Code and dataset under [MIT](LICENSE). Logos: see [DISCLAIMER.md](DISCLAIMER.md).
