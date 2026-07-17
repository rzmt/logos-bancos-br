/**
 * Builds `data/bancos.json` — every STR institution with a COMPE number,
 * with per-logo provenance (source URI, sha256, date) when a logo exists.
 */

import type { Bank, BankLogoSource, Dataset, Manifest, MatchEntry } from './types';

export function buildDataset({
  entries,
  manifest,
  pngIspbs,
  svgIspbs,
}: {
  entries: MatchEntry[];
  manifest: Manifest;
  pngIspbs: Set<string>;
  svgIspbs: Set<string>;
}): Dataset {
  // COMPE'd institutions first (sorted by code), then Pix-only ones by ISPB.
  const banks: Bank[] = [...entries]
    .sort(
      (a, b) => (a.compe4 ?? '￿').localeCompare(b.compe4 ?? '￿') || a.ispb.localeCompare(b.ispb),
    )
    .map((entry) => {
      const state = manifest[entry.ispb];
      let logo: Bank['logo'] = null;
      if (state && pngIspbs.has(entry.ispb)) {
        const type: BankLogoSource['type'] = state.uri.startsWith('override:')
          ? 'override'
          : state.org
            ? 'openfinance'
            : 'direct-uri';
        logo = {
          png: `logos/png/${entry.ispb}.png`,
          svg: state.svg && svgIspbs.has(entry.ispb) ? `logos/svg/${entry.ispb}.svg` : null,
          source: {
            type,
            org: state.org,
            cnpj: state.cnpj,
            uri: state.uri,
            sha256: state.sourceSha256,
            updatedAt: state.updatedAt,
          },
        };
      }
      return {
        ispb: entry.ispb,
        compe: entry.compe,
        compe4: entry.compe4,
        name: entry.fullName,
        shortName: entry.shortName,
        pix: entry.pix ?? null,
        logo,
      };
    });

  return { banks };
}

export function toDatasetJson(dataset: Dataset): string {
  return `${JSON.stringify(dataset, null, 2)}\n`;
}
