/**
 * Logo diferente em instituição que JÁ estava nas listas — o caso que o diff
 * de `logos/` não enxerga.
 *
 * Afiliadas de sistemas cooperativos (Sicoob, Sicredi, Cresol, Unicred)
 * apontam para um único arquivo por marca, e arquivos publicados nunca são
 * apagados (política de permanência). Então uma instituição existente pode
 * perder o logo, ganhar um ou passar a apontar para outro arquivo sem nenhuma
 * mudança em `logos/` — ex.: a organização da marca some do diretório Open
 * Finance numa semana, a regra de marca deixa de casar e dezenas de afiliadas
 * ficam sem logo em silêncio. Em contexto bancário, logo errado é pior que
 * logo nenhum, então o workflow semanal manda para revisão humana:
 *
 * - toda perda de logo e toda troca de arquivo;
 * - ganho de logo fora da regra de marca;
 * - mais de BRAND_GAIN_LIMIT ganhos pela regra de marca, somando instituições
 *   que já existiam e as que entram nas listas já com o logo da marca.
 *
 * Até BRAND_GAIN_LIMIT ganhos pela regra de marca seguem no auto-merge: é o
 * caso comum de uma cooperativa que o BCB renomeia com o nome do sistema
 * ("… - SICOOB MERIDIONAL"), e a regra é curada (token de marca como palavra
 * inteira). O limite espelha o churn de ISPBs do workflow. Instituição nova
 * com arquivo próprio em geral aparece em `logos/` e já vai para revisão (a
 * exceção é um ISPB que volta às listas com o arquivo que a política de
 * permanência manteve: é o logo dela mesma); a que sai das listas é churn. Mudar de dataset (só-Pix -> principal, ao ganhar COMPE)
 * não é entrada nem saída: compara normalmente.
 *
 * Uso (workflow semanal, depois do pipeline):
 *   npx tsx pipeline/logo-changes.ts --report pipeline/report.md
 *
 * "Antes" = `git show HEAD:data/...`; "depois" = arquivos da árvore de
 * trabalho (`--root` troca o repositório, para os testes). O stdout traz só a
 * quantidade de mudanças que exigem revisão; havendo qualquer mudança, a seção
 * vai para o fim do relatório (corpo do PR) e a lista completa para o stderr
 * (log do workflow). Qualquer erro sai com código 1 — nunca vira "0" (fail
 * closed).
 */

import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * `entrou` = ISPB novo nas listas que já chega com o logo da marca (arquivo
 * compartilhado que já existia); só conta para o limite de ganhos por marca.
 */
export type LogoChangeKind = 'perdeu' | 'ganhou' | 'trocou' | 'entrou';

/** Ganhos pela regra de marca aceitos sem revisão numa rodada (como o churn). */
export const BRAND_GAIN_LIMIT = 3;

/** Asset para o qual a instituição aponta, como em `data/*.json`. */
export interface LogoRef {
  png: string;
  svg: string | null;
  /** `type: 'brand'` = herdado do sistema cooperativo; `brand` só para exibição. */
  source?: { type?: string; brand?: string };
}

/** O que importa aqui de uma instituição de `bancos.json`/`instituicoes-pix.json`. */
export interface InstitutionLogoView {
  ispb: string;
  name: string;
  displayName?: string | null;
  logo: LogoRef | null;
}

export interface LogoChange {
  kind: LogoChangeKind;
  ispb: string;
  /** Nome atual (o `displayName` curado, quando houver). */
  name: string;
  before: LogoRef | null;
  after: LogoRef | null;
}

/** Ordem no relatório: possível logo errado primeiro, falta de logo por último. */
const KIND_ORDER: readonly LogoChangeKind[] = ['trocou', 'ganhou', 'entrou', 'perdeu'];

function fail(where: string, problem: string): never {
  throw new Error(`${where}: ${problem}`);
}

function indexByIspb(
  list: readonly InstitutionLogoView[],
  label: string,
): Map<string, InstitutionLogoView> {
  const index = new Map<string, InstitutionLogoView>();
  for (const inst of list) {
    if (index.has(inst.ispb)) fail(label, `ISPB ${inst.ispb} repetido nas listas`);
    index.set(inst.ispb, inst);
  }
  return index;
}

