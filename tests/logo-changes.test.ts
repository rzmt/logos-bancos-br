import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  BRAND_GAIN_LIMIT,
  changesRequiringReview,
  findLogoChanges,
  type InstitutionLogoView,
  institutionsOf,
  type LogoRef,
  renderLogoChanges,
} from '../pipeline/logo-changes';

// Assets compartilhados por marca (afiliadas de sistemas cooperativos) e um próprio.
const SICOOB: LogoRef = {
  png: 'logos/png/04891850.png',
  svg: 'logos/svg/04891850.svg',
  source: { type: 'brand', brand: 'SICOOB' },
};
const SICREDI: LogoRef = {
  png: 'logos/png/03795072.png',
  svg: 'logos/svg/03795072.svg',
  source: { type: 'brand', brand: 'SICREDI' },
};
const PROPRIO: LogoRef = {
  png: 'logos/png/60701190.png',
  svg: null,
  source: { type: 'openfinance' },
};

function inst(ispb: string, logo: LogoRef | null, name = `Instituição ${ispb}`) {
  return { ispb, name, displayName: null, logo } satisfies InstitutionLogoView;
}

const kinds = (changes: ReturnType<typeof findLogoChanges>) =>
  changes.map(({ kind, ispb }) => [kind, ispb]);

describe('findLogoChanges', () => {
  it('detecta perdeu, ganhou e trocou entre arquivos que já existiam', () => {
    const before = [
      inst('11111111', SICOOB),
      inst('22222222', null),
      inst('33333333', SICOOB),
      inst('44444444', SICREDI),
    ];
    const after = [
      inst('11111111', null),
      inst('22222222', SICOOB),
      inst('33333333', SICREDI),
      inst('44444444', SICREDI),
    ];
    const changes = findLogoChanges(before, after);
    expect(kinds(changes)).toEqual([
      ['trocou', '33333333'],
      ['ganhou', '22222222'],
      ['perdeu', '11111111'],
    ]);
    expect(changes[0]).toMatchObject({ before: SICOOB, after: SICREDI });
    expect(changes[2]).toMatchObject({ before: SICOOB, after: null });
  });

  it('svg que aparece ou some no mesmo png também é troca', () => {
    const comSvg = { ...PROPRIO, svg: 'logos/svg/60701190.svg' };
    expect(kinds(findLogoChanges([inst('60701190', PROPRIO)], [inst('60701190', comSvg)]))).toEqual(
      [['trocou', '60701190']],
    );
    expect(kinds(findLogoChanges([inst('60701190', comSvg)], [inst('60701190', PROPRIO)]))).toEqual(
      [['trocou', '60701190']],
    );
  });

  it('mesmos caminhos não é mudança, mesmo com proveniência diferente', () => {
    // Bytes novos no mesmo arquivo aparecem em logos/ — o workflow já pega.
    const outraFonte = { ...SICOOB, source: { type: 'brand', brand: 'SICOOB-NOVO' } };
    expect(findLogoChanges([inst('11111111', SICOOB)], [inst('11111111', outraFonte)])).toEqual([]);
    expect(findLogoChanges([inst('22222222', null)], [inst('22222222', null)])).toEqual([]);
  });

  it('ISPB novo só aparece quando chega com o logo da marca (entrou)', () => {
    // Saída e entrada sem logo são churn; entrada com arquivo próprio aparece em logos/.
    const before = [inst('11111111', SICOOB), inst('99999999', SICREDI)];
    const after = [
      inst('11111111', SICOOB),
      inst('55555555', SICOOB),
      inst('66666666', null),
      inst('77777777', PROPRIO),
    ];
    const changes = findLogoChanges(before, after);
    expect(kinds(changes)).toEqual([['entrou', '55555555']]);
    expect(changes[0]).toMatchObject({ before: null, after: SICOOB });
  });

  it('marca inteira perdendo o logo vira uma linha por afiliada', () => {
    const ispbs = Array.from({ length: 141 }, (_, i) => String(10000000 + i));
    const changes = findLogoChanges(
      ispbs.map((ispb) => inst(ispb, SICOOB)),
      ispbs.map((ispb) => inst(ispb, null)),
    );
    expect(changes).toHaveLength(141);
    expect(new Set(changes.map((c) => c.kind))).toEqual(new Set(['perdeu']));
    expect(changesRequiringReview(changes)).toHaveLength(141);
  });

  it('usa o displayName curado quando houver', () => {
    const before = [{ ...inst('18236120', null), displayName: 'Nubank' }];
    const after = [{ ...inst('18236120', PROPRIO), displayName: 'Nubank' }];
    expect(findLogoChanges(before, after)[0]?.name).toBe('Nubank');
  });

  it('falha com ISPB repetido em vez de escolher um', () => {
    expect(() =>
      findLogoChanges(
        [inst('11111111', SICOOB)],
        [inst('11111111', SICOOB), inst('11111111', null)],
      ),
    ).toThrow(/repetido/);
  });
});

