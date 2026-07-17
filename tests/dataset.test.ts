import { describe, expect, it } from 'vitest';
import { buildDatasets, toJson } from '../pipeline/dataset';
import type { Manifest, MatchEntry, PixInfo } from '../pipeline/types';

const PIX: PixInfo = {
  spiParticipationType: 'Direta',
  pixParticipationType: 'Facultativa',
  modality: 'Provedor de Conta Transacional',
  institutionType: 'Instituição de Pagamento',
  authorizedByBcb: true,
};

const ENTRIES: MatchEntry[] = [
  {
    ispb: '60701190',
    compe: '341',
    compe4: '0341',
    shortName: 'ITAÚ UNIBANCO S.A.',
    fullName: 'Itaú Unibanco S.A.',
    cnpj: null,
    pix: PIX,
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
    cnpj: null,
    pix: null,
    source: null,
    uri: null,
    orgName: null,
    orgCnpj: null,
  },
  // Afiliada só-Pix com logo herdado do sistema (asset compartilhado).
  {
    ispb: '25387655',
    compe: null,
    compe4: null,
    shortName: 'CC CREDIVALE - SICOOB CREDIVALE',
    fullName: 'CC CREDIVALE - SICOOB CREDIVALE',
    cnpj: '25387655000199',
    pix: PIX,
    source: 'brand-match',
    uri: 'https://logos.example/sicoob.svg',
    orgName: 'Confederacao Sicoob',
    orgCnpj: '04891850000188',
    assetIspb: '04891850',
    brandToken: 'SICOOB',
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
  '04891850': {
    compe4: null,
    org: 'Confederacao Sicoob',
    cnpj: '04891850000188',
    uri: 'https://logos.example/sicoob.svg',
    sourceSha256: 'sic123',
    svg: true,
    updatedAt: '2026-07-17',
  },
};

describe('buildDatasets', () => {
  const built = buildDatasets({
    entries: ENTRIES,
    manifest: MANIFEST,
    pngIspbs: new Set(['60701190', '04891850']),
    svgIspbs: new Set(['60701190', '04891850']),
  });

  it('splits COMPE institutions from Pix-only ones', () => {
    expect(built.dataset.banks.map((bank) => bank.compe4)).toEqual(['0001', '0341']);
    expect(built.pixDataset.institutions.map((i) => i.ispb)).toEqual(['25387655']);
  });

  it('attaches provenance to main-list banks', () => {
    const itau = built.dataset.banks[1];
    expect(itau?.logo?.png).toBe('logos/png/60701190.png');
    expect(itau?.logo?.source).toMatchObject({ type: 'openfinance', sha256: 'abc123' });
    expect(itau?.pix?.pixParticipationType).toBe('Facultativa');
    expect(built.dataset.banks[0]?.logo).toBeNull();
  });

  it('brand affiliates reference the SHARED system asset with source.type brand', () => {
    const affiliate = built.pixDataset.institutions[0];
    expect(affiliate?.logo?.png).toBe('logos/png/04891850.png');
    expect(affiliate?.logo?.svg).toBe('logos/svg/04891850.svg');
    expect(affiliate?.logo?.source.type).toBe('brand');
    expect(affiliate?.logo?.source.brand).toBe('SICOOB');
    expect(affiliate?.cnpj).toBe('25387655000199');
  });

  it('derives override and direct-uri types from the manifest', () => {
    const overrideManifest: Manifest = {
      '60701190': {
        ...(MANIFEST['60701190'] as Manifest[string]),
        org: null,
        cnpj: null,
        uri: 'override:60701190.svg',
      },
    };
    const { dataset } = buildDatasets({
      entries: [ENTRIES[0] as MatchEntry],
      manifest: overrideManifest,
      pngIspbs: new Set(['60701190']),
      svgIspbs: new Set(),
    });
    expect(dataset.banks[0]?.logo?.source.type).toBe('override');
  });
});

describe('toJson', () => {
  it('produces stable, newline-terminated json', () => {
    const json = toJson({ a: 1 });
    expect(json.endsWith('\n')).toBe(true);
    expect(JSON.parse(json)).toEqual({ a: 1 });
  });
});
