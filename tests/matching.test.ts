import { describe, expect, it } from 'vitest';
import { buildMatches, indexDirectory } from '../pipeline/matching';
import type { PipelineConfig, RawOrganisation, StrParticipant } from '../pipeline/types';

function participant(overrides: Partial<StrParticipant> = {}): StrParticipant {
  return {
    ispb: '60701190',
    compe: '341',
    compe4: '0341',
    shortName: 'ITAÚ UNIBANCO S.A.',
    fullName: 'Itaú Unibanco S.A.',
    ...overrides,
  };
}

function organisation(overrides: Partial<RawOrganisation> = {}): RawOrganisation {
  return {
    Status: 'Active',
    OrganisationId: 'org-itau',
    OrganisationName: 'Itaú Unibanco',
    RegistrationNumber: '60701190000104',
    AuthorisationServers: [
      {
        AuthorisationServerId: 'as-1',
        CustomerFriendlyName: 'Itaú',
        CustomerFriendlyLogoUri: 'https://logos.example/itau.svg',
      },
    ],
    ...overrides,
  };
}

function config(overrides: Partial<PipelineConfig> = {}): PipelineConfig {
  return {
    pngSizePx: 256,
    maxDownloadBytes: 2_097_152,
    timeoutMs: 15_000,
    concurrency: 5,
    nameSuggestionThreshold: 0.5,
    denylistUris: [],
    forcedUris: {},
    forcedMatches: {},
    ignoreIspb: [],
    ...overrides,
  };
}

describe('indexDirectory', () => {
  it('indexes active organisations with usable logos by CNPJ root', () => {
    const index = indexDirectory([organisation()]);
    expect(index.orgs).toHaveLength(1);
    expect(index.byCnpjRoot.get('60701190')?.[0]?.cnpj).toBe('60701190000104');
    expect(index.byCnpj.has('60701190000104')).toBe(true);
  });

  it('skips inactive organisations', () => {
    const index = indexDirectory([organisation({ Status: 'Inactive' })]);
    expect(index.orgs).toHaveLength(0);
  });

  it('skips organisations without any usable logo URI', () => {
    const noUri = organisation({
      AuthorisationServers: [{ AuthorisationServerId: 'as-1', CustomerFriendlyName: 'X' }],
    });
    const httpOnly = organisation({
      AuthorisationServers: [
        {
          AuthorisationServerId: 'as-2',
          CustomerFriendlyName: 'Y',
          CustomerFriendlyLogoUri: 'http://insecure.example/logo.png',
        },
      ],
    });
    expect(indexDirectory([noUri, httpOnly]).orgs).toHaveLength(0);
  });

  it('applies the URI denylist', () => {
    const index = indexDirectory([organisation()], {
      denylistUris: ['https://logos.example/itau.svg'],
    });
    expect(index.orgs).toHaveLength(0);
  });
});

