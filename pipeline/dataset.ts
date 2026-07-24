/**
 * Builds the two shipped datasets:
 *  - `data/bancos.json` — the main list (institutions with a COMPE code);
 *  - `data/instituicoes-pix.json` — Pix-only institutions (no COMPE),
 *    kept separate so the main list stays clean.
 *
 * Both carry per-logo provenance. Brand-matched institutions reference the
 * shared asset of their cooperative system (one file per brand) and are
 * marked with `source.type: "brand"` + the brand token.
 */

import type {
  Bank,
  BankLogo,
  BankLogoSource,
  Dataset,
  Manifest,
  MatchEntry,
  PixDataset,
  PixInstitution,
} from './types';

function buildLogo(
  entry: MatchEntry,
  manifest: Manifest,
  pngIspbs: Set<string>,
  svgIspbs: Set<string>,
): BankLogo | null {
  const assetIspb = entry.assetIspb ?? entry.ispb;
  const state = manifest[assetIspb];
  if (!state || !pngIspbs.has(assetIspb)) return null;

  let type: BankLogoSource['type'];
  if (entry.source === 'brand-match') type = 'brand';
  else if (state.uri.startsWith('override:')) type = 'override';
  else if (state.org) type = 'openfinance';
  else type = 'direct-uri';

  const source: BankLogoSource = {
    type,
    org: state.org,
    cnpj: state.cnpj,
    uri: state.uri,
    sha256: state.sourceSha256,
    updatedAt: state.updatedAt,
  };
  if (type === 'brand' && entry.brandToken) source.brand = entry.brandToken;

  return {
    png: `logos/png/${assetIspb}.png`,
    svg: state.svg && svgIspbs.has(assetIspb) ? `logos/svg/${assetIspb}.svg` : null,
    source,
  };
}

export function buildDatasets({
  entries,
  manifest,
  pngIspbs,
  svgIspbs,
}: {
  entries: MatchEntry[];
  manifest: Manifest;
  pngIspbs: Set<string>;
  svgIspbs: Set<string>;
}): { dataset: Dataset; pixDataset: PixDataset } {
  const sorted = [...entries].sort(
    (a, b) => (a.compe4 ?? '￿').localeCompare(b.compe4 ?? '￿') || a.ispb.localeCompare(b.ispb),
  );

  const banks: Bank[] = [];
  const pixInstitutions: PixInstitution[] = [];

  for (const entry of sorted) {
    const logo = buildLogo(entry, manifest, pngIspbs, svgIspbs);
    if (entry.compe !== null && entry.compe4 !== null) {
      banks.push({
        ispb: entry.ispb,
        compe: entry.compe,
        compe4: entry.compe4,
        name: entry.fullName,
        shortName: entry.shortName,
        pix: entry.pix ?? null,
        logo,
      });
    } else if (entry.pix && entry.cnpj) {
      pixInstitutions.push({
        ispb: entry.ispb,
        compe: null,
        compe4: null,
        cnpj: entry.cnpj,
        name: entry.fullName,
        shortName: entry.shortName,
        pix: entry.pix,
        logo,
      });
    }
  }

  return { dataset: { banks }, pixDataset: { institutions: pixInstitutions } };
}

export function toJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/**
 * Índice compacto para consumo via CDN sem instalar o pacote:
 * `{ispb: [compe, nome, flags]}` com flags 0 = sem logo, 1 = png, 3 = png+svg.
 * Determinístico (sem timestamps) para o writeIfChanged não gerar diff vazio.
 */
export function buildCdnIndex(dataset: Dataset, pixDataset: PixDataset): string {
  const institutions: Record<string, [string | null, string, number]> = {};
  for (const inst of [...dataset.banks, ...pixDataset.institutions]) {
    let flags = 0;
    if (inst.logo) flags = inst.logo.svg ? 3 : 1;
    institutions[inst.ispb] = [inst.compe, inst.name, flags];
  }
  const index = {
    version: 1,
    logoPathTemplate: 'logos/{format}/{ispb}.{format}',
    count: Object.keys(institutions).length,
    institutions,
  };
  return `${JSON.stringify(index)}\n`;
}
