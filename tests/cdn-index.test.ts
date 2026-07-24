import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCdnIndex } from '../pipeline/dataset';
import type { Dataset, PixDataset } from '../pipeline/types';

const ROOT = join(__dirname, '..');

function load(file: string) {
  return JSON.parse(readFileSync(join(ROOT, file), 'utf8'));
}

describe('buildCdnIndex', () => {
  it('emite [compe, nome, flags] por ISPB, minificado e determinístico', () => {
    const dataset: Dataset = {
      banks: [
        {
          ispb: '00000000',
          compe: '1',
          compe4: '0001',
          name: 'Banco do Brasil S.A.',
          shortName: 'BCO DO BRASIL S.A.',
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
          ispb: '11111111',
          compe: null,
          compe4: null,
          cnpj: '11111111000111',
          name: 'Fintech Sem Logo',
          shortName: 'FINTECH',
          pix: {
            spiParticipationType: 'Direta',
            pixParticipationType: 'Facultativa',
            modality: 'Provedor de Conta Transacional',
            institutionType: 'Instituição de Pagamento',
            authorizedByBcb: true,
          },
          logo: null,
        },
      ],
    };

    const raw = buildCdnIndex(dataset, pixDataset);
    expect(raw.endsWith('\n')).toBe(true);
    expect(raw.trim().includes('\n')).toBe(false); // minificado, linha única

    const index = JSON.parse(raw);
    expect(index.version).toBe(1);
    expect(index.logoPathTemplate).toBe('logos/{format}/{ispb}.{format}');
    expect(index.count).toBe(2);
    expect(index.institutions['00000000']).toEqual(['1', 'Banco do Brasil S.A.', 3]);
    expect(index.institutions['11111111']).toEqual([null, 'Fintech Sem Logo', 0]);

    // sem timestamps: duas execuções produzem bytes idênticos
    expect(buildCdnIndex(dataset, pixDataset)).toBe(raw);
  });
});

describe('data/cdn-index.min.json (arquivo distribuído)', () => {
  it('é consistente com bancos.json e instituicoes-pix.json', () => {
    const index = load('data/cdn-index.min.json');
    const banks = load('data/bancos.json').banks;
    const pix = load('data/instituicoes-pix.json').institutions;

    expect(index.count).toBe(banks.length + pix.length);
    expect(Object.keys(index.institutions)).toHaveLength(index.count);

    for (const inst of [...banks, ...pix]) {
      const entry = index.institutions[inst.ispb];
      expect(entry, `ISPB ${inst.ispb} ausente do índice`).toBeDefined();
      expect(entry[0]).toBe(inst.compe);
      expect(entry[1]).toBe(inst.name);
      const flags = inst.logo ? (inst.logo.svg ? 3 : 1) : 0;
      expect(entry[2], `flags de ${inst.ispb}`).toBe(flags);
    }
  });
});
