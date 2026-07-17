import { describe, expect, it } from 'vitest';
import { parseCsv } from '../pipeline/sources';

describe('parseCsv', () => {
  it('parses simple rows', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('handles quoted fields with commas', () => {
    expect(parseCsv('name,code\n"Banco A, B e C",123')).toEqual([
      ['name', 'code'],
      ['Banco A, B e C', '123'],
    ]);
  });

  it('handles escaped quotes inside quoted fields', () => {
    expect(parseCsv('"say ""hi""",x')).toEqual([['say "hi"', 'x']]);
  });

  it('handles CRLF line breaks and trailing newline', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('skips blank lines', () => {
    expect(parseCsv('a,b\n\n1,2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});
