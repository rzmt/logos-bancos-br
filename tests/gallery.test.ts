import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildGalleryHtml } from '../pipeline/gallery';
import type { Dataset, PixDataset } from '../pipeline/types';

const ROOT = join(__dirname, '..');

function extractRows(
  html: string,
): [string, string | null, string, string | null, number, string, string][] {
  const match = html.match(/<script id="data" type="application\/json">(.*?)<\/script>/s);
  expect(match, 'bloco de dados ausente').toBeTruthy();
  return JSON.parse((match as RegExpMatchArray)[1] as string);
}

describe('buildGalleryHtml', () => {
  const dataset: Dataset = {
    banks: [
      {
        ispb: '00000000',
        compe: '1',
        compe4: '0001',
        name: 'Banco <script> & Cia',
        shortName: 'BCO',
        pix: null,
        logo: {
          png: 'logos/png/00000000.png',
          svg: 'logos/svg/00000000.svg',
          source: {
            type: 'openfinance',
            org: null,
            cnpj: null,
            uri: 'https://x/logo.svg',
            sha256: 'abc',
            updatedAt: '2026-01-01',
          },
        },
      },
    ],
  };
  const pixDataset: PixDataset = {
    institutions: [
      {
        ispb: '10348181',
        compe: null,
        compe4: null,
        cnpj: '10348181000100',
        name: 'Afiliada Sicredi',
        shortName: 'AFILIADA',
        pix: {
          spiParticipationType: 'Direta',
          pixParticipationType: 'Facultativa',
          modality: 'Provedor de Conta Transacional',
          institutionType: 'Cooperativa',
          authorizedByBcb: true,
        },
        logo: {
          png: 'logos/png/03795072.png',
          svg: null,
          source: {
            type: 'brand',
            org: null,
            cnpj: null,
            uri: 'https://x/logo.svg',
            sha256: 'abc',
            updatedAt: '2026-01-01',
            brand: 'SICREDI',
          },
        },
      },
    ],
  };

  it('é determinística, embute os dados e escapa "<" no JSON', () => {
    const html = buildGalleryHtml(dataset, pixDataset);
    expect(buildGalleryHtml(dataset, pixDataset)).toBe(html); // sem timestamps
    // nomes com "<" não podem quebrar o bloco <script> de dados
    expect(html).not.toContain('Banco <script>');
    const rows = extractRows(html);
    expect(rows).toHaveLength(2);
    const banco = rows.find((r) => r[0] === '00000000');
    expect(banco?.[2]).toBe('Banco <script> & Cia'); // conteúdo preservado após parse
    expect(banco?.[4]).toBe(1); // tem svg
    expect(banco?.[5]).toBe(''); // logo próprio: não agrupa
  });

  it('marca a afiliada com o sistema e o asset compartilhado, não o próprio ispb', () => {
    const rows = extractRows(buildGalleryHtml(dataset, pixDataset));
    const afiliada = rows.find((r) => r[0] === '10348181');
    expect(afiliada?.[3]).toBe('03795072'); // ispb do arquivo, não da instituição
    expect(afiliada?.[4]).toBe(0); // só png
    expect(afiliada?.[5]).toBe('SICREDI'); // agrupada no card do sistema
  });
});

describe('docs/index.html (arquivo distribuído)', () => {
  it('é consistente com os datasets', () => {
    const html = readFileSync(join(ROOT, 'docs', 'index.html'), 'utf8');
    const rows = extractRows(html);
    const banks = JSON.parse(readFileSync(join(ROOT, 'data', 'bancos.json'), 'utf8')).banks;
    const pix = JSON.parse(
      readFileSync(join(ROOT, 'data', 'instituicoes-pix.json'), 'utf8'),
    ).institutions;
    expect(rows).toHaveLength(banks.length + pix.length);
    const all = [...banks, ...pix];
    const comLogo = all.filter((i) => i.logo).length;
    expect(rows.filter((r) => r[3]).length).toBe(comLogo);
    // afiliadas de marca (agrupadas na página) batem com o dataset
    const afiliadas = all.filter((i) => i.logo?.source.type === 'brand').length;
    expect(rows.filter((r) => r[5]).length).toBe(afiliadas);
    // apelidos populares entram na busca (nome oficial não contém o termo)
    expect(rows.find((r) => r[0] === '18236120')?.[6]).toBe('nubank');
  });
});
