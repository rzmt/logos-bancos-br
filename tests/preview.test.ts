import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildLogoIndexMarkdown, buildPreviewMarkdown, displayLabel } from '../pipeline/preview';
import type { Bank, BankLogo, Dataset, PixDataset, PixInstitution } from '../pipeline/types';

const ROOT = join(__dirname, '..');

function logo(ispb: string, extra: Partial<BankLogo['source']> = {}, svg = true): BankLogo {
  return {
    png: `logos/png/${ispb}.png`,
    svg: svg ? `logos/svg/${ispb}.svg` : null,
    source: {
      type: 'openfinance',
      org: null,
      cnpj: null,
      uri: 'https://x/logo.svg',
      sha256: 'abc',
      updatedAt: '2026-01-01',
      ...extra,
    },
  };
}

function bank(ispb: string, compe: string, shortName: string, rest: Partial<Bank> = {}): Bank {
  return {
    ispb,
    compe,
    compe4: compe.padStart(4, '0'),
    name: `${shortName} S.A.`,
    shortName,
    displayName: null,
    pix: null,
    logo: logo(ispb),
    ...rest,
  };
}

function afiliada(ispb: string, brand: string, assetIspb: string): PixInstitution {
  return {
    ispb,
    compe: null,
    compe4: null,
    cnpj: `${ispb}000100`,
    name: `COOPERATIVA ${ispb}`,
    shortName: `COOP ${ispb}`,
    displayName: null,
    pix: {
      spiParticipationType: 'Indireta',
      pixParticipationType: 'Facultativa',
      modality: 'Provedor de Conta Transacional',
      institutionType: 'Cooperativa',
      authorizedByBcb: true,
    },
    logo: { ...logo(assetIspb, { type: 'brand', brand }), svg: null },
  };
}

const dataset: Dataset = {
  banks: [
    bank('18236120', '260', 'NU PAGAMENTOS - IP', { displayName: 'Nubank' }),
    bank('33657248', '7', 'BNDES', { displayName: 'BNDES' }),
    bank('74014747', '565', 'ÁGORA CTVM S.A.', {
      displayName: 'Ágora',
      logo: logo('74014747', {}, false),
    }),
    bank('11111111', '999', 'BCO SEM LOGO', { logo: null }),
    bank('22222222', '998', 'BCO A | B'),
  ],
};

const pixDataset: PixDataset = {
  institutions: [
    afiliada('10348181', 'SICREDI', '03795072'),
    afiliada('10348182', 'SICREDI', '03795072'),
    afiliada('20000000', 'AILOS', '05463212'),
  ],
};

describe('displayLabel', () => {
  it('junta o nome popular e o nome curto oficial', () => {
    expect(displayLabel(dataset.banks[0] as Bank)).toBe('Nubank (NU PAGAMENTOS - IP)');
  });

  it('não repete o nome quando o popular é o oficial (sem contar caixa e acento)', () => {
    expect(displayLabel(dataset.banks[1] as Bank)).toBe('BNDES');
    expect(displayLabel(dataset.banks[2] as Bank)).toBe('Ágora (ÁGORA CTVM S.A.)');
    const igual = bank('1', '1', 'BANCO ÁGIL', { displayName: 'Banco Agil' });
    expect(displayLabel(igual)).toBe('Banco Agil');
  });

  it('sem nome curado, fica o nome curto oficial', () => {
    expect(displayLabel(dataset.banks[4] as Bank)).toBe('BCO A | B');
  });
});

describe('buildLogoIndexMarkdown', () => {
  const md = buildLogoIndexMarkdown(dataset, pixDataset);
  const linhas = md.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| Instituição'));

  it('lista os arquivos em ordem alfabética do nome, ignorando acento', () => {
    expect(linhas.map((l) => l.split(' | ')[0])).toEqual([
      '| Ágora (ÁGORA CTVM S.A.)',
      '| Ailos (sistema cooperativo)',
      '| BCO A \\| B',
      '| BNDES',
      '| Nubank (NU PAGAMENTOS - IP)',
      '| Sicredi (sistema cooperativo)',
    ]);
  });

  it('aponta para os arquivos reais, com svg só quando existe', () => {
    expect(md).toContain(
      '| Nubank (NU PAGAMENTOS - IP) | 0260 | 18236120 | [png](png/18236120.png) · [svg](svg/18236120.svg) |',
    );
    expect(md).toContain('| Ágora (ÁGORA CTVM S.A.) | 0565 | 74014747 | [png](png/74014747.png) |');
  });

  it('afiliadas de um sistema viram uma linha só, com o arquivo do sistema', () => {
    expect(md).toContain('| Sicredi (sistema cooperativo) |  |  | [png](png/03795072.png) |');
    expect(md).not.toContain('10348181');
    expect(md).toContain('As cooperativas de Ailos e Sicredi usam o logo do sistema');
  });

  it('deixa de fora quem não tem logo', () => {
    expect(md).not.toContain('BCO SEM LOGO');
  });

  it('não tem travessão nem meia-risca', () => {
    expect(md).not.toMatch(/[—–]/);
  });
});

describe('buildPreviewMarkdown', () => {
  it('mostra o nome popular no rótulo e no alt da imagem', () => {
    const md = buildPreviewMarkdown(dataset, pixDataset);
    expect(md).toContain(
      '| <img src="logos/png/18236120.png" width="40" alt="Nubank"> | 0260 | 18236120 | Nubank (NU PAGAMENTOS - IP) |',
    );
  });
});

describe('arquivos distribuídos', () => {
  // Mudou pipeline/preview.ts? Regenere os dois arquivos com:
  // npx tsx -e "import{readFileSync as r,writeFileSync as w}from'node:fs';import{buildLogoIndexMarkdown as i,buildPreviewMarkdown as p}from'./pipeline/preview';const j=(f)=>JSON.parse(r(f,'utf8'));const b=j('data/bancos.json'),x=j('data/instituicoes-pix.json');w('PREVIEW.md',p(b,x));w('logos/README.md',i(b,x))"
  const ler = (p: string) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
  const bancos = ler('data/bancos.json');
  const pix = ler('data/instituicoes-pix.json');

  it('PREVIEW.md é exatamente o que buildPreviewMarkdown gera a partir dos datasets', () => {
    expect(readFileSync(join(ROOT, 'PREVIEW.md'), 'utf8')).toBe(buildPreviewMarkdown(bancos, pix));
  });

  it('logos/README.md é exatamente o que buildLogoIndexMarkdown gera a partir dos datasets', () => {
    expect(readFileSync(join(ROOT, 'logos', 'README.md'), 'utf8')).toBe(
      buildLogoIndexMarkdown(bancos, pix),
    );
  });

  it('logos/README.md cita todo arquivo de logo usado pelo dataset', () => {
    const indice = readFileSync(join(ROOT, 'logos', 'README.md'), 'utf8');
    const todas = [...bancos.banks, ...pix.institutions];
    for (const inst of todas) {
      if (!inst.logo) continue;
      expect(indice, inst.ispb).toContain(`(${inst.logo.png.replace(/^logos\//, '')})`);
    }
  });
});