describe('changesRequiringReview', () => {
  const ganhosDeMarca = (n: number) => {
    const ispbs = Array.from({ length: n }, (_, i) => String(30000000 + i));
    return findLogoChanges(
      ispbs.map((ispb) => inst(ispb, null)),
      ispbs.map((ispb) => inst(ispb, SICOOB)),
    );
  };

  it(`até ${BRAND_GAIN_LIMIT} ganhos pela regra de marca não exigem revisão`, () => {
    // Caso comum: o BCB renomeia uma cooperativa com o nome do sistema.
    expect(changesRequiringReview(ganhosDeMarca(BRAND_GAIN_LIMIT))).toEqual([]);
  });

  it('acima do limite, todos os ganhos pela regra de marca exigem revisão', () => {
    const changes = ganhosDeMarca(BRAND_GAIN_LIMIT + 1);
    expect(changesRequiringReview(changes)).toHaveLength(BRAND_GAIN_LIMIT + 1);
  });

  it('instituição que entra com o logo da marca conta para o mesmo limite', () => {
    const existentes = ganhosDeMarca(BRAND_GAIN_LIMIT);
    expect(changesRequiringReview(existentes)).toEqual([]);
    const comEntrada = [
      ...existentes,
      ...findLogoChanges([], [inst('40000000', SICREDI)]), // entrou
    ];
    expect(changesRequiringReview(comEntrada)).toHaveLength(BRAND_GAIN_LIMIT + 1);
  });

  it('perda, troca e ganho fora da regra de marca sempre exigem revisão', () => {
    const changes = findLogoChanges(
      [inst('11111111', SICOOB), inst('22222222', SICOOB), inst('33333333', null)],
      [inst('11111111', null), inst('22222222', SICREDI), inst('33333333', PROPRIO)],
    );
    expect(kinds(changesRequiringReview(changes))).toEqual([
      ['trocou', '22222222'],
      ['ganhou', '33333333'],
      ['perdeu', '11111111'],
    ]);
  });
});

describe('institutionsOf', () => {
  const bank = (ispb: string, logo: LogoRef | null) => ({ ...inst(ispb, logo), compe: '1' });
  const pix = (ispb: string, logo: LogoRef | null) => ({ ...inst(ispb, logo), compe: null });

  it('ISPB que muda de dataset (só-Pix -> principal) compara normalmente', () => {
    const before = institutionsOf({ banks: [] }, { institutions: [pix('12345678', SICOOB)] });
    const igual = institutionsOf({ banks: [bank('12345678', SICOOB)] }, { institutions: [] });
    const trocado = institutionsOf({ banks: [bank('12345678', SICREDI)] }, { institutions: [] });
    expect(findLogoChanges(before, igual)).toEqual([]);
    expect(findLogoChanges(before, trocado).map((c) => c.kind)).toEqual(['trocou']);
  });

  it('une banks e institutions guardando só o que importa', () => {
    const all = institutionsOf(
      { banks: [bank('00000000', PROPRIO)] },
      { institutions: [pix('25387655', SICOOB)] },
    );
    expect(all).toEqual([
      { ispb: '00000000', name: 'Instituição 00000000', displayName: null, logo: PROPRIO },
      { ispb: '25387655', name: 'Instituição 25387655', displayName: null, logo: SICOOB },
    ]);
  });

  it.each([
    ['lista ausente', {}, { institutions: [] }, /campo "banks"/],
    ['JSON que não é objeto', null, { institutions: [] }, /campo "banks"/],
    ['ISPB inválido', { banks: [{ ...inst('123', null) }] }, { institutions: [] }, /ISPB inválido/],
    ['logo ausente', { banks: [{ ispb: '12345678', name: 'X' }] }, { institutions: [] }, /logo/],
    [
      'svg ausente',
      { banks: [{ ...inst('12345678', null), logo: { png: 'logos/png/12345678.png' } }] },
      { institutions: [] },
      /png\/svg/,
    ],
    [
      'source.type ausente',
      { banks: [{ ...inst('12345678', null), logo: { png: 'a.png', svg: null, source: {} } }] },
      { institutions: [] },
      /source\.type/,
    ],
  ])('falha (fail closed) com %s', (_, banks, pixJson, mensagem) => {
    expect(() => institutionsOf(banks, pixJson)).toThrow(mensagem);
  });
});

