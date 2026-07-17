import { describe, expect, it } from 'vitest';
import {
  allInstitutions,
  banks,
  byCompe,
  byIspb,
  findBank,
  logoCdnUrl,
  normalizeCompe,
  normalizeIspb,
  pixInstitutions,
  version,
} from '../src/index';

describe('datasets', () => {
  it('main list = only COMPE institutions; Pix-only live in a separate dataset', () => {
    expect(banks().length).toBeGreaterThan(400);
    expect(banks().length).toBeLessThan(600);
    expect(banks().every((bank) => bank.compe4 !== null)).toBe(true);
    expect(pixInstitutions().length).toBeGreaterThan(400);
    expect(pixInstitutions().every((i) => i.compe4 === null && i.cnpj.length === 14)).toBe(true);
    expect(allInstitutions().length).toBe(banks().length + pixInstitutions().length);
  });

  it('Pix-only institutions are addressable by ISPB', () => {
    const sample = pixInstitutions().find((i) => i.logo);
    expect(sample).toBeDefined();
    expect(byIspb(sample?.ispb ?? '')).toBe(sample);
  });

  it('brand affiliates share ONE asset per system, marked source.type brand', () => {
    const brandLogos = allInstitutions().filter((i) => i.logo?.source.type === 'brand');
    expect(brandLogos.length).toBeGreaterThan(200);
    const sicoob = brandLogos.filter((i) => i.logo?.source.brand === 'SICOOB');
    expect(sicoob.length).toBeGreaterThan(50);
    const paths = new Set(sicoob.map((i) => i.logo?.png));
    expect(paths.size).toBe(1); // um único arquivo compartilhado
  });

  it('carries pix participation info for big Pix participants', () => {
    const itau = byCompe(341);
    expect(itau?.pix?.pixParticipationType).toBe('Obrigatória');
    expect(itau?.pix?.authorizedByBcb).toBe(true);
  });
});

describe('lookups', () => {
  it('normalizes codes', () => {
    expect(normalizeCompe(1)).toBe('0001');
    expect(normalizeCompe('341')).toBe('0341');
    expect(normalizeIspb('208')).toBe('00000208');
  });

  it('finds Itaú by any COMPE spelling and by ISPB', () => {
    const byNumber = byCompe(341);
    const byString = byCompe('341');
    const byPadded = byCompe('0341');
    expect(byNumber).toBeDefined();
    expect(byNumber).toBe(byString);
    expect(byNumber).toBe(byPadded);
    expect(byNumber?.ispb).toBe('60701190');
    expect(byIspb('60701190')).toBe(byNumber);
  });

  it('findBank treats >4 digits as ISPB and the rest as COMPE', () => {
    expect(findBank('60701190')?.compe4).toBe('0341');
    expect(findBank(341)?.ispb).toBe('60701190');
    expect(findBank('99999999')).toBeUndefined();
  });

  it('byCompe never returns Pix-only institutions', () => {
    const pixOnly = pixInstitutions()[0];
    expect(pixOnly).toBeDefined();
    // ISPB de só-Pix nunca colide com um COMPE de 4 dígitos
    expect(byCompe(pixOnly?.ispb.slice(4) ?? '')).not.toBe(pixOnly);
  });

  it('Banco do Brasil has the all-zeros ISPB', () => {
    expect(byCompe(1)?.ispb).toBe('00000000');
  });
});

describe('logoCdnUrl', () => {
  it('builds a version-pinned jsDelivr URL keyed by ISPB', () => {
    const url = logoCdnUrl('341');
    expect(url).toBe(
      `https://cdn.jsdelivr.net/npm/logos-bancos-br@${version}/logos/png/60701190.png`,
    );
  });

  it('supports svg and custom version pinning', () => {
    const url = logoCdnUrl('0260', { format: 'svg', version: '1.2.3' });
    expect(url).toBe('https://cdn.jsdelivr.net/npm/logos-bancos-br@1.2.3/logos/svg/18236120.svg');
  });

  it('returns null for unknown banks and for banks without logo', () => {
    expect(logoCdnUrl('9999')).toBeNull();
    const withoutLogo = banks().find((bank) => !bank.logo);
    expect(withoutLogo).toBeDefined();
    expect(logoCdnUrl(withoutLogo?.compe4 ?? '')).toBeNull();
  });
});
