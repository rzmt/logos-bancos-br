/**
 * AI-assisted discovery for the residue — maintainer tool, NOT part of the
 * shipped pipeline output.
 *
 * For institutions that have no logo AND no entry in pipeline/sites.json,
 * Claude (with web search) is used as a *scout*: it finds the institution's
 * official website and, when possible, a direct logo URL, always with the
 * evidence it relied on. The deterministic code then does the trustworthy
 * part — fetching the site, extracting icon candidates and assessing them
 * (same guardrails as `npm run discover`).
 *
 * NOTHING is written to config/assets. Output is curation material:
 *   - pipeline/discovery-ai-report.md — per institution: suggested DOMAIN,
 *     the AI's evidence, the validated candidate and ready-to-paste lines
 *     for sites.json / forcedUris;
 *   - pipeline/discovery-ai-sheet.png — labeled thumbnails (host exposed).
 *
 * The human reviewer must verify the DOMAIN before promoting anything — a
 * lookalike domain is the specific risk of this flow.
 *
 * Usage (requires ANTHROPIC_API_KEY — exported, or in a git-ignored
 * `.env.local` at the repo root with `ANTHROPIC_API_KEY=sk-ant-...`):
 *   npm run discover:ai                     # up to 15 institutions per run
 *   npm run discover:ai -- --limit 40
 *   npm run discover:ai -- --only 707,0246  # subset (COMPE or ISPB)
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

import { withConcurrency } from './concurrency';
import { buildSheet, probeSite, type SiteResult, tryCandidate } from './discover';
import type { Bank } from './types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SITES_PATH = join(__dirname, 'sites.json');
const DATASET_PATH = join(ROOT, 'data', 'bancos.json');
const REPORT_PATH = join(__dirname, 'discovery-ai-report.md');
const SHEET_PATH = join(__dirname, 'discovery-ai-sheet.png');

const MODEL = 'claude-opus-4-8';
const DEFAULT_LIMIT = 15;

/**
 * Loads KEY=VALUE pairs from a git-ignored `.env.local` at the repo root into
 * process.env (without overriding what's already exported). Keeps the API key
 * out of shell history/profile without adding a dotenv dependency.
 */
function loadEnvLocal(): void {
  const envPath = join(ROOT, '.env.local');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (!key || process.env[key] !== undefined) continue;
    process.env[key] = (rawValue ?? '').replace(/^["']|["']$/g, '');
  }
}

export interface AiAnswer {
  /** Official institutional site (https), or null when the AI could not confirm one. */
  site: string | null;
  /** Direct logo URL on an official domain, when the AI found one. */
  logoUrl: string | null;
  confidence: 'alta' | 'media' | 'baixa';
  /** What the AI relied on — shown verbatim to the human reviewer. */
  evidence: string;
}

/**
 * Extracts the JSON answer from the model's text. Accepts a fenced ```json
 * block or a bare object, tolerating prose around it. Returns null when no
 * valid answer shape is found (the institution is then reported as
 * unresolved — never guessed).
 */
export function parseAiAnswer(text: string): AiAnswer | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const source = fenced?.[1] ?? text;
  const start = source.indexOf('{');
  if (start < 0) return null;

  // Walk to the matching closing brace of the first object.
  let depth = 0;
  let end = -1;
  let inString = false;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(source.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;

  const normalizeUrl = (value: unknown): string | null => {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      const url = new URL(value.trim());
      return url.protocol === 'https:' ? url.toString() : null;
    } catch {
      return null;
    }
  };

  const confidence =
    obj.confidence === 'alta' || obj.confidence === 'media' || obj.confidence === 'baixa'
      ? obj.confidence
      : 'baixa';

  return {
    site: normalizeUrl(obj.site),
    logoUrl: normalizeUrl(obj.logoUrl),
    confidence,
    evidence: typeof obj.evidence === 'string' ? obj.evidence.trim() : '',
  };
}

