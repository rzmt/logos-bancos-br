import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildLogoUrls } from '../pipeline/dataset';
import type { Dataset, PixDataset } from '../pipeline/types';

const ROOT = join(__dirname, '..');
const CDN = 'https://cdn.jsdelivr.net/npm/logos-bancos-br@0';

function load(file: string) {
  return JSON.parse(readFileSync(join(ROOT, file), 'utf8'));
}

function logo(png: string, svg: string | null) {
  return {
    png,
    svg,
    source: {
      type: 'openfinance' as const,
      org: null,
      cnpj: null,
      uri: 'https://x/logo',
      sha256: 'abc',
      updatedAt: '2026-01-01',
    },
  };
}

describe('buildLogoUrls', () => {
  it('resolve SVG quando existe, senão PNG; ignora quem não tem logo', () => {
    const dataset: Dataset = {
      banks: [
        {
          ispb: '00000000',
          compe: '1',
          compe4: '0001',
          name: 'Com SVG',
          shortName: 'SVG',
          pix: null,
          logo: logo('logos/png/00000000.png', 'logos/svg/00000000.svg'),
        },
        {
          ispb: '99999999',
          compe: '999',
          compe4: '0999',
          name: 'Só PNG',
          shortName: 'PNG',
          pix: null,
          logo: logo('logos/png/99999999.png', null),
        },
        {
          ispb: '11111111',
          compe: '111',
          compe4: '0111',
          name: 'Sem logo',
          shortName: 'NADA',
          pix: null,
          logo: null,
        },
      ],
    };
    const pixDataset: PixDataset = { institutions: [] };

    const raw = buildLogoUrls(dataset, pixDataset);
    expect(raw.endsWith('\n')).toBe(true);
    expect(raw.trim().includes('\n')).toBe(false); // minificado

    const urls = JSON.parse(raw);
    expect(urls['00000000']).toBe(`${CDN}/logos/svg/00000000.svg`);
    expect(urls['99999999']).toBe(`${CDN}/logos/png/99999999.png`);
    expect(urls['11111111']).toBeUndefined(); // sem logo não entra
    expect(buildLogoUrls(dataset, pixDataset)).toBe(raw); // determinístico
  });

  it('usa o caminho REAL do asset, não o ISPB (afiliada de marca compartilha arquivo)', () => {
    // Afiliada Sicredi (ISPB próprio) cujo logo aponta para o asset do sistema.
    const dataset: Dataset = {
      banks: [
        {
          ispb: '01234567',
          compe: '748',
          compe4: '0748',
          name: 'Cooperativa Afiliada',
          shortName: 'COOP',
          pix: null,
          logo: logo('logos/png/03795072.png', 'logos/svg/03795072.svg'),
        },
      ],
    };
    const urls = JSON.parse(buildLogoUrls(dataset, { institutions: [] }));
    // chave = ISPB da instituição; URL = asset compartilhado (outro ISPB)
    expect(urls['01234567']).toBe(`${CDN}/logos/svg/03795072.svg`);
  });
});

describe('data/logo-urls.min.json (arquivo distribuído)', () => {
  it('cobre exatamente as instituições com logo e casa com o cdn-index', () => {
    const urls = load('data/logo-urls.min.json');
    const index = load('data/cdn-index.min.json').institutions;

    const comLogo = Object.entries(index).filter(
      ([, v]) => (v as [unknown, unknown, number])[2] > 0,
    );
    expect(Object.keys(urls)).toHaveLength(comLogo.length);

    for (const [ispb, meta] of comLogo) {
      const flags = (meta as [unknown, unknown, number])[2];
      const url = urls[ispb];
      expect(url, `ISPB ${ispb} sem URL`).toBeDefined();
      expect(url.startsWith(`${CDN}/logos/`)).toBe(true);
      // flag 3 = tem svg → URL deve ser svg; flag 1 = só png → URL png
      expect(url.endsWith(flags === 3 ? '.svg' : '.png')).toBe(true);
    }
  });
});
