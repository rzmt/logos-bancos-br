/**
 * Classifies logo download/render failures so the weekly report separates
 * what needs a maintainer from what is just noise.
 *
 * - `broken`: the source itself is wrong (404, HTML page instead of an image,
 *   undecodable bytes...). Won't fix itself — fix the URL (forcedUris) or
 *   ignore it (denylistUris).
 * - `blocked`: network refusal or instability (403/429, WAF challenge,
 *   connection reset, timeout, 5xx). Common from GitHub Actions IPs; the
 *   previous asset keeps shipping. A local run usually gets through.
 * - `tls`: the institution's server has a certificate problem (e.g. it
 *   doesn't send the intermediate certificate). Only the institution can fix it.
 *
 * In every case the previously published asset is kept.
 */

export type FailureKind = 'broken' | 'blocked' | 'tls';

const TLS = /CERT_|_CERT|UNABLE_TO_(?:VERIFY|GET)|SELF_SIGNED|ERR_TLS|ERR_SSL|EPROTO|certificate/i;
const BLOCKED =
  /HTTP (?:401|403|429|5\d\d)\b|anti-bot|timeout|aborted|ECONNRESET|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|UND_ERR_(?:SOCKET|CONNECT_TIMEOUT|HEADERS_TIMEOUT|BODY_TIMEOUT)|other side closed/i;

export function classifyFailure(reason: string): FailureKind {
  if (TLS.test(reason)) return 'tls';
  // A bare "fetch failed" (no cause code) is a network problem, not a bad URL.
  if (BLOCKED.test(reason) || reason.trim() === 'fetch failed') return 'blocked';
  return 'broken';
}

export const FAILURE_KIND_ORDER: FailureKind[] = ['broken', 'tls', 'blocked'];

export const FAILURE_KIND_TITLE: Record<FailureKind, string> = {
  broken: 'Fonte quebrada — precisa de ação',
  tls: 'Certificado com problema no servidor da instituição',
  blocked: 'Bloqueio ou instabilidade de rede — normal no CI',
};

export const FAILURE_KIND_SHORT: Record<FailureKind, string> = {
  broken: 'fonte quebrada',
  tls: 'certificado',
  blocked: 'bloqueio de rede',
};

export const FAILURE_KIND_HINT: Record<FailureKind, string> = {
  broken:
    'A URL de origem não entrega uma imagem válida e não vai se resolver sozinha. Ache a URL oficial correta e coloque em `forcedUris` (ou ignore a URL via `denylistUris`).',
  tls: 'O servidor da instituição tem um problema de certificado (ex.: não envia o certificado intermediário). Só a instituição corrige; o asset anterior segue publicado.',
  blocked:
    'WAF/anti-bot recusando o IP (comum nos runners do GitHub) ou instabilidade passageira. O asset anterior segue publicado; para atualizar, rode `npm run pipeline` localmente (RUNBOOK).',
};
