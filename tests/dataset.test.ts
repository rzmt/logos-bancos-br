import { describe, expect, it } from 'vitest';
import { buildDataset, toDatasetJson } from '../pipeline/dataset';
import type { Manifest, MatchEntry } from '../pipeline/types';

const ENTRIES: MatchEntry[] = [
  {
    ispb: '60701190',
    compe: '341',
    compe4: '0341',
    shortName: 'ITAÚ UNIBANCO S.A.',
    fullName: 'Itaú Unibanco S.A.',
    source: 'ispb',
    uri: 'https://logos.example/itau.svg',
    orgName: 'Itaú Unibanco',
    orgCnpj: '60701190000104',
  },
  {
    ispb: '00000000',
    compe: '1',
    compe4: '0001',
    shortName: 'BCO DO BRASIL S.A.',
    fullName: 'Banco do Brasil S.A.',
    source: null,
    uri: null,
    orgName: null,
    orgCnpj: null,
  },
];

const MANIFEST: Manifest = {
  '60701190': {
    compe4: '0341',
    org: 'Itaú Unibanco',
    cnpj: '60701190000104',
    uri: 'https://logos.example/itau.svg',
    sourceSha256: 'abc123',
    svg: true,
    updatedAt: '2026-07-16',
  },
};

describe('buildDataset', () => {
  it('sorts by COMPE and attaches provenance only when the png exists', () => {
    const dataset = buildDataset({
      entries: ENTRIES,
      manifest: MANIFEST,
      pngIspbs: new Set(['60701190']),
      svgIspbs: new Set(['60701190']),
    });
    expect(dataset.banks.map((bank) => bank.compe4)).toEqual(['0001', '0341']);

    const bb = dataset.banks[0];
    expect(bb?.logo).toBeNull();

    const itau = dataset.banks[1];
    expect(itau?.logo?.png).toBe('logos/png/60701190.png');
    expect(itau?.logo?.svg).toBe('logos/svg/60701190.svg');
    expect(itau?.logo?.source).toMatchObject({
      type: 'openfinance',
      org: 'Itaú Unibanco',
      sha256: 'abc123',
      updatedAt: '2026-07-16',
    });
  });

  it('omits the svg path when the manifest says the source is not a safe svg', () => {
    const manifest: Manifest = {
      '60701190': { ...(MANIFEST['60701190'] as Manifest[string]), svg: false },
    };
    const dataset = buildDataset({
      entries: [ENTRIES[0] as MatchEntry],
      manifest,
      pngIspbs: new Set(['60701190']),
      svgIspbs: new Set(['60701190']),
    });
    expect(dataset.banks[0]?.logo?.svg).toBeNull();
  });

  it('derives the source type from the manifest uri/org', () => {
    const overrideManifest: Manifest = {
      '60701190': {
        ...(MANIFEST['60701190'] as Manifest[string]),
        org: null,
        cnpj: null,
        uri: 'override:60701190.svg',
      },
    };
    const dataset = buildDataset({
      entries: [ENTRIES[0] as MatchEntry],
      manifest: overrideManifest,
      pngIspbs: new Set(['60701190']),
      svgIspbs: new Set(),
    });
    expect(dataset.banks[0]?.logo?.source.type).toBe('override');

    const directManifest: Manifest = {
      '60701190': {
        ...(MANIFEST['60701190'] as Manifest[string]),
        org: null,
        cnpj: null,
        uri: 'https://direct.example/logo.png',
      },
    };
    const direct = buildDataset({
      entries: [ENTRIES[0] as MatchEntry],
      manifest: directManifest,
      pngIspbs: new Set(['60701190']),
      svgIspbs: new Set(),
    });
    expect(direct.banks[0]?.logo?.source.type).toBe('direct-uri');
  });
});

describe('toDatasetJson', () => {
  it('produces stable, newline-terminated json', () => {
    const dataset = buildDataset({
      entries: ENTRIES,
      manifest: MANIFEST,
      pngIspbs: new Set(),
      svgIspbs: new Set(),
    });
    const json = toDatasetJson(dataset);
    expect(json.endsWith('\n')).toBe(true);
    expect(JSON.parse(json)).toEqual(dataset);
  });
});
