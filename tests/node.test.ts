import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { copyLogos, logoPngPath, logoSvgPath } from '../src/node';

describe('logo paths', () => {
  it('resolves absolute paths of shipped assets', () => {
    const png = logoPngPath('341');
    expect(png).toBeTruthy();
    expect(existsSync(png as string)).toBe(true);
    const svg = logoSvgPath('60701190');
    expect(svg).toBeTruthy();
    expect(existsSync(svg as string)).toBe(true);
  });

  it('returns null when there is no logo', () => {
    expect(logoPngPath('9999')).toBeNull();
  });
});

describe('copyLogos', () => {
  const dir = mkdtempSync(join(tmpdir(), 'logos-bancos-br-copy-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('copies a subset named by COMPE (default)', () => {
    const dest = join(dir, 'by-compe');
    const result = copyLogos({ dest, only: ['341', 1, '60746948'] });
    const files = readdirSync(dest).sort();
    expect(files).toEqual(['0001.png', '0237.png', '0341.png']);
    expect(result.copied).toHaveLength(3);
  });

  it('copies named by ISPB with both formats', () => {
    const dest = join(dir, 'by-ispb');
    copyLogos({ dest, by: 'ispb', format: 'both', only: ['0341'] });
    expect(readdirSync(dest).sort()).toEqual(['60701190.png', '60701190.svg']);
  });

  it('copies everything when no filter is given', () => {
    const dest = join(dir, 'all');
    const result = copyLogos({ dest });
    expect(result.copied.length).toBeGreaterThan(90);
  });
});
