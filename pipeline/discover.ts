/**
 * Official-site icon discovery — maintainer tool, NOT part of the shipped
 * pipeline output.
 *
 * For institutions that have no logo in the Open Finance directory, this tool
 * visits their official website (declared by hand in pipeline/sites.json),
 * extracts icon candidates from the HTML (apple-touch-icon, icon links,
 * og:image, plus /apple-touch-icon.png and /favicon.ico fallbacks), downloads
 * and filters them, and produces:
 *
 *   - pipeline/discovery-report.md  — best candidate per institution with the
 *     ready-to-paste `"<ispb>": "<url>"` line for `forcedUris`;
 *   - pipeline/discovery-sheet.png  — labeled thumbnails (with the HOST, so
 *     the reviewer can spot wrong/lookalike domains).
 *
 * NOTHING is written to data/ or logos/: a human reviews the sheet and
 * promotes approved candidates to `forcedUris` in pipeline/config.json — the
 * normal pipeline then downloads, sanitizes and records provenance as usual.
 *
 * Usage:
 *   npm run discover
 *   npm run discover -- --only 707,0246,62232889   # subset (COMPE or ISPB)
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

import { withConcurrency } from './concurrency';
import { BROWSER_USER_AGENT, downloadLogo, isSafeSvg, looksLikeSvg, rasterize } from './images';
import type { Bank } from './types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SITES_PATH = join(__dirname, 'sites.json');
const DATASET_PATH = join(ROOT, 'data', 'bancos.json');
const REPORT_PATH = join(__dirname, 'discovery-report.md');
const SHEET_PATH = join(__dirname, 'discovery-sheet.png');

const MIN_RASTER_SIDE = 96;
const MAX_ASPECT_RATIO = 3.5;

export type CandidateOrigin = 'apple-touch-icon' | 'icon' | 'og-image' | 'fallback';

export interface IconCandidate {
  url: string;
  origin: CandidateOrigin;
  /** Largest side declared in the `sizes` attribute (0 when absent). */
  declaredSize: number;
}

function attr(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match ? (match[2] ?? match[3] ?? match[4]) || null : null;
}

/**
 * Extracts icon candidates from a page's HTML, ordered by how likely each is
 * to be the institution's square brand mark:
 * apple-touch-icon (largest first) > icon links to SVG > og:image > other
 * icon links > fallback paths. Only https URLs survive.
 */
export function extractIconCandidates(html: string, pageUrl: string): IconCandidate[] {
  const candidates: IconCandidate[] = [];
  const resolve = (href: string): string | null => {
    try {
      const url = new URL(href.trim(), pageUrl).toString();
      return /^https:\/\//i.test(url) ? url : null;
    } catch {
      return null;
    }
  };

  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = (attr(tag, 'rel') ?? '').toLowerCase();
    if (!rel.includes('icon')) continue;
    const href = attr(tag, 'href');
    if (!href) continue;
    const url = resolve(href);
    if (!url) continue;
    const sizes = attr(tag, 'sizes') ?? '';
    const declaredSize = Math.max(
      0,
      ...sizes.split(/\s+/).map((size) => Number.parseInt(size, 10) || 0),
    );
    const origin: CandidateOrigin = rel.includes('apple-touch-icon') ? 'apple-touch-icon' : 'icon';
    candidates.push({ url, origin, declaredSize });
  }

  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const property = (attr(tag, 'property') ?? attr(tag, 'name') ?? '').toLowerCase();
    if (property !== 'og:image' && property !== 'og:image:url') continue;
    const content = attr(tag, 'content');
    if (!content) continue;
    const url = resolve(content);
    if (!url) continue;
    candidates.push({ url, origin: 'og-image', declaredSize: 0 });
  }

  for (const path of ['/apple-touch-icon.png', '/favicon.ico']) {
    const url = resolve(path);
    if (url) candidates.push({ url, origin: 'fallback', declaredSize: 0 });
  }

  const tier = (candidate: IconCandidate): number => {
    if (candidate.origin === 'apple-touch-icon') return 0;
    if (candidate.origin === 'icon' && /\.svg(\?|$)/i.test(candidate.url)) return 1;
    if (candidate.origin === 'og-image') return 2;
    if (candidate.origin === 'icon') return 3;
    return 4;
  };
  const indexed = candidates.map((candidate, index) => ({ candidate, index }));
  indexed.sort(
    (a, b) =>
      tier(a.candidate) - tier(b.candidate) ||
      b.candidate.declaredSize - a.candidate.declaredSize ||
      a.index - b.index,
  );

  const seen = new Set<string>();
  const result: IconCandidate[] = [];
  for (const { candidate } of indexed) {
    if (seen.has(candidate.url)) continue;
    seen.add(candidate.url);
    result.push(candidate);
  }
  return result;
}

