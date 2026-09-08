/// Official logos of Brazilian financial institutions, served from the
/// logos-bancos-br CDN (https://github.com/rzmt/logos-bancos-br).
///
/// This is a thin URL builder: assets are keyed by ISPB (8 digits) and hosted
/// on jsDelivr with a permanence policy (published files are never removed).
/// For name/COMPE resolution fetch [cdnIndexJsonUrl]; for a pre-resolved
/// `ISPB -> URL` map fetch [logoUrlsJsonUrl].
library;

/// CDN base pinned to the 0.x series (asset paths are stable across versions).
const String cdnBase = 'https://cdn.jsdelivr.net/npm/logos-bancos-br@0';

/// Pre-resolved `{ISPB: url}` map — SVG when available, PNG otherwise;
/// only institutions that have a logo. Consumption: `logoUrl = map[ispb]`.
const String logoUrlsJsonUrl = '$cdnBase/data/logo-urls.min.json';

/// Compact index `{ispb: [compe, name, flags, assetIspb?]}` with flags
/// 0 = no logo, 1 = PNG only, 3 = PNG+SVG. Cooperative affiliates carry a
/// 4th element with the ISPB of the shared asset file.
const String cdnIndexJsonUrl = '$cdnBase/data/cdn-index.min.json';

/// URL of the 256x256 PNG for [assetIspb].
///
/// Note: cooperative affiliates (Sicoob, Sicredi, Cresol, Unicred) share
/// their system's file under another ISPB. When you only know the
/// institution's own ISPB, prefer the pre-resolved map at [logoUrlsJsonUrl].
String logoPngUrl(String assetIspb) => '$cdnBase/logos/png/$assetIspb.png';

/// URL of the sanitized SVG for [assetIspb] (not every logo ships one —
/// check flag 3 in [cdnIndexJsonUrl] or use [logoUrlsJsonUrl]).
String logoSvgUrl(String assetIspb) => '$cdnBase/logos/svg/$assetIspb.svg';
