# logos-bancos-br

> **Dataset + logos of Brazil's financial and payment institutions** — banks, fintechs, payment
> institutions and credit unions — **always up to date**. Everything is derived from three named
> official sources: the **STR participants list** and the **active Pix participants list**, both
> from the **Central Bank of Brazil (BCB)**, plus the **Open Finance Brasil participants
> directory**. Rebuilt automatically every week by CI, with verifiable per-logo provenance.
> **[Versão em português](README.md)**

[![CI](https://github.com/rzmt/logos-bancos-br/actions/workflows/ci.yml/badge.svg)](https://github.com/rzmt/logos-bancos-br/actions/workflows/ci.yml)
[![update](https://github.com/rzmt/logos-bancos-br/actions/workflows/update-logos.yml/badge.svg)](https://github.com/rzmt/logos-bancos-br/actions/workflows/update-logos.yml)
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

1. **The list of institutions — auto-updated, in two sets.** The **main list**
   ([`data/bancos.json`](data/bancos.json)) carries the **470 institutions with a COMPE code**
   from the Central Bank STR participants list. The **643 Pix-only institutions** (fintechs,
   payment institutions, cooperative affiliates — no COMPE) live in a separate dataset
   ([`data/instituicoes-pix.json`](data/instituicoes-pix.json)) — the main list stays clean,
   and the full Pix universe is one import away.
2. **Official logos, deduplicated.** **473 institutions with a logo** backed by **160 distinct
   files** (~1.7 MB): affiliates of single-brand cooperative systems (Sicoob, Sicredi, Cresol,
   Unicred) **share one file per system**, marked `logo.source.type: "brand"`. Own logos come
   from the public **Open Finance Brasil** directory (`openfinance`) or the **institution's own
   official website** (`direct-uri`, visually curated). Every file carries provenance: source
   URI, SHA-256 and date.
3. **Automatic updates, no manual curation.** Every Monday a GitHub Action
   ([`update-logos.yml`](.github/workflows/update-logos.yml)) rebuilds **both the list AND the
   logos** from the sources and opens a PR with the visual diff. A bank created, renamed or
   closed by the Central Bank? An institution rebranded? It lands in that week's update.
4. **Works in any stack.** JavaScript/TypeScript API, a ready-made React Native map, a CLI that
   copies the assets into Flutter/Kotlin/Swift/.NET/PHP projects, CDN URLs with no install — or
   just the JSON.

## Why official sources?

Hand-maintained lists rot: the Central Bank adds, renames and removes institutions throughout
the year, and banks redesign their brands. Existing libraries ship either **data only** (no
logos) or logos **collected from assorted websites** with no traceability. The approach here:

- **Official sources, and only them** — the STR and Pix participants CSVs (updated daily by the
  Central Bank itself), the Open Finance Brasil participants directory and, for non-participants,
  the icon the institution publishes **on its own official website** (hand-reviewed). No images
  "found on Google" or from aggregators. Open Finance purists can filter:
  `banks().filter(b => b.logo?.source.type === 'openfinance')`.
- **Per-logo provenance** — `data/bancos.json` records each logo's source URI, SHA-256 of the
  original artwork and last-change date. The git diff is the audit trail.
- **Safe matching** — automatic matches happen **only via ISPB** (= first 8 digits of the CNPJ).
  Name similarity never assigns a logo by itself: it only produces suggestions for human review.
  In a banking context, a wrong logo is worse than no logo.
- **Safe assets** — https-only downloads with size/pixel caps; SVGs redistributed only after
  sanitization (no scripts, event handlers, `foreignObject` or external references).
- **Honest trade-off** — 473 of the 1,113 institutions have a logo (Open Finance participants,
  cooperative-system affiliates and ~45 institutions covered via official sites — the vast
  majority of accounts in Brazil). The rest are small SCDs/brokers/payment institutions — your
  app picks the fallback, and coverage grows every release.

## Install & use

```bash
npm install logos-bancos-br
```

Requires **Node ≥ 20** for Node/CLI usage (web and React Native follow your bundler's
environment). Zero runtime dependencies. Published with **npm provenance** — verify integrity
with `npm audit signatures`.

Files are named by **ISPB** (8 digits). `banks()` is the main list (COMPE holders);
`pixInstitutions()` is the separate Pix-only set; `allInstitutions()` is both; `byIspb()`
resolves across the two. Each institution carries a `pix` block (participation attributes,
verbatim from the BCB list) or `null`.

```ts
import { banks, byCompe, byIspb, logoCdnUrl } from 'logos-bancos-br';

byCompe(341);        // { ispb: '60701190', compe4: '0341', name: 'Itaú Unibanco S.A.', logo: {...} }
byIspb('00000000');  // Banco do Brasil
logoCdnUrl(341);     // https://cdn.jsdelivr.net/npm/logos-bancos-br@x.y.z/logos/png/60701190.png
```

**React Native (Expo/Metro)** — static require() map (bundles the 160 distinct logos, ~1.7 MB; keys accept both
the 4-digit COMPE and the 8-digit ISPB — Pix-only institutions by ISPB only; affiliates point at
the shared system asset):

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
https://cdn.jsdelivr.net/npm/logos-bancos-br@0.3.0/logos/png/60701190.png
```

**Data only**:

```ts
import banks from 'logos-bancos-br/data/bancos.json';          // main list (COMPE)
import pixOnly from 'logos-bancos-br/data/instituicoes-pix.json'; // Pix-only
```

### API quick reference

| Import | Function | Returns |
|---|---|---|
| `logos-bancos-br` | `banks()` | main list — COMPE institutions (`Bank[]`) |
| | `pixInstitutions()` | Pix-only set (`PixInstitution[]`) |
| | `allInstitutions()` | both sets (`Institution[]`) |
| | `byCompe(code)` | `Bank \| undefined` — `341`, `'341'` and `'0341'` are equivalent |
| | `byIspb(ispb)` | `Institution \| undefined` — resolves across both sets |
| | `findBank(code)` | `Institution \| undefined` — more than 4 digits is treated as ISPB |
| | `logoCdnUrl(code, { format?, version? })` | jsDelivr URL, or `null` when there is no logo |
| | `normalizeCompe(x)` · `normalizeIspb(x)` | `'0341'` · `'60701190'` |
| | `version` | package version (string) |
| `logos-bancos-br/node` | `logoPngPath(code)` · `logoSvgPath(code)` | absolute asset path, or `null` |
| | `copyLogos({ dest, format?, by?, only? })` | copies assets into a directory (what the CLI uses) |
| `logos-bancos-br/react-native` | `logos` (default export) | require() map keyed by COMPE4 **and** ISPB |

Exported TypeScript types: `Bank`, `PixInstitution`, `Institution`, `BankLogo`, `BankLogoSource`, `PixInfo`.

## Dataset shape

```json
{
  "ispb": "60701190",
  "compe": "341",
  "compe4": "0341",
  "name": "Itaú Unibanco S.A.",
  "shortName": "ITAÚ UNIBANCO S.A.",
  "pix": { "spiParticipationType": "Direta", "pixParticipationType": "Obrigatória", "modality": "Provedor de Conta Transacional", "institutionType": "Banco Múltiplo", "authorizedByBcb": true },
  "logo": {
    "png": "logos/png/60701190.png",
    "svg": "logos/svg/60701190.svg",
    "source": { "type": "openfinance", "org": "…", "cnpj": "…", "uri": "https://…", "sha256": "…", "updatedAt": "2026-07-17" }
  }
}
```

`logo.png` is a normalized transparent 256×256 PNG; `logo.svg` is the original vector when safely
redistributable; `logo: null` means no logo in the official sources; `logo.source.type: "brand"`
marks a logo inherited from the institution's cooperative system (shared asset, `brand` says
which); `pix: null` marks a non-Pix participant. Pix-only records (separate dataset) always have
`compe: null`, a 14-digit `cnpj` and a `pix` block.

## How the auto-update works

The pipeline unions the Central Bank's STR and active-Pix participants lists (which institutions
exist, keyed by ISPB) and joins them with the Open Finance directory (their logos), bridged by
`ISPB == first 8 digits of the CNPJ`; hand-reviewed `forcedMatches` cover second brands (XP
CCTVM, Nu Invest, Bradesco BBI…), and a curated brand rule gives cooperative-system affiliates
(Sicoob/Sicredi/Cresol/Unicred) their system's logo. For institutions outside Open Finance,
discovery tools (`npm run discover` / `discover:ai`) find the icon published on the institution's
official website — nothing ships without visual curation (brand + domain reviewed); approvals
become `forcedUris` (`source.type: "direct-uri"`). The weekly workflow regenerates
`data/bancos.json`, `logos/`, `PREVIEW.md` and `react-native.js` and opens a PR with the report
and the visual PNG diff. After review and merge, the maintainer publishes a new version to npm
(GitHub Release). Nothing is edited by hand. Maintenance details:
[CONTRIBUTING.md](CONTRIBUTING.md).

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