export interface Assessment {
  ok: boolean;
  kind: 'svg' | 'raster';
  width: number | null;
  height: number | null;
  reason: string | null;
}

/** Judges downloaded bytes: safe SVG, or raster big/square enough for a logo. */
export async function assessCandidate(
  bytes: Buffer,
  { minSide = MIN_RASTER_SIDE }: { minSide?: number } = {},
): Promise<Assessment> {
  if (looksLikeSvg(bytes)) {
    const safe = isSafeSvg(bytes.toString('utf8'));
    return {
      ok: safe,
      kind: 'svg',
      width: null,
      height: null,
      reason: safe ? null : 'svg reprovado na sanitização',
    };
  }
  try {
    const meta = await sharp(bytes, { limitInputPixels: 100_000_000 }).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (Math.min(width, height) < minSide) {
      return {
        ok: false,
        kind: 'raster',
        width,
        height,
        reason: `muito pequeno (${width}x${height}; mínimo ${minSide}px)`,
      };
    }
    const ratio = Math.max(width, height) / Math.max(1, Math.min(width, height));
    if (ratio > MAX_ASPECT_RATIO) {
      return {
        ok: false,
        kind: 'raster',
        width,
        height,
        reason: `proporção de banner (${width}x${height})`,
      };
    }
    return { ok: true, kind: 'raster', width, height, reason: null };
  } catch {
    return {
      ok: false,
      kind: 'raster',
      width: null,
      height: null,
      reason: 'formato não decodificável',
    };
  }
}

interface Rejection {
  url: string;
  reason: string;
}

export interface SiteProbe {
  best: (IconCandidate & { assessment: Assessment; bytes: Buffer }) | null;
  rejected: Rejection[];
  error: string | null;
}

export interface SiteResult extends SiteProbe {
  ispb: string;
  compe4: string;
  name: string;
  site: string;
}

/**
 * Fetches an official site, extracts icon candidates from its HTML and
 * returns the first candidate that passes assessment. Shared by the manual
 * (sites.json) and the AI-assisted (discover-ai.ts) flows.
 */
