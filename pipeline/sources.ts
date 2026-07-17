/**
 * Official data sources.
 *
 * 1. Central Bank of Brazil — STR participants list (CSV, updated daily):
 *    first backbone. Defines institutions with a COMPE number, their ISPB
 *    and official names.
 * 2. Central Bank of Brazil — active Pix participants list (CSV, published
 *    daily under a dated URL; only the current day stays available): second
 *    backbone. Adds institutions without COMPE and per-institution Pix
 *    participation attributes.
 * 3. Open Finance Brasil — participants directory (public JSON): each
 *    institution publishes and maintains its own logo
 *    (AuthorisationServers[].CustomerFriendlyLogoUri), identified by CNPJ.
 */

import { stripAccents } from './text';
import type { BackboneParticipant, PixParticipant, RawOrganisation, StrParticipant } from './types';

export const STR_CSV_URL =
  'https://www.bcb.gov.br/content/estabilidadefinanceira/str1/ParticipantesSTR.csv';
export const OPEN_FINANCE_DIRECTORY_URL =
  'https://data.directory.openbankingbrasil.org.br/participants';
/**
 * Daily Pix participants file (despite the "em-adesao" filename, it carries
 * the "participantes ativos" table plus a second onboarding section). Only
 * the current day's date resolves — the previous day's URL 404s.
 */
export const PIX_CSV_URL_BASE =
  'https://www.bcb.gov.br/content/estabilidadefinanceira/participantes_pix/lista-participantes-instituicoes-em-adesao-pix-';

const USER_AGENT = 'logos-bancos-br/0.1 (+https://github.com/rzmt/logos-bancos-br)';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  url: string,
  { timeoutMs = 30_000, attempts = 3 }: { timeoutMs?: number; attempts?: number } = {},
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': USER_AGENT, accept: '*/*' },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'follow',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(500 * 2 ** attempt);
    }
  }
  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Falha ao baixar ${url} após ${attempts} tentativas: ${message}`);
}

/** Minimal CSV parser: quoted fields, escaped quotes ("") and \n / \r\n line breaks. */
export function parseCsv(
  text: string,
  { separator = ',' }: { separator?: string } = {},
): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  const endRow = () => {
    row.push(field);
    field = '';
    if (row.length > 1 || row[0] !== '') rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === separator) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      endRow();
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) endRow();
  return rows;
}