describe('buildMatches', () => {
  it('matches automatically when the ISPB equals the CNPJ root', () => {
    const { entries, suggestions } = buildMatches({
      participants: [participant()],
      directory: [organisation()],
      config: config(),
      overrides: new Map(),
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.source).toBe('ispb');
    expect(entries[0]?.uri).toBe('https://logos.example/itau.svg');
    expect(entries[0]?.orgName).toBe('Itaú Unibanco');
    expect(suggestions).toHaveLength(0);
  });

  it('prefers the head office (branch 0001) among conglomerate organisations', () => {
    const branch = organisation({
      OrganisationId: 'org-branch',
      OrganisationName: 'Itaú Corretora',
      RegistrationNumber: '60701190000296',
      AuthorisationServers: [
        {
          AuthorisationServerId: 'as-b',
          CustomerFriendlyName: 'Corretora',
          CustomerFriendlyLogoUri: 'https://logos.example/corretora.svg',
        },
      ],
    });
    const head = organisation({
      OrganisationId: 'org-head',
      RegistrationNumber: '60701190000104',
    });
    const { entries } = buildMatches({
      participants: [participant()],
      directory: [branch, head],
      config: config(),
      overrides: new Map(),
    });
    expect(entries[0]?.orgCnpj).toBe('60701190000104');
  });

  it('lets forcedMatches point to an organisation with a different CNPJ root', () => {
    const other = organisation({
      OrganisationId: 'org-holding',
      OrganisationName: 'Holding Financeira',
      RegistrationNumber: '11222333000144',
      AuthorisationServers: [
        {
          AuthorisationServerId: 'as-h',
          CustomerFriendlyName: 'Marca',
          CustomerFriendlyLogoUri: 'https://logos.example/marca.svg',
        },
      ],
    });
    const { entries } = buildMatches({
      participants: [participant({ ispb: '99999999' })],
      directory: [other],
      config: config({ forcedMatches: { '99999999': '11222333000144' } }),
      overrides: new Map(),
    });
    expect(entries[0]?.source).toBe('forced-match');
    expect(entries[0]?.orgCnpj).toBe('11222333000144');
  });

  it('gives forcedUris precedence over forcedMatches, and overrides over both', () => {
    const base = {
      participants: [participant({ ispb: '99999999' })],
      directory: [organisation()],
    };
    const forced = buildMatches({
      ...base,
      config: config({
        forcedUris: { '99999999': 'https://direct.example/logo.svg' },
        forcedMatches: { '99999999': '60701190000104' },
      }),
      overrides: new Map(),
    });
    expect(forced.entries[0]?.source).toBe('forced-uri');

    const overridden = buildMatches({
      ...base,
      config: config({ forcedUris: { '99999999': 'https://direct.example/logo.svg' } }),
      overrides: new Map([['99999999', '/tmp/99999999.svg']]),
    });
    expect(overridden.entries[0]?.source).toBe('override');
    expect(overridden.entries[0]?.uri).toBeNull();
  });

  it('never assigns a logo by name similarity — it only suggests', () => {
    const nubank = organisation({
      OrganisationId: 'org-nu',
      OrganisationName: 'Nu Pagamentos',
      RegistrationNumber: '18236120000158',
      AuthorisationServers: [
        {
          AuthorisationServerId: 'as-nu',
          CustomerFriendlyName: 'Nubank',
          CustomerFriendlyLogoUri: 'https://logos.example/nu.svg',
        },
      ],
    });
    const { entries, suggestions } = buildMatches({
      participants: [
        participant({
          ispb: '12345678',
          shortName: 'NU FINANCEIRA',
          fullName: 'Nu Financeira S.A.',
        }),
      ],
      directory: [nubank],
      config: config(),
      overrides: new Map(),
    });
    expect(entries[0]?.source).toBeNull();
    expect(entries[0]?.uri).toBeNull();
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.cnpj).toBe('18236120000158');
    expect(suggestions[0]?.score).toBeGreaterThanOrEqual(0.5);
  });

  it('drops suggestions below the threshold', () => {
    const { suggestions } = buildMatches({
      participants: [
        participant({ ispb: '12345678', shortName: 'BANCO ZETA', fullName: 'Banco Zeta S.A.' }),
      ],
      directory: [organisation()],
      config: config(),
      overrides: new Map(),
    });
    expect(suggestions).toHaveLength(0);
  });

  it('skips ISPBs listed in ignoreIspb', () => {
    const { entries } = buildMatches({
      participants: [participant()],
      directory: [organisation()],
      config: config({ ignoreIspb: ['60701190'] }),
      overrides: new Map(),
    });
    expect(entries).toHaveLength(0);
  });

  it('reports override files whose ISPB is not in the backbone', () => {
    const { unusedOverrides } = buildMatches({
      participants: [participant()],
      directory: [organisation()],
      config: config(),
      overrides: new Map([['11111111', '/tmp/11111111.png']]),
    });
    expect(unusedOverrides).toEqual(['11111111']);
  });

  it('picks the authorisation server whose name is closest to the institution', () => {
    const multiServer = organisation({
      AuthorisationServers: [
        {
          AuthorisationServerId: 'as-2',
          CustomerFriendlyName: 'Itaú Empresas',
          CustomerFriendlyLogoUri: 'https://logos.example/empresas.svg',
        },
        {
          AuthorisationServerId: 'as-1',
          CustomerFriendlyName: 'Itaú Unibanco',
          CustomerFriendlyLogoUri: 'https://logos.example/unibanco.svg',
        },
      ],
    });
    const { entries } = buildMatches({
      participants: [participant()],
      directory: [multiServer],
      config: config(),
      overrides: new Map(),
    });
    expect(entries[0]?.uri).toBe('https://logos.example/unibanco.svg');
  });

  it('breaks 0-score server ties by the majority URI, not by id (partner-brand trap)', () => {
    // Real-world case: Banco Votorantim lists "banco BV", "banco BV - Corporate"
    // and partner "Méliuz". None matches "BCO VOTORANTIM" by name; the BV logo
    // appears twice and must win over the partner logo with the lowest id.
    const bv = organisation({
      OrganisationId: 'org-bv',
      OrganisationName: 'BCO VOTORANTIM S.A.',
      RegistrationNumber: '59588111000103',
      AuthorisationServers: [
        {
          AuthorisationServerId: 'as-0-meliuz',
          CustomerFriendlyName: 'Méliuz',
          CustomerFriendlyLogoUri: 'https://logos.example/meliuz.svg',
        },
        {
          AuthorisationServerId: 'as-1-bv',
          CustomerFriendlyName: 'banco BV',
          CustomerFriendlyLogoUri: 'https://logos.example/bv.svg',
        },
        {
          AuthorisationServerId: 'as-2-bv-corp',
          CustomerFriendlyName: 'banco BV - Corporate',
          CustomerFriendlyLogoUri: 'https://logos.example/bv.svg',
        },
      ],
    });
    const { entries } = buildMatches({
      participants: [
        participant({
          ispb: '59588111',
          compe: '655',
          compe4: '0655',
          shortName: 'BCO VOTORANTIM S.A.',
          fullName: 'Banco Votorantim S.A.',
        }),
      ],
      directory: [bv],
      config: config(),
      overrides: new Map(),
    });
    expect(entries[0]?.uri).toBe('https://logos.example/bv.svg');
  });
});
