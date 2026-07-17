import { describe, expect, it } from 'vitest';
import {
  banks,
  byCompe,
  byIspb,
  findBank,
  logoCdnUrl,
  normalizeCompe,
  normalizeIspb,
  version,
} from '../src/index';

describe('dataset', () => {
  it('ships the full STR backbone', () => {
    expect(banks().length).toBeGreaterThan(400);
    expect(banks().filter((bank) => bank.logo).length).toBeGreaterThan(90);
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