/** Logo herdado do sistema cooperativo por regra curada (arquivo compartilhado). */
export function isBrandLogo(logo: LogoRef | null): boolean {
  return logo?.source?.type === 'brand';
}

function classify(before: LogoRef | null, after: LogoRef | null): LogoChangeKind | null {
  if (before && !after) return 'perdeu';
  if (!before && after) return 'ganhou';
  if (before && after && (before.png !== after.png || before.svg !== after.svg)) return 'trocou';
  return null;
}

/**
 * Instituições presentes antes E depois cujo logo sumiu, apareceu ou passou a
 * ser outro arquivo (png ou svg), mais as que entram nas listas já com o logo
 * da marca. Bytes novos no mesmo arquivo não contam aqui: isso altera
 * `logos/`, que o workflow já manda para revisão.
 */
export function findLogoChanges(
  before: readonly InstitutionLogoView[],
  after: readonly InstitutionLogoView[],
): LogoChange[] {
  const previous = indexByIspb(before, 'antes');
  const changes: LogoChange[] = [];
  for (const current of indexByIspb(after, 'depois').values()) {
    const old = previous.get(current.ispb);
    const kind = old
      ? classify(old.logo, current.logo)
      : isBrandLogo(current.logo)
        ? 'entrou'
        : null; // nova com arquivo próprio: em geral aparece em logos/; sem logo, só churn
    if (!kind) continue;
    changes.push({
      kind,
      ispb: current.ispb,
      name: current.displayName || current.name,
      before: old?.logo ?? null,
      after: current.logo,
    });
  }
  return changes.sort(
    (a, b) =>
      KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.ispb.localeCompare(b.ispb),
  );
}

function isBrandGain(change: LogoChange): boolean {
  return (change.kind === 'ganhou' || change.kind === 'entrou') && isBrandLogo(change.after);
}

/**
 * As mudanças que tiram a rodada do auto-merge (regra no topo do arquivo).
 * Lista vazia = nada aqui impede o merge automático.
 */
export function changesRequiringReview(changes: readonly LogoChange[]): LogoChange[] {
  const brandGains = changes.filter(isBrandGain);
  const overLimit = brandGains.length > BRAND_GAIN_LIMIT;
  return changes.filter((change) => (isBrandGain(change) ? overLimit : change.kind !== 'entrou'));
}

function parseInstitution(raw: unknown, where: string): InstitutionLogoView {
  if (typeof raw !== 'object' || raw === null) fail(where, 'item que não é objeto');
  const { ispb, name, displayName, logo } = raw as Record<string, unknown>;
  if (typeof ispb !== 'string' || !/^\d{8}$/.test(ispb)) {
    fail(where, `ISPB inválido: ${JSON.stringify(ispb)}`);
  }
  if (typeof name !== 'string') fail(where, `ISPB ${ispb} sem "name"`);
  const base = { ispb, name, displayName: typeof displayName === 'string' ? displayName : null };
  if (logo === null) return { ...base, logo: null };
  if (typeof logo !== 'object') fail(where, `ISPB ${ispb} com "logo" ausente ou inválido`);
  const { png, svg, source } = logo as Record<string, unknown>;
  if (typeof png !== 'string' || (svg !== null && typeof svg !== 'string')) {
    fail(where, `ISPB ${ispb} com logo sem caminho png/svg válido`);
  }
  const { type, brand } = (source ?? {}) as { type?: unknown; brand?: unknown };
  if (typeof type !== 'string') fail(where, `ISPB ${ispb} com logo sem "source.type"`);
  return {
    ...base,
    logo: { png, svg, source: typeof brand === 'string' ? { type, brand } : { type } },
  };
}

/**
 * União de `bancos.json` ("banks") e `instituicoes-pix.json` ("institutions"),
 * validando o formato: arquivo estranho é erro, nunca "nenhuma mudança".
 */
export function institutionsOf(banksJson: unknown, pixJson: unknown): InstitutionLogoView[] {
  const list = (json: unknown, key: string, file: string): unknown[] => {
    const value = (json as Record<string, unknown> | null)?.[key];
    if (!Array.isArray(value)) fail(file, `campo "${key}" ausente ou não é lista`);
    return value;
  };
  return [
    ...list(banksJson, 'banks', 'bancos.json').map((raw) => parseInstitution(raw, 'bancos.json')),
    ...list(pixJson, 'institutions', 'instituicoes-pix.json').map((raw) =>
      parseInstitution(raw, 'instituicoes-pix.json'),
    ),
  ];
}

