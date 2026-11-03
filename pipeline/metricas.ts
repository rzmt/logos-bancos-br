/**
 * Registro semanal de métricas, rodado pelo workflow metricas.yml.
 *
 * A API do GitHub só guarda 14 dias de tráfego. Este script junta, nos CSVs
 * de uma pasta (o checkout da branch `metricas`), as visitas e os clones por
 * dia, as origens e as páginas mais vistas, e anota as estrelas.
 *
 * Uso: npm run metricas -- <pasta>
 *
 * TRAFFIC_TOKEN: token fine-grained só deste repositório, com Administration
 * somente leitura (o GITHUB_TOKEN do Actions não lê tráfego). Sem ele, o
 * script anota só as estrelas e avisa. GH_TOKEN, se houver, evita o limite de
 * chamadas anônimas na leitura das estrelas.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = process.env.GITHUB_REPOSITORY || 'rzmt/logos-bancos-br';

export interface DailyCount {
  timestamp: string;
  count: number;
  uniques: number;
}

interface Referrer {
  referrer: string;
  count: number;
  uniques: number;
}

interface PopularPath {
  path: string;
  count: number;
  uniques: number;
}

export const DAILY_HEADER = 'data,visualizacoes,visitantes,clones,clonadores';
export const REFERRERS_HEADER = 'data,origem,visualizacoes,visitantes';
export const PATHS_HEADER = 'data,pagina,visualizacoes,visitantes';
export const STARS_HEADER = 'data,estrelas,forks,observadores';

export function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function dataLines(csv: string): string[] {
  return csv
    .split('\n')
    .slice(1)
    .filter((line) => line.trim() !== '');
}

/**
 * Junta visitas e clones por dia ao CSV. Um dia visto em duas coletas fica
 * com o maior número, porque a ponta da janela de 14 dias pode vir parcial.
 */
export function mergeDaily(csv: string, views: DailyCount[], clones: DailyCount[]): string {
  const days = new Map<string, number[]>();
  for (const line of dataLines(csv)) {
    const [day, ...values] = line.split(',');
    if (day) days.set(day, values.map(Number));
  }
  const add = (items: DailyCount[], offset: number) => {
    for (const item of items) {
      const day = item.timestamp.slice(0, 10);
      const row = days.get(day) ?? [0, 0, 0, 0];
      row[offset] = Math.max(row[offset] ?? 0, item.count);
      row[offset + 1] = Math.max(row[offset + 1] ?? 0, item.uniques);
      days.set(day, row);
    }
  };
  add(views, 0);
  add(clones, 2);
  const rows = [...days.entries()].sort(([a], [b]) => a.localeCompare(b));
  return `${[DAILY_HEADER, ...rows.map(([day, values]) => [day, ...values].join(','))].join('\n')}\n`;
}

/**
 * Troca as linhas de uma data pelas novas. Rodar duas vezes no mesmo dia não
 * duplica nada.
 */
export function replaceSnapshot(
  csv: string,
  header: string,
  date: string,
  rows: (string | number)[][],
): string {
  const kept = dataLines(csv).filter((line) => line.split(',', 1)[0] !== date);
  const added = rows.map((row) => [date, ...row].map(csvCell).join(','));
  return `${[header, ...kept, ...added].join('\n')}\n`;
}

async function github<T>(path: string, token: string | undefined): Promise<T> {
  const response = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    headers: {
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) {
    const hint =
      path.startsWith('/traffic') && (response.status === 401 || response.status === 403)
        ? ' O TRAFFIC_TOKEN venceu ou não tem Administration: leitura neste repositório (RUNBOOK.md).'
        : '';
    throw new Error(`GET ${path || '/'}: ${response.status}.${hint}`);
  }
  return (await response.json()) as T;
}

function readCsv(dir: string, name: string): string {
  const file = join(dir, name);
  return existsSync(file) ? readFileSync(file, 'utf8') : '';
}

async function main(): Promise<void> {
  const dir = process.argv[2];
  if (!dir) throw new Error('uso: npm run metricas -- <pasta>');
  const today = new Date().toISOString().slice(0, 10);

  const repo = await github<{
    stargazers_count: number;
    forks_count: number;
    subscribers_count: number;
  }>('', process.env.GH_TOKEN || undefined);
  const stars = [repo.stargazers_count, repo.forks_count, repo.subscribers_count];
  writeFileSync(
    join(dir, 'estrelas.csv'),
    replaceSnapshot(readCsv(dir, 'estrelas.csv'), STARS_HEADER, today, [stars]),
  );
  console.log(`estrelas: ${stars[0]}`);

  const token = process.env.TRAFFIC_TOKEN || undefined;
  if (!token) {
    console.log('::warning::Sem o secret TRAFFIC_TOKEN: anotei só as estrelas (RUNBOOK.md).');
    return;
  }

  const [views, clones, referrers, paths] = await Promise.all([
    github<{ views: DailyCount[] }>('/traffic/views?per=day', token),
    github<{ clones: DailyCount[] }>('/traffic/clones?per=day', token),
    github<Referrer[]>('/traffic/popular/referrers', token),
    github<PopularPath[]>('/traffic/popular/paths', token),
  ]);

  writeFileSync(
    join(dir, 'diario.csv'),
    mergeDaily(readCsv(dir, 'diario.csv'), views.views, clones.clones),
  );
  writeFileSync(
    join(dir, 'origens.csv'),
    replaceSnapshot(
      readCsv(dir, 'origens.csv'),
      REFERRERS_HEADER,
      today,
      referrers.map((r) => [r.referrer, r.count, r.uniques]),
    ),
  );
  writeFileSync(
    join(dir, 'paginas.csv'),
    replaceSnapshot(
      readCsv(dir, 'paginas.csv'),
      PATHS_HEADER,
      today,
      paths.map((p) => [p.path, p.count, p.uniques]),
    ),
  );
  console.log(
    `tráfego: ${views.views.length} dias de visitas, ${referrers.length} origens, ${paths.length} páginas`,
  );
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
