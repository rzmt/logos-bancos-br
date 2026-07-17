/**
 * Official data sources.
 *
 * 1. Central Bank of Brazil — STR participants list (CSV, updated daily):
 *    the backbone. Defines which institutions exist, their ISPB, COMPE
 *    number ("Número-Código") and official names.
 * 2. Open Finance Brasil — participants directory (public JSON): each
 *    institution publishes and maintains its own logo
 *    (AuthorisationServers[].CustomerFriendlyLogoUri), identified by CNPJ.
 */

import { stripAccents } from './text';
import type { RawOrganisation, StrParticipant } from './types';

export const STR_CSV_URL =
  'https://www.bcb.gov.br/content/estabilidadefinanceira/str1/ParticipantesSTR.csv';
export const OPEN_FINANCE_DIRECTORY_URL =
  'https://data.directory.openbankingbrasil.org.br/participants';

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
export function parseCsv(text: string): string[][] {
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
    } else if (ch === ',') {
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
