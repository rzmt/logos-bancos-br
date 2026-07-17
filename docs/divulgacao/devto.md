<!-- Onde postar: dev.to (New post). O bloco --- inicial é o front matter do dev.to. -->

---
title: Brazilian bank logos without the guesswork — official sources only, rebuilt weekly by CI
published: false
tags: opensource, typescript, fintech, showdev
---

If you build anything that touches Brazilian payments, at some point you need to show *which institution* sits on the other side of a transfer — name and logo. The available options were lists in repositories that stopped updating years ago, or icon packs scraped from random websites with no way to tell whether a logo is current, or even correct.

I spent the last few weeks attacking this and open-sourced the result: **[logos-bancos-br](https://github.com/rzmt/logos-bancos-br)**.

## The idea: derive everything from official sources

- The [STR participants list](https://www.bcb.gov.br/estabilidadefinanceira/participantesstr) from the Central Bank of Brazil — ISPB (the official identifier), bank code and official names for the 470 institutions that have a bank code;
- The [active Pix participants list](https://www.bcb.gov.br/estabilidadefinanceira/participantespix), also from the Central Bank — adds the 643 institutions with no bank code at all (fintechs, payment institutions, credit-union affiliates), shipped as a separate dataset so the main list stays lean;
- The [Open Finance Brasil participants directory](https://data.directory.openbankingbrasil.org.br/participants) — where each institution publishes and maintains its own logo, keyed by CNPJ (the Brazilian company ID).

The bridge between the sources is a little-known property: an institution's ISPB is, in the vast majority of cases, the first 8 digits of its CNPJ. That joins the Central Bank lists to the Open Finance directory with zero heuristics.

A GitHub Action rebuilds the lists and the logos every Monday and opens a PR with the visual image diff. Every logo carries provenance in the dataset — source URI, SHA-256 of the original artwork, date. The git diff is the audit trail.

## The rules that shaped the design

**A wrong logo is worse than no logo.** In a payment context, showing the wrong bank's logo is a real problem. So name similarity never assigns a logo automatically — it only produces suggestions that a human reviews and promotes (or rejects) into an explicit config rule. Only exact ISPB matches ship on their own. This rule caught real traps: a "Kanastra" logo served from a domain marketplace, and the logo of a partner brand listed inside Banco Votorantim's directory entry.

**Repetition pollutes.** 315 credit-union affiliates (Sicoob, Sicredi, Cresol, Unicred systems) use their system's logo. The first version shipped hundreds of byte-identical PNGs; now affiliates reference **one shared file per system** — 473 institutions with logos backed by 160 distinct files (~1.7 MB) — and are marked `logo.source.type: "brand"` so you can filter own logos from inherited ones.

**Third-party SVGs are hostile input.** Every SVG is sanitized before being redistributed (no `script`, event handlers, `foreignObject` or external references); downloads are https-only with size and pixel caps. If an SVG fails sanitization, only the rasterized PNG ships.

## Usage

```ts
import { banks, pixInstitutions, byCompe, byIspb, logoCdnUrl } from 'logos-bancos-br';

byCompe(341);        // Itaú — official names, ISPB, logo with provenance
byIspb('11275560');  // RecargaPay — Pix-only institution, no bank code
logoCdnUrl(260);     // version-pinned jsDelivr URL
```

React Native gets a static `require()` map (`logos-bancos-br/react-native`); any other stack can vendor the assets with `npx logos-bancos-br copy --dest ./assets/banks`; or skip installing entirely:

```
https://cdn.jsdelivr.net/npm/logos-bancos-br@0.4.0/logos/png/60701190.png
```

## Honest limitations

- 473 of 1,113 institutions have a logo; the rest are small players that publish no official artwork anywhere — your app picks the fallback.
- Coverage follows the ecosystem: when an institution joins Open Finance or publishes a logo on its official site, the weekly pipeline picks it up.
- The logos are trademarks of their institutions (the code and dataset are MIT); they're redistributed for nominative use, and the repo has a takedown template.

Feedback is very welcome — especially from teams building payment products in Brazil: https://github.com/rzmt/logos-bancos-br
