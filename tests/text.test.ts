import { describe, expect, it } from 'vitest';
import { jaccard, stripAccents, tokenize } from '../pipeline/text';

describe('stripAccents', () => {
  it('removes diacritics keeping base letters', () => {
    expect(stripAccents('Itaú Crédito Coração')).toBe('Itau Credito Coracao');
  });

  it('keeps plain ascii untouched', () => {
    expect(stripAccents('Banco XP S.A.')).toBe('Banco XP S.A.');
  });
});

describe('tokenize', () => {
  it('drops stopwords, punctuation and 1-char tokens', () => {
    expect(tokenize('BCO ITAÚ UNIBANCO S.A.')).toEqual(new Set(['itau', 'unibanco']));
  });

  it('returns an empty set for names made only of generic terms', () => {
    expect(tokenize('Banco do Brasil S.A.')).toEqual(new Set());
  });

  it('handles empty input', () => {
    expect(tokenize('')).toEqual(new Set());
  });
});

describe('jaccard', () => {
  it('is 1 for identical sets', () => {
    expect(jaccard(new Set(['nubank']), new Set(['nubank']))).toBe(1);
  });

  it('is 0 for disjoint sets', () => {
    expect(jaccard(new Set(['inter']), new Set(['bradesco']))).toBe(0);
  });

  it('is 0 when either set is empty', () => {
    expect(jaccard(new Set(), new Set(['x']))).toBe(0);
  });

  it('computes partial overlap', () => {
    const a = new Set(['itau', 'unibanco']);
    const b = new Set(['itau', 'consignado']);
    expect(jaccard(a, b)).toBeCloseTo(1 / 3);
  });
});