function normalizeHeader(header: string): string {
  return stripAccents(header)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Parses the STR participants CSV into the institutions that have a COMPE
 * number. Rows without "Número-Código" (financial market infrastructures,
 * National Treasury, clearing houses with code 0) are out of scope.
 *
 * `minRows` guards against a truncated or broken download being treated as
 * "the list shrank"; tests lower it to use small fixtures.
 */
export function parseStrCsv(
  text: string,
  { minRows = 50 }: { minRows?: number } = {},
): StrParticipant[] {
  let body = text;
  if (body.charCodeAt(0) === 0xfeff) body = body.slice(1); // UTF-8 BOM

  const rows = parseCsv(body);
  if (rows.length < minRows) {
    throw new Error(`CSV do BCB com poucas linhas (${rows.length}); fonte suspeita.`);
  }

  const header = (rows[0] ?? []).map(normalizeHeader);
  const columns = {
    ispb: header.indexOf('ispb'),
    shortName: header.indexOf('nomereduzido'),
    compe: header.indexOf('numerocodigo'),
    fullName: header.indexOf('nomeextenso'),
  };
  for (const [name, index] of Object.entries(columns)) {
    if (index < 0) throw new Error(`Coluna esperada ausente no CSV do BCB: ${name}`);
  }

  const participants: StrParticipant[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const compe = (row[columns.compe] ?? '').replace(/\D/g, '');
    if (!compe || Number(compe) === 0) continue;
    participants.push({
      ispb: (row[columns.ispb] ?? '').replace(/\D/g, '').padStart(8, '0'),
      compe,
      compe4: compe.padStart(4, '0'),
      shortName: (row[columns.shortName] ?? '').trim(),
      fullName: (row[columns.fullName] ?? '').trim(),
    });
  }
  if (participants.length < Math.min(minRows, 50)) {
    throw new Error(
      `Poucos participantes com Número-Código (${participants.length}); fonte suspeita.`,
    );
  }
  return participants;
}

export async function fetchStrParticipants({
  timeoutMs = 30_000,
}: {
  timeoutMs?: number;
} = {}): Promise<StrParticipant[]> {
  const response = await fetchWithRetry(STR_CSV_URL, { timeoutMs });
  return parseStrCsv(await response.text());
}

export async function fetchOpenFinanceDirectory({
  timeoutMs = 30_000,
}: {
  timeoutMs?: number;
} = {}): Promise<RawOrganisation[]> {
  const response = await fetchWithRetry(OPEN_FINANCE_DIRECTORY_URL, { timeoutMs });
  const data: unknown = await response.json();
  if (!Array.isArray(data) || data.length < 50) {
    const size = Array.isArray(data) ? data.length : 'não-array';
    throw new Error(`JSON do diretório Open Finance inesperado (n=${size}).`);
  }
  return data as RawOrganisation[];
}

/** Formats a Date as YYYYMMDD in the São Paulo timezone (the file's clock). */
export function pixCsvDateStamp(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  return parts.replace(/-/g, '');
}

/**
 * Parses the Pix participants CSV (latin-1 already decoded): `;`-separated,
 * a title line, the "participantes ativos" table, then a second
 * "em processo de adesão" section which is out of scope. Rows without an
 * ISPB (a handful of indirect participants) are skipped and counted.
 */
export function parsePixCsv(
  text: string,
  { minRows = 300 }: { minRows?: number } = {},
): { participants: PixParticipant[]; skippedNoIspb: number } {
  const rows = parseCsv(text, { separator: ';' });

  const headerIndex = rows.findIndex(
    (row) => row.length > 3 && normalizeHeader(row[1] ?? '') === 'nomereduzido',
  );
  if (headerIndex < 0) throw new Error('CSV do Pix sem cabeçalho reconhecível.');
  const header = (rows[headerIndex] ?? []).map(normalizeHeader);
  const columns = {
    shortName: header.indexOf('nomereduzido'),
    ispb: header.indexOf('ispb'),
    cnpj: header.indexOf('cnpj'),
    institutionType: header.indexOf('tipodeinstituicao'),
    authorized: header.indexOf('autorizadapelobcb'),
    spiType: header.indexOf('tipodeparticipacaonospi'),
    pixType: header.indexOf('tipodeparticipacaonopix'),
    modality: header.indexOf('modalidadedeparticipacaonopix'),
  };
  for (const [name, index] of Object.entries(columns)) {
    if (index < 0) throw new Error(`Coluna esperada ausente no CSV do Pix: ${name}`);
  }

  const participants: PixParticipant[] = [];
  const seen = new Set<string>();
  let skippedNoIspb = 0;
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const first = (row[0] ?? '').trim();
    // The active table ends where the "em adesão" section (new title line) begins.
    if (!/^\d+$/.test(first)) break;

    const ispbDigits = (row[columns.ispb] ?? '').replace(/\D/g, '');
    if (!ispbDigits) {
      skippedNoIspb++;
      continue;
    }
    const ispb = ispbDigits.padStart(8, '0');
    if (seen.has(ispb)) continue;
    seen.add(ispb);

    participants.push({
      ispb,
      shortName: (row[columns.shortName] ?? '').trim(),
      cnpj: (row[columns.cnpj] ?? '').replace(/\D/g, '').padStart(14, '0'),
      pix: {
        spiParticipationType: (row[columns.spiType] ?? '').trim(),
        pixParticipationType: (row[columns.pixType] ?? '').trim(),
        modality: (row[columns.modality] ?? '').trim(),
        institutionType: (row[columns.institutionType] ?? '').trim(),
        authorizedByBcb: (row[columns.authorized] ?? '').trim().toLowerCase() === 'sim',
      },
    });
  }

  if (participants.length < minRows) {
    throw new Error(`Poucos participantes do Pix (${participants.length}); fonte suspeita.`);
  }
  return { participants, skippedNoIspb };
}

/**
 * Downloads the daily Pix participants CSV, walking back up to `maxDaysBack`
 * days from today (São Paulo time) — the BCB removes previous days' files,
 * and the current day's file may not exist yet around midnight.
 */
export async function fetchPixParticipants({
  timeoutMs = 30_000,
  maxDaysBack = 7,
}: {
  timeoutMs?: number;
  maxDaysBack?: number;
} = {}): Promise<{ participants: PixParticipant[]; skippedNoIspb: number; stamp: string }> {
  let lastError: unknown;
  for (let daysBack = 0; daysBack <= maxDaysBack; daysBack++) {
    const stamp = pixCsvDateStamp(new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000));
    try {
      const response = await fetchWithRetry(`${PIX_CSV_URL_BASE}${stamp}.csv`, {
        timeoutMs,
        attempts: 1,
      });
      const text = new TextDecoder('latin1').decode(await response.arrayBuffer());
      return { ...parsePixCsv(text), stamp };
    } catch (error) {
      lastError = error;
    }
  }
  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(
    `Lista de participantes do Pix indisponível nos últimos ${maxDaysBack + 1} dias: ${message}`,
  );
}

/**
 * Merges the two backbones by ISPB. STR wins names and provides the COMPE;
 * Pix contributes participation attributes and the COMPE-less institutions.
 */
export function mergeBackbone(
  strParticipants: StrParticipant[],
  pixParticipants: PixParticipant[],
): BackboneParticipant[] {
  const pixByIspb = new Map(pixParticipants.map((p) => [p.ispb, p]));
  const merged: BackboneParticipant[] = [];
  const seen = new Set<string>();

  for (const p of strParticipants) {
    if (seen.has(p.ispb)) continue;
    seen.add(p.ispb);
    merged.push({
      ispb: p.ispb,
      compe: p.compe,
      compe4: p.compe4,
      shortName: p.shortName,
      fullName: p.fullName,
      pix: pixByIspb.get(p.ispb)?.pix ?? null,
    });
  }
  for (const p of pixParticipants) {
    if (seen.has(p.ispb)) continue;
    seen.add(p.ispb);
    merged.push({
      ispb: p.ispb,
      compe: null,
      compe4: null,
      shortName: p.shortName,
      fullName: p.shortName,
      pix: p.pix,
    });
  }
  return merged;
}
