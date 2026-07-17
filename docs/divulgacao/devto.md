# [DRAFT — dev.to, English]

**Title:** Every Brazilian Pix institution + official logos, from government sources only — auto-updated weekly
**Tags:** opensource, typescript, fintech, api

---

If you build anything that touches Brazilian payments, you eventually need to show *which institution* is on the other side of a transfer — name and logo. The existing options were hand-maintained lists (they rot) or logos scraped from random websites (no traceability).

I took a different approach and open-sourced it: **[logos-bancos-br](https://github.com/rzmt/logos-bancos-br)**.

## Official sources only, with provenance

- **The institution list** comes from two official Central Bank lists, deliberately shipped as two datasets: a **main list** with the ~470 institutions holding a bank code (STR participants) and a separate set with the ~640 **Pix-only institutions** (fintechs, payment institutions, cooperative affiliates — from the daily official active-Pix-participants CSV). Total: **1,113 institutions** with Pix participation attributes, without polluting the main list.
- **The logos** come from the **Open Finance Brasil participants directory** — where each institution publishes and maintains its own brand — plus hand-curated official websites for non-participants. Cooperative-system affiliates share one asset per brand: **473 institutions with logos backed by ~160 distinct files (~1.7 MB)**, every one carrying provenance: source URI, SHA-256, date.
- **Weekly automation**: a GitHub Action rebuilds the list and the logos from the sources every Monday and opens a PR with the visual diff. Automatic matching happens only via official identifiers (ISPB = CNPJ root); name similarity never assigns a logo by itself — in a banking context, a wrong logo is worse than no logo.

## Works in any stack

```ts
import { byCompe, byIspb, logoCdnUrl } from 'logos-bancos-br';
byCompe(341);       // Itaú — official names + logo with provenance
byIspb('11275560'); // RecargaPay — Pix-only institution, no bank code
logoCdnUrl(260);    // version-pinned jsDelivr URL
```

React Native gets a static `require()` map; Flutter/Kotlin/Swift can vendor the assets via `npx logos-bancos-br copy`; or skip the install entirely and hit the CDN: `https://cdn.jsdelivr.net/npm/logos-bancos-br@0.3.0/logos/png/60701190.png`.

MIT for code and dataset. The logos are trademarks of their institutions, redistributed for nominative use, with a takedown template in the repo.

Feedback welcome — especially from teams building payment apps in Brazil.
