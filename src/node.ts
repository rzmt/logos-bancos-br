/**
 * Node-only helpers: absolute filesystem paths of the shipped assets and the
 * copy routine used by the CLI to vendor logos into any project (any stack).
 */

import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Bank, banks, findBank, normalizeCompe, normalizeIspb } from './index';

function packagePath(relative: string): string {
  // dist/node.{js,cjs} lives one level below the package root.
  return fileURLToPath(new URL(`../${relative}`, import.meta.url));
}

/** Absolute path of the bank's normalized PNG, or null when it has no logo. */
export function logoPngPath(code: string | number | Bank): string | null {
  const bank = findBank(code);
  return bank?.logo ? packagePath(bank.logo.png) : null;
}

/** Absolute path of the bank's original SVG, or null when unavailable. */
export function logoSvgPath(code: string | number | Bank): string | null {
  const bank = findBank(code);
  return bank?.logo?.svg ? packagePath(bank.logo.svg) : null;
}

export interface CopyLogosOptions {
  /** Destination directory (created if missing). */
  dest: string;
  /** Which assets to copy. Defaults to `png`. */
  format?: 'png' | 'svg' | 'both';
  /** File naming: 4-digit COMPE (default) or 8-digit ISPB. */
  by?: 'compe' | 'ispb';
  /** Restrict to these COMPE/ISPB codes (any format). Copies all when omitted. */
  only?: Array<string | number>;
}

export interface CopyLogosResult {
  copied: string[];
  skippedNoSvg: string[];
  /** ISPBs skipped in `by: "compe"` mode because the institution has no COMPE. */
  skippedNoCompe: string[];
}

/** Copies shipped logos into a project directory, named by COMPE or ISPB. */
export function copyLogos({
  dest,
  format = 'png',
  by = 'compe',
  only,
}: CopyLogosOptions): CopyLogosResult {
  const filter = only
    ? new Set(
        only.map((code) => {
          const digits = String(code).replace(/\D/g, '');
          return digits.length > 4 ? normalizeIspb(digits) : normalizeCompe(digits);
        }),
      )
    : null;

  mkdirSync(dest, { recursive: true });
  const copied: string[] = [];
  const skippedNoSvg: string[] = [];
  const skippedNoCompe: string[] = [];

  for (const bank of banks()) {
    if (!bank.logo) continue;
    if (filter && !(bank.compe4 !== null && filter.has(bank.compe4)) && !filter.has(bank.ispb)) {
      continue;
    }
    if (by === 'compe' && !bank.compe4) {
      skippedNoCompe.push(bank.ispb);
      continue;
    }
    const baseName = by === 'ispb' ? bank.ispb : (bank.compe4 as string);

    if (format === 'png' || format === 'both') {
      const source = packagePath(bank.logo.png);
      if (existsSync(source)) {
        const target = join(dest, `${baseName}.png`);
        copyFileSync(source, target);
        copied.push(target);
      }
    }
    if (format === 'svg' || format === 'both') {
      if (bank.logo.svg) {
        const source = packagePath(bank.logo.svg);
        if (existsSync(source)) {
          const target = join(dest, `${baseName}.svg`);
          copyFileSync(source, target);
          copied.push(target);
        }
      } else {
        skippedNoSvg.push(bank.compe4 ?? bank.ispb);
      }
    }
  }

  return { copied, skippedNoSvg, skippedNoCompe };
}
