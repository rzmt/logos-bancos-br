import { describe, expect, it } from 'vitest';
import {
  csvCell,
  DAILY_HEADER,
  mergeDaily,
  PATHS_HEADER,
  replaceSnapshot,
} from '../pipeline/metricas';

const dia = (date: string, count: number, uniques: number) => ({
  timestamp: `${date}T00:00:00Z`,
  count,
  uniques,
});

describe('mergeDaily', () => {
  it('cria o CSV com visitas e clones do mesmo dia na mesma linha', () => {
    const csv = mergeDaily(
      '',
      [dia('2026-10-20', 7, 4), dia('2026-10-19', 5, 3)],
      [dia('2026-10-19', 31, 16)],
    );
    expect(csv).toBe(`${DAILY_HEADER}\n2026-10-19,5,3,31,16\n2026-10-20,7,4,0,0\n`);
  });

  it('dia visto em duas coletas fica com o maior número', () => {
    const antes = `${DAILY_HEADER}\n2026-10-19,5,3,31,16\n2026-10-20,7,4,0,0\n`;
    const csv = mergeDaily(
      antes,
      [dia('2026-10-20', 2, 1), dia('2026-10-21', 9, 6)],
      [dia('2026-10-20', 3, 2)],
    );
    expect(csv).toBe(
      `${DAILY_HEADER}\n2026-10-19,5,3,31,16\n2026-10-20,7,4,3,2\n2026-10-21,9,6,0,0\n`,
    );
  });
});

describe('replaceSnapshot', () => {
  it('acrescenta a coleta nova e mantém as anteriores', () => {
    const antes = `${PATHS_HEADER}\n2026-10-26,/rzmt/logos-bancos-br,40,30\n`;
    const csv = replaceSnapshot(antes, PATHS_HEADER, '2026-11-02', [
      ['/rzmt/logos-bancos-br', 77, 58],
    ]);
    expect(csv).toBe(
      `${PATHS_HEADER}\n2026-10-26,/rzmt/logos-bancos-br,40,30\n2026-11-02,/rzmt/logos-bancos-br,77,58\n`,
    );
  });

  it('rodar de novo no mesmo dia troca as linhas em vez de duplicar', () => {
    const antes = `${PATHS_HEADER}\n2026-11-02,/a,1,1\n2026-11-02,/b,2,2\n`;
    const csv = replaceSnapshot(antes, PATHS_HEADER, '2026-11-02', [['/a', 3, 3]]);
    expect(csv).toBe(`${PATHS_HEADER}\n2026-11-02,/a,3,3\n`);
  });

  it('põe aspas em campo com vírgula ou aspas', () => {
    expect(csvCell('/busca?q=a,b')).toBe('"/busca?q=a,b"');
    expect(csvCell('diz "oi"')).toBe('"diz ""oi"""');
    expect(csvCell(42)).toBe('42');
  });
});
