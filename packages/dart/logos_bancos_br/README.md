# logos_bancos_br

Official logos of Brazilian financial institutions (banks, fintechs, payment
institutions, credit unions) — sourced **only from official data** (Central
Bank STR/Pix participant lists and the Open Finance Brasil directory), with
per-logo provenance and weekly auto-updates.

This Dart package is a thin URL builder over the CDN-hosted
[logos-bancos-br](https://github.com/rzmt/logos-bancos-br) dataset. Assets are
keyed by ISPB and served from jsDelivr with a permanence policy (published
files are never removed) — no bundled images, no runtime dependencies.

```dart
import 'package:logos_bancos_br/logos_bancos_br.dart';

// Itaú Unibanco (ISPB 60701190)
final png = logoPngUrl('60701190'); // …/logos/png/60701190.png (256x256)
final svg = logoSvgUrl('60701190'); // …/logos/svg/60701190.svg

// Don't know the asset ISPB? Fetch the pre-resolved {ISPB: url} map:
// GET logoUrlsJsonUrl  →  { "60701190": "https://…svg", … }
```

For the full dataset (names, COMPE, Pix attributes), the interactive gallery
and the provenance model, see the main repository:

- Repo: https://github.com/rzmt/logos-bancos-br
- Gallery: https://rzmt.github.io/logos-bancos-br/
- Used by [BrasilAPI](https://brasilapi.com.br) (`/banks/v1` → `logo_url`) and
  [BancosBrasileiros](https://github.com/guibranco/BancosBrasileiros) (`LogoUrl`).

Logos and trademarks belong to their respective institutions and are
distributed for identification purposes only
([disclaimer](https://github.com/rzmt/logos-bancos-br/blob/main/DISCLAIMER.md)).
