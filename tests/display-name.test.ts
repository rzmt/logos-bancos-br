import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDatasets } from '../pipeline/dataset';
import type { Manifest, MatchEntry } from '../pipeline/types';

const ROOT = join(__dirname, '..');

function load(file: string) {
  return JSON.parse(readFileSync(join(ROOT, file), 'utf8'));
}

const ENTRY: MatchEntry = {
  ispb: '18236120',
  compe: '260',
  compe4: '0260',
  shortName: 'NU PAGAMENTOS',
  fullName: 'NU PAGAMENTOS S.A. - INSTITUIÇÃO DE PAGAMENTO',
  cnpj: null,
  pix: null,
  source: null,
  uri: null,
  orgName: null,
  orgCnpj: null,
};

describe('displayName', () => {
  it('aplica o nome curado e deixa null quem não foi curado', () => {
    const outro: MatchEntry = { ...ENTRY, ispb: '99999999', compe: '999', compe4: '0999' };
    const { dataset } = buildDatasets({
      entries: [ENTRY, outro],
      manifest: {} as Manifest,
      pngIspbs: new Set(),
      svgIspbs: new Set(),
      displayNames: { '18236120': 'Nubank' },
    });
    expect(dataset.banks.find((b) => b.ispb === '18236120')?.displayName).toBe('Nubank');
    expect(dataset.banks.find((b) => b.ispb === '99999999')?.displayName).toBeNull();
  });

  it('sem o mapa, ninguém ganha displayName (nunca deriva do nome oficial)', () => {
    const { dataset } = buildDatasets({
      entries: [ENTRY],
      manifest: {} as Manifest,
      pngIspbs: new Set(),
      svgIspbs: new Set(),
    });
    expect(dataset.banks[0]?.displayName).toBeNull();
  });
});

describe('dataset distribuído', () => {
  it('todo displayName do config aparece no dataset, e são não-vazios', () => {
    const curados = load('pipeline/config.json').displayNames as Record<string, string>;
    const todas = [
      ...load('data/bancos.json').banks,
      ...load('data/instituicoes-pix.json').institutions,
    ];
    const porIspb = new Map(todas.map((i) => [i.ispb, i]));
    for (const [ispb, nome] of Object.entries(curados)) {
      expect(nome.trim(), `displayName vazio em ${ispb}`).not.toBe('');
      const inst = porIspb.get(ispb);
      expect(inst, `ISPB curado ${ispb} não existe no dataset`).toBeDefined();
      expect(inst.displayName, `displayName não aplicado em ${ispb}`).toBe(nome);
    }
    // quem não foi curado fica null — nunca string vazia
    for (const i of todas) {
      expect(i.displayName === null || typeof i.displayName === 'string').toBe(true);
      if (i.displayName !== null) expect(i.displayName).not.toBe('');
    }
  });
});