function buildPrompt(bank: Bank): string {
  return [
    `Encontre o site institucional OFICIAL da instituição financeira brasileira abaixo, e (se possível) a URL de um arquivo de logo/ícone hospedado em domínio oficial dela.`,
    '',
    `- Nome oficial (Banco Central/STR): ${bank.name}`,
    `- Nome reduzido: ${bank.shortName}`,
    `- ISPB: ${bank.ispb} · Código COMPE: ${bank.compe4}`,
    '',
    'Regras:',
    '- Use a busca na web para confirmar. O domínio precisa pertencer à própria instituição (site institucional), não a agregadores, notícias, marketplaces de domínio ou homônimos.',
    '- Cuidado com domínios parecidos/homônimos: em caso de dúvida, responda site null e confidence "baixa".',
    '- logoUrl só se for um arquivo de imagem (svg/png) em domínio oficial; caso contrário, null.',
    '- evidence: 1-2 frases citando o que confirmou o vínculo (ex.: "site cita ISPB/CNPJ", "página institucional descreve a SCD X autorizada pelo BCB").',
    '',
    'Responda SOMENTE com um objeto JSON neste formato, sem texto fora do bloco:',
    '```json',
    '{"site": "https://... ou null", "logoUrl": "https://... ou null", "confidence": "alta|media|baixa", "evidence": "..."}',
    '```',
  ].join('\n');
}

async function askClaude(client: Anthropic, bank: Bank): Promise<AiAnswer | null> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }],
    messages: [{ role: 'user', content: buildPrompt(bank) }],
  });
  if (response.stop_reason === 'refusal') return null;
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
  return parseAiAnswer(text);
}

interface AiResult extends SiteResult {
  answer: AiAnswer | null;
  failure: string | null;
}