export async function probeSite(site: string): Promise<SiteProbe> {
  const probe: SiteProbe = { best: null, rejected: [], error: null };
  try {
    const response = await fetch(site, {
      headers: { 'user-agent': BROWSER_USER_AGENT, accept: 'text/html,*/*' },
      signal: AbortSignal.timeout(20_000),
      redirect: 'follow',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = (await response.text()).slice(0, 500_000);
    const candidates = extractIconCandidates(html, response.url || site);

    for (const candidate of candidates) {
      const outcome = await tryCandidate(candidate);
      if (outcome.best) {
        probe.best = outcome.best;
        break;
      }
      if (outcome.rejection) probe.rejected.push(outcome.rejection);
    }
    if (!probe.best && candidates.length === 0) probe.error = 'nenhum candidato no HTML';
  } catch (error) {
    probe.error = error instanceof Error ? error.message : String(error);
  }
  return probe;
}

/** Downloads and assesses one candidate URL. */
export async function tryCandidate(
  candidate: IconCandidate,
): Promise<{ best: SiteProbe['best']; rejection: Rejection | null }> {
  try {
    const bytes = await downloadLogo(candidate.url, { timeoutMs: 15_000, attempts: 1 });
    const assessment = await assessCandidate(bytes);
    if (assessment.ok) return { best: { ...candidate, assessment, bytes }, rejection: null };
    return {
      best: null,
      rejection: { url: candidate.url, reason: assessment.reason ?? 'reprovado' },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { best: null, rejection: { url: candidate.url, reason: message } };
  }
}

function describeAssessment(assessment: Assessment): string {
  return assessment.kind === 'svg' ? 'SVG' : `PNG/raster ${assessment.width}x${assessment.height}`;
}

function buildReport(results: SiteResult[], skippedWithLogo: string[]): string {
  const approvable = results.filter((result) => result.best);
  const withoutCandidate = results.filter((result) => !result.best);

  const lines: string[] = [
    '# Descoberta de ícones oficiais — relatório para curadoria',
    '',
    '> Gerado por `npm run discover`. NADA foi gravado nos assets. Revise a folha',
    '> `pipeline/discovery-sheet.png` (confira o DOMÍNIO de cada um!) e promova os',
    '> aprovados para `forcedUris` em pipeline/config.json, depois `npm run pipeline`.',
    '',
    `Instituições analisadas: ${results.length} · com candidato aprovável: ${approvable.length} · sem candidato: ${withoutCandidate.length}`,
    '',
    '## Candidatos aprováveis',
    '',
  ];

  for (const result of approvable) {
    const best = result.best;
    if (!best) continue;
    const host = new URL(best.url).host;
    lines.push(
      `### ${result.compe4} — ${result.name}`,
      `- Site declarado: ${result.site}`,
      `- Candidato: ${best.url}`,
      `- Host: **${host}** · Origem: ${best.origin} · ${describeAssessment(best.assessment)}`,
      '- Linha para `forcedUris`:',
      '```json',
      `"${result.ispb}": "${best.url}",`,
      '```',
      '',
    );
  }

  lines.push('## Sem candidato aprovável', '');
  for (const result of withoutCandidate) {
    lines.push(`- **${result.compe4} ${result.name}** (${result.site})`);
    if (result.error) lines.push(`  - erro: ${result.error}`);
    for (const rejection of result.rejected.slice(0, 4)) {
      lines.push(`  - ${rejection.url} → ${rejection.reason}`);
    }
  }

  if (skippedWithLogo.length) {
    lines.push(
      '',
      `## Entradas de sites.json ignoradas (instituição já tem logo): ${skippedWithLogo.join(', ')}`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

export async function buildSheet(results: SiteResult[], sheetPath = SHEET_PATH): Promise<number> {
  const approvable = results.filter((result) => result.best);
  if (approvable.length === 0) return 0;

  const COLS = 6;
  const CELL_W = 190;
  const CELL_H = 210;
  const THUMB = 110;
  const rows = Math.ceil(approvable.length / COLS);
  const width = COLS * CELL_W;
  const height = rows * CELL_H;

  const esc = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const composites: Array<{ input: Buffer; left: number; top: number }> = [];
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`;
  svg += `<rect width="${width}" height="${height}" fill="white"/>`;

  for (let i = 0; i < approvable.length; i++) {
    const result = approvable[i] as SiteResult;
    const best = result.best;
    if (!best) continue;
    const x = (i % COLS) * CELL_W;
    const y = Math.floor(i / COLS) * CELL_H;
    try {
      const thumb = await rasterize(best.bytes, { sizePx: THUMB });
      composites.push({ input: thumb, left: x + Math.round((CELL_W - THUMB) / 2), top: y + 12 });
    } catch {
      // Thumb rendering failure: leave the cell empty; the report still lists it.
    }
    const host = new URL(best.url).host;
    svg += `<text x="${x + CELL_W / 2}" y="${y + THUMB + 34}" text-anchor="middle" font-family="Helvetica" font-size="14" font-weight="bold" fill="#111">${result.compe4}</text>`;
    svg += `<text x="${x + CELL_W / 2}" y="${y + THUMB + 50}" text-anchor="middle" font-family="Helvetica" font-size="9" fill="#555">${esc(result.name.slice(0, 30))}</text>`;
    svg += `<text x="${x + CELL_W / 2}" y="${y + THUMB + 64}" text-anchor="middle" font-family="Helvetica" font-size="9" fill="#0645ad">${esc(host.slice(0, 34))}</text>`;
    svg += `<rect x="${x + 0.5}" y="${y + 0.5}" width="${CELL_W - 1}" height="${CELL_H - 1}" fill="none" stroke="#ddd"/>`;
  }
  svg += '</svg>';

  await sharp(Buffer.from(svg)).png().composite(composites).toFile(sheetPath);
  return approvable.length;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  let only: Set<string> | null = null;
  const onlyIndex = argv.findIndex((a) => a === '--only' || a.startsWith('--only='));
  if (onlyIndex >= 0) {
    const raw = argv[onlyIndex]?.includes('=')
      ? (argv[onlyIndex]?.split('=')[1] ?? '')
      : (argv[onlyIndex + 1] ?? '');
    only = new Set(
      raw
        .split(',')
        .map((token) => token.trim().replace(/\D/g, ''))
        .filter(Boolean)
        .map((digits) => (digits.length > 4 ? digits.padStart(8, '0') : digits.padStart(4, '0'))),
    );
  }

  const sites = JSON.parse(readFileSync(SITES_PATH, 'utf8')) as Record<string, string>;
  const dataset = JSON.parse(readFileSync(DATASET_PATH, 'utf8')) as { banks: Bank[] };

  const byIspb = new Map(dataset.banks.map((bank) => [bank.ispb, bank]));
  const skippedWithLogo: string[] = [];
  const targets: Array<{ bank: Bank; site: string }> = [];
  for (const [ispb, site] of Object.entries(sites)) {
    if (ispb.startsWith('$')) continue;
    const bank = byIspb.get(ispb);
    if (!bank) {
      console.warn(`⚠ sites.json: ISPB ${ispb} não existe no dataset — ignorado.`);
      continue;
    }
    if (bank.logo) {
      skippedWithLogo.push(bank.compe4);
      continue;
    }
    if (only && !only.has(bank.compe4) && !only.has(bank.ispb)) continue;
    targets.push({ bank, site });
  }

  console.log(`Descobrindo ícones oficiais de ${targets.length} instituição(ões)...`);
  const results: SiteResult[] = [];

  await withConcurrency(targets, 4, async ({ bank, site }) => {
    const probe = await probeSite(site);
    const result: SiteResult = {
      ispb: bank.ispb,
      compe4: bank.compe4,
      name: bank.shortName || bank.name,
      site,
      ...probe,
    };
    results.push(result);
    const status = result.best ? '✓' : '·';
    console.log(`  ${status} ${result.compe4} ${result.name}`);
  });

  results.sort((a, b) => a.compe4.localeCompare(b.compe4));
  writeFileSync(REPORT_PATH, buildReport(results, skippedWithLogo.sort()));
  const sheetCount = await buildSheet(results);

  const approvable = results.filter((result) => result.best).length;
  console.log('\n──────────── Descoberta ────────────');
  console.log(`Analisadas:               ${results.length}`);
  console.log(`Com candidato aprovável:  ${approvable}`);
  console.log(`Sem candidato:            ${results.length - approvable}`);
  console.log(`Relatório:                pipeline/discovery-report.md`);
  console.log(
    `Folha de revisão:         ${sheetCount ? 'pipeline/discovery-sheet.png' : '(não gerada — nada aprovável)'}`,
  );
  console.log('\nRevise a folha (confira os DOMÍNIOS), promova os aprovados a forcedUris');
  console.log('em pipeline/config.json e rode `npm run pipeline`.');
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
