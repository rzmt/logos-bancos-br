/**
 * Institution-name normalization and similarity.
 *
 * The two sources spell names differently ("BCO ITAÚ S.A." vs "Itaú Unibanco"),
 * so comparison happens over accent-less, stopword-free token sets.
 */

/** Generic corporate/banking words that carry no identity. */
const STOPWORDS = new Set([
  'banco',
  'bco',
  'brasil',
  'brasileiro',
  'brasileira',
  'sa',
  'ltda',
  'me',
  'cia',
  'companhia',
  'sociedade',
  'grupo',
  'credito',
  'creditos',
  'financiamento',
  'financiamentos',
  'investimento',
  'investimentos',
  'financeira',
  'financeiro',
  'cooperativa',
  'cooperativo',
  'cooperativas',
  'central',
  'confederacao',
  'instituicao',
  'pagamento',
  'pagamentos',
  'multiplo',
  'comercial',
  'nacional',
  'scd',
  'scfi',
  'dtvm',
  'ctvm',
  'ip',
  'cc',
  'de',
  'do',
  'da',
  'dos',
  'das',
  'e',
  'em',
  'para',
]);

/** Removes diacritics by dropping Unicode combining marks (U+0300..U+036F). */
export function stripAccents(value: string): string {
  let out = '';
  for (const ch of value.normalize('NFD')) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x0300 && code <= 0x036f) continue;
    out += ch;
  }
  return out;
}

/** Lowercased, accent-less, stopword-free set of identity-bearing tokens. */
export function tokenize(name: string): Set<string> {
  const clean = stripAccents(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const result = new Set<string>();
  if (!clean) return result;
  for (const token of clean.split(' ')) {
    if (token.length < 2) continue;
    if (STOPWORDS.has(token)) continue;
    result.add(token);
  }
  return result;
}

/** Jaccard similarity between two token sets (0..1). */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  return intersection / (a.size + b.size - intersection);
}