function buildAiReport(results: AiResult[]): string {
  const approvable = results.filter((result) => result.best);
  const unresolved = results.filter((result) => !result.best);

  const lines: string[] = [
    '# Descoberta assistida por IA — SUGESTÕES para curadoria',
    '',
    '> Gerado por `npm run discover:ai`. NADA foi gravado. Estas são sugestões de uma IA',
    '> com busca na web — **CONFIRA O DOMÍNIO de cada uma** antes de promover (o risco',
    '> específico deste fluxo é domínio falso/parecido). O candidato de imagem já passou',
    '> pelos guardrails determinísticos (https, sanitização de SVG, dimensão mínima).',
    '',
    `Instituições analisadas: ${results.length} · com candidato validado: ${approvable.length} · sem resolução: ${unresolved.length}`,
    '',
    '## Sugestões com candidato validado',
    '',
  ];

  for (const result of approvable) {
    const best = result.best;
    if (!best) continue;
    const host = new URL(best.url).host;
    lines.push(
      `### ${result.compe4} — ${result.name}`,
      `- Site sugerido pela IA: ${result.site} (confiança: ${result.answer?.confidence ?? '?'})`,
      `- Evidência da IA: ${result.answer?.evidence || '(não informada)'}`,
      `- Candidato validado: ${best.url}`,
      `- Host: **${host}** · Origem: ${best.origin}`,
      '- Se o domínio conferir, promova (linhas prontas):',
      '```json',
      `// pipeline/sites.json`,
      `"${result.ispb}": "${result.site}",`,
      `// pipeline/config.json -> forcedUris`,
      `"${result.ispb}": "${best.url}",`,
      '```',
      '',
    );
  }

  lines.push('## Sem resolução', '');
  for (const result of unresolved) {
    lines.push(`- **${result.compe4} ${result.name}** (ISPB ${result.ispb})`);
    if (result.failure) lines.push(`  - ${result.failure}`);
    if (result.answer?.site) {
      lines.push(
        `  - IA sugeriu ${result.answer.site} (confiança ${result.answer.confidence}; "${result.answer.evidence}"), mas nenhum candidato passou nos guardrails`,
      );
      for (const rejection of result.rejected.slice(0, 3)) {
        lines.push(`  - ${rejection.url} → ${rejection.reason}`);
      }
    }
  }
  lines.push('');
  return lines.join('\n');
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const readFlag = (name: string): string | null => {
    const index = argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
    if (index < 0) return null;
    return argv[index]?.includes('=')
      ? (argv[index]?.split('=')[1] ?? '')
      : (argv[index + 1] ?? '');
  };
  const limit = Number(readFlag('limit') ?? DEFAULT_LIMIT) || DEFAULT_LIMIT;
  const onlyRaw = readFlag('only');
  const only = onlyRaw
    ? new Set(
        onlyRaw
          .split(',')
          .map((token) => token.trim().replace(/\D/g, ''))
          .filter(Boolean)
          .map((digits) => (digits.length > 4 ? digits.padStart(8, '0') : digits.padStart(4, '0'))),
      )
    : null;

  const sites = JSON.parse(readFileSync(SITES_PATH, 'utf8')) as Record<string, string>;
  const dataset = JSON.parse(readFileSync(DATASET_PATH, 'utf8')) as { banks: Bank[] };

  // Residue: no logo, and not already covered by the manual sites.json flow.
  let residue = dataset.banks.filter((bank) => !bank.logo && !sites[bank.ispb]);
  if (only) residue = residue.filter((bank) => only.has(bank.compe4) || only.has(bank.ispb));
  const targets = residue.slice(0, limit);

  if (targets.length === 0) {
    console.log('Nada a fazer: nenhuma instituição no resíduo (sem logo e fora do sites.json).');
    return;
  }

  loadEnvLocal();
  const client = new Anthropic();
  console.log(
    `Consultando a IA (${MODEL} + web search) para ${targets.length} de ${residue.length} instituição(ões) no resíduo...`,
  );

  const results: AiResult[] = [];
  await withConcurrency(targets, 2, async (bank) => {
    const result: AiResult = {
      ispb: bank.ispb,
      compe4: bank.compe4,
      name: bank.shortName || bank.name,
      site: '',
      best: null,
      rejected: [],
      error: null,
      answer: null,
      failure: null,
    };
    try {
      result.answer = await askClaude(client, bank);
      if (!result.answer) {
        result.failure = 'IA não retornou resposta utilizável';
      } else if (!result.answer.site) {
        result.failure = `IA não confirmou site oficial (confiança ${result.answer.confidence})`;
      } else {
        result.site = result.answer.site;
        // Deterministic validation: probe the suggested site's HTML...
        const probe = await probeSite(result.answer.site);
        result.best = probe.best;
        result.rejected = probe.rejected;
        result.error = probe.error;
        // ...and, if the AI pointed at a direct logo file, try that too.
        if (!result.best && result.answer.logoUrl) {
          const outcome = await tryCandidate({
            url: result.answer.logoUrl,
            origin: 'icon',
            declaredSize: 0,
          });
          if (outcome.best) result.best = outcome.best;
          else if (outcome.rejection) result.rejected.push(outcome.rejection);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Credential problems affect the whole run — abort with a clear message
      // instead of burning through the batch.
      if (
        error instanceof Anthropic.AuthenticationError ||
        /could not resolve authentication method/i.test(message)
      ) {
        throw new Error(
          'Sem credencial da API da Anthropic. Crie um .env.local na raiz do repo com ANTHROPIC_API_KEY=sk-ant-... (ou exporte a variável) e rode de novo.',
        );
      }
      result.failure = message;
    }
    results.push(result);
    const status = result.best ? '✓' : '·';
    console.log(
      `  ${status} ${result.compe4} ${result.name}${result.site ? ` → ${result.site}` : ''}`,
    );
  });

  results.sort((a, b) => a.compe4.localeCompare(b.compe4));
  writeFileSync(REPORT_PATH, buildAiReport(results));
  const sheetCount = await buildSheet(results, SHEET_PATH);

  const approvable = results.filter((result) => result.best).length;
  console.log('\n──────────── Descoberta (IA) ────────────');
  console.log(`Analisadas:                ${results.length} (resíduo total: ${residue.length})`);
  console.log(`Com candidato validado:    ${approvable}`);
  console.log(`Sem resolução:             ${results.length - approvable}`);
  console.log(`Relatório:                 pipeline/discovery-ai-report.md`);
  console.log(
    `Folha de revisão:          ${sheetCount ? 'pipeline/discovery-ai-sheet.png' : '(não gerada)'}`,
  );
  console.log('\nSugestões apenas — confira o DOMÍNIO de cada uma antes de promover a');
  console.log('sites.json/forcedUris. Rode com --limit para ampliar o lote.');
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