function cell(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim();
}

function describeLogo(logo: LogoRef | null): string {
  if (!logo) return '—';
  const svgSibling = logo.png.replace(/^logos\/png\/(.+)\.png$/, 'logos/svg/$1.svg');
  let text = `\`${logo.png}\``;
  if (logo.svg === svgSibling) text += ' + svg';
  else if (logo.svg) text += ` + \`${logo.svg}\``;
  return logo.source?.brand ? `${text} (${logo.source.brand})` : text;
}

function countByKind(changes: readonly LogoChange[]): string {
  return KIND_ORDER.map((kind) => ({ kind, n: changes.filter((c) => c.kind === kind).length }))
    .filter(({ n }) => n > 0)
    .map(({ kind, n }) => `${kind}: ${n}`)
    .join(' · ');
}

/**
 * Seção do relatório semanal (corpo do PR): até `limit` instituições, o resto
 * resumido em "… e mais N". Sem mudanças, string vazia.
 */
export function renderLogoChanges(
  changes: readonly LogoChange[],
  { limit = 50 }: { limit?: number } = {},
): string {
  if (!changes.length) return '';
  const blocking = changesRequiringReview(changes).length;
  const verdict = blocking
    ? `${blocking} exige(m) revisão humana`
    : 'nenhuma exige revisão (até 3 ganhos pela regra de marca seguem no auto-merge)';
  const shown = changes.slice(0, limit);
  const hidden = changes.slice(shown.length);
  const lines = [
    `### ⚠️ Logo diferente em instituições (${changes.length})`,
    '',
    `${countByKind(changes)}: ${verdict}. Pode acontecer sem nenhum arquivo alterado em \`logos/\`, porque afiliadas de sistemas cooperativos dividem um arquivo por marca e assets publicados nunca são apagados. Perda, troca, ganho fora da regra de marca ou mais de ${BRAND_GAIN_LIMIT} ganhos pela regra de marca vão para revisão. Confira cada linha: logo errado é pior que logo nenhum.`,
    '',
    '| ISPB | Instituição | Mudança | Antes | Depois |',
    '|---|---|---|---|---|',
    ...shown.map(
      (c) =>
        `| ${c.ispb} | ${cell(c.name)} | ${c.kind} | ${describeLogo(c.before)} | ${describeLogo(c.after)} |`,
    ),
  ];
  if (hidden.length) {
    lines.push(
      '',
      `… e mais ${hidden.length} (${countByKind(hidden)}): lista completa no log do workflow, passo "Classificar o diff".`,
    );
  }
  return `${lines.join('\n')}\n`;
}

// ---- CLI ----

const DEFAULT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATASET_PATHS = ['data/bancos.json', 'data/instituicoes-pix.json'];

function readInstitutions(read: (path: string) => string): InstitutionLogoView[] {
  const [banks, pix] = DATASET_PATHS.map((path) => JSON.parse(read(path)) as unknown);
  return institutionsOf(banks, pix);
}

function main(argv: string[]): void {
  let reportPath: string | null = null;
  let root = DEFAULT_ROOT;
  for (let i = 0; i < argv.length; i++) {
    const next = argv[i + 1];
    if (argv[i] === '--report' && next) {
      reportPath = next;
      i++;
    } else if (argv[i] === '--root' && next) {
      root = resolve(next);
      i++;
    } else {
      fail('uso', 'npx tsx pipeline/logo-changes.ts [--report <arquivo>] [--root <repositório>]');
    }
  }

  const before = readInstitutions((path) =>
    execFileSync('git', ['show', `HEAD:${path}`], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    }),
  );
  const after = readInstitutions((path) => readFileSync(join(root, path), 'utf8'));
  const changes = findLogoChanges(before, after);
  if (changes.length) {
    if (reportPath) appendFileSync(reportPath, `\n${renderLogoChanges(changes)}`);
    process.stderr.write(renderLogoChanges(changes, { limit: Number.POSITIVE_INFINITY }));
  }
  // Por último: só chega aqui quem leu, comparou e gravou tudo sem erro.
  process.stdout.write(`${changesRequiringReview(changes).length}\n`);
}

function isEntryPoint(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(`✖ logo-changes: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