describe('renderLogoChanges', () => {
  it('nada a dizer sem mudanças', () => {
    expect(renderLogoChanges([])).toBe('');
  });

  it('mostra ISPB, nome e antes -> depois, com o veredito', () => {
    const md = renderLogoChanges(
      findLogoChanges(
        [inst('33333333', SICOOB, 'CC SICOOB | TESTE'), inst('11111111', PROPRIO)],
        [inst('33333333', SICREDI, 'CC SICOOB | TESTE'), inst('11111111', null)],
      ),
    );
    expect(md).toContain('### ⚠️ Logo diferente em instituições (2)');
    expect(md).toContain('trocou: 1 · perdeu: 1: 2 exige(m) revisão humana.');
    expect(md).toContain(
      '| 33333333 | CC SICOOB \\| TESTE | trocou | `logos/png/04891850.png` + svg (SICOOB) | `logos/png/03795072.png` + svg (SICREDI) |',
    );
    expect(md).toContain(
      '| 11111111 | Instituição 11111111 | perdeu | `logos/png/60701190.png` | — |',
    );
    expect(md).not.toContain('e mais');
  });

  it('ganho pela regra de marca dentro do limite aparece, sem exigir revisão', () => {
    const md = renderLogoChanges(
      findLogoChanges([inst('05392810', null)], [inst('05392810', SICOOB)]),
    );
    expect(md).toContain('ganhou: 1: nenhuma exige revisão');
    expect(md).toContain(
      '| 05392810 | Instituição 05392810 | ganhou | — | `logos/png/04891850.png` + svg (SICOOB) |',
    );
  });

  it('corta em 50 linhas e resume o resto com "… e mais N"', () => {
    const ispbs = Array.from({ length: 60 }, (_, i) => String(20000000 + i));
    const changes = findLogoChanges(
      ispbs.map((ispb, i) => inst(ispb, i < 3 ? null : SICOOB)),
      ispbs.map((ispb, i) => inst(ispb, i < 3 ? SICREDI : null)),
    );
    const md = renderLogoChanges(changes);
    expect(md.split('\n').filter((line) => /^\| \d{8} \|/.test(line))).toHaveLength(50);
    // As 3 que ganharam logo vêm antes das 57 que perderam; o corte cai nas últimas.
    expect(md).toContain('| 20000000 | Instituição 20000000 | ganhou |');
    expect(md).toContain('… e mais 10 (perdeu: 10)');
    expect(renderLogoChanges(changes, { limit: Number.POSITIVE_INFINITY })).not.toContain('e mais');
  });
});

describe('CLI', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const run = (...args: string[]) =>
    spawnSync(process.execPath, ['--import', 'tsx', 'pipeline/logo-changes.ts', ...args], {
      cwd: root,
      encoding: 'utf8',
    });

  // Repositório git descartável: "antes" é o commit, "depois" é a árvore.
  const tmp = mkdtempSync(join(tmpdir(), 'logo-changes-'));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));
  const git = (...args: string[]) => {
    const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
      cwd: tmp,
      encoding: 'utf8',
      // Isola da config global de quem roda (assinatura de commit, hooks…).
      env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' },
    });
    if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  };
  const gravar = (banks: InstitutionLogoView[], institutions: InstitutionLogoView[]) => {
    mkdirSync(join(tmp, 'data'), { recursive: true });
    writeFileSync(join(tmp, 'data', 'bancos.json'), JSON.stringify({ banks }));
    writeFileSync(join(tmp, 'data', 'instituicoes-pix.json'), JSON.stringify({ institutions }));
  };
  beforeAll(() => {
    gravar([inst('60701190', PROPRIO)], [inst('11111111', SICOOB), inst('22222222', null)]);
    git('init', '-q');
    git('add', 'data');
    git('commit', '-q', '-m', 'antes');
  });
  beforeEach(() => git('checkout', '-q', '--', 'data'));

  it('"antes" vem do HEAD e "depois" da árvore; a contagem é do que exige revisão', () => {
    // perdeu (exige revisão) + ganhou pela marca (dentro do limite, não exige).
    gravar([inst('60701190', PROPRIO)], [inst('11111111', null), inst('22222222', SICOOB)]);
    const report = join(tmp, 'report.md');
    writeFileSync(report, '## relatório\n');
    const { status, stdout, stderr } = run('--root', tmp, '--report', report);
    expect(stderr).toContain('| 11111111 |');
    expect(status).toBe(0);
    expect(stdout).toBe('1\n');
    const md = readFileSync(report, 'utf8');
    expect(md.startsWith('## relatório\n')).toBe(true);
    expect(md).toContain(
      '| 11111111 | Instituição 11111111 | perdeu | `logos/png/04891850.png` + svg (SICOOB) | — |',
    );
    expect(md).toContain('| 22222222 | Instituição 22222222 | ganhou | — |');
  });

  it('árvore igual ao HEAD: imprime 0 e não mexe no relatório', () => {
    const report = join(tmp, 'vazio.md');
    writeFileSync(report, 'x\n');
    const { status, stdout } = run('--root', tmp, '--report', report);
    expect(status).toBe(0);
    expect(stdout).toBe('0\n');
    expect(readFileSync(report, 'utf8')).toBe('x\n');
  });

  it('erro sai com código 1 e stdout vazio — nunca vira "0"', () => {
    const uso = run('--relatorio', 'x.md');
    expect(uso.status).toBe(1);
    expect(uso.stdout).toBe('');
    expect(uso.stderr).toContain('uso:');

    writeFileSync(join(tmp, 'data', 'bancos.json'), '{ quebrado');
    const quebrado = run('--root', tmp);
    expect(quebrado.status).toBe(1);
    expect(quebrado.stdout).toBe('');
  });
});
