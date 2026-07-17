/**
 * Logo collection pipeline — orchestration.
 *
 * Official sources only: Central Bank STR participants (backbone: ISPB +
 * COMPE + names) and the Open Finance Brasil directory (logos by CNPJ).
 *
 * Usage:
 *   npm run pipeline
 *   npm run pipeline -- --dry-run        # nothing is written; report only
 *   npm run pipeline -- --only 341,0260  # subset by COMPE or ISPB (debugging)
 *   npm run pipeline -- --force          # re-download/re-encode everything
 *
 * Golden rules: if a source is unreachable, abort without touching anything;
 * a failed download never deletes a previously shipped logo; files that lose
 * their source become "orphans" in the report (removal is manual).
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildDataset, toDatasetJson } from './dataset';
import { downloadLogo, isSafeSvg, looksLikeSvg, rasterize, sha256, writeIfChanged } from './images';
import { buildMatches } from './matching';
import { buildPreviewMarkdown } from './preview';
import { buildReactNativeMap } from './rn-map';
import { fetchOpenFinanceDirectory, fetchStrParticipants } from './sources';
import type { Manifest, ManifestEntry, MatchEntry, PipelineConfig } from './types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PNG_DIR = join(ROOT, 'logos', 'png');
const SVG_DIR = join(ROOT, 'logos', 'svg');
const OVERRIDES_DIR = join(__dirname, 'overrides');
const CONFIG_PATH = join(__dirname, 'config.json');
const MANIFEST_PATH = join(__dirname, 'manifest.json');
const REPORT_PATH = join(__dirname, 'report.md');
const DATASET_PATH = join(ROOT, 'data', 'bancos.json');
const PREVIEW_PATH = join(ROOT, 'PREVIEW.md');
const RN_MAP_PATH = join(ROOT, 'react-native.js');

const DEFAULT_CONFIG: PipelineConfig = {
  pngSizePx: 256,
  maxDownloadBytes: 2 * 1024 * 1024,
  timeoutMs: 15_000,
  concurrency: 5,
  nameSuggestionThreshold: 0.5,
  denylistUris: [],
  forcedUris: {},
  forcedMatches: {},
  ignoreIspb: [],
};

// ---- CLI flags ----
const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const force = argv.includes('--force');
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

// ---- helpers ----
function readJson<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function loadOverrides(): Map<string, string> {
  const map = new Map<string, string>();
  if (!existsSync(OVERRIDES_DIR)) return map;
  for (const file of readdirSync(OVERRIDES_DIR)) {
    const match = file.match(/^(\d{8})\.(png|svg|jpe?g|webp)$/i);
    if (match?.[1]) map.set(match[1], join(OVERRIDES_DIR, file));
  }
  return map;
}

function listIspbFiles(dir: string, extension: string): string[] {
  if (!existsSync(dir)) return [];
  const pattern = new RegExp(`^\\d{8}\\.${extension}$`);
  return readdirSync(dir).filter((file) => pattern.test(file));
}

function dirSizeBytes(dir: string): number {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).reduce((total, file) => total + statSync(join(dir, file)).size, 0);
}

function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

async function withConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (index < items.length) {
      const i = index++;
      await fn(items[i] as T);
    }
  });
  await Promise.all(workers);
}

interface Failure {
  compe4: string;
  ispb: string;
  reason: string;
}

interface Stats {
  created: string[];
  updated: string[];
  unchanged: string[];
  noLogo: string[];
  keptWithoutSource: string[];
  failed: Failure[];
  large: Array<{ compe4: string; bytes: number }>;
  svgRejected: string[];
}

// ---- main ----
async function main(): Promise<void> {
  const config: PipelineConfig = {
    ...DEFAULT_CONFIG,
    ...readJson<Partial<PipelineConfig>>(CONFIG_PATH, {}),
  };
  const oldManifest = readJson<Manifest>(MANIFEST_PATH, {});
  const overrides = loadOverrides();
  const today = new Date().toISOString().slice(0, 10);

  console.log(`Atualizando logos de bancos${dryRun ? ' (dry-run)' : ''}...`);
  console.log('Baixando fontes oficiais (BCB/STR + diretório Open Finance)...');
  let participants: Awaited<ReturnType<typeof fetchStrParticipants>>;
  let directory: Awaited<ReturnType<typeof fetchOpenFinanceDirectory>>;
  try {
    [participants, directory] = await Promise.all([
      fetchStrParticipants({ timeoutMs: 30_000 }),
      fetchOpenFinanceDirectory({ timeoutMs: 30_000 }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n✖ Não foi possível baixar as fontes: ${message}`);
    console.error('  Nada foi alterado.');
    process.exit(1);
  }
  console.log(`  BCB/STR: ${participants.length} instituições com código COMPE.`);
  console.log(`  Open Finance: ${directory.length} organizações no diretório.`);
  console.log(`  Overrides locais: ${overrides.size}.`);

  const { entries, suggestions, unusedOverrides } = buildMatches({
    participants,
    directory,
    config,
    overrides,
  });

  const bySource: Record<string, number> = {};
  for (const entry of entries) {
    const key = entry.source ?? 'none';
    bySource[key] = (bySource[key] ?? 0) + 1;
  }

  const targets = only
    ? entries.filter((entry) => only.has(entry.compe4) || only.has(entry.ispb))
    : entries;

  if (!dryRun) {
    mkdirSync(PNG_DIR, { recursive: true });
    mkdirSync(SVG_DIR, { recursive: true });
    mkdirSync(dirname(DATASET_PATH), { recursive: true });
  }

  const stats: Stats = {
    created: [],
    updated: [],
    unchanged: [],
    noLogo: [],
    keptWithoutSource: [],
    failed: [],
    large: [],
    svgRejected: [],
  };
  const newManifest: Manifest = {};

  await withConcurrency(targets, config.concurrency, async (entry: MatchEntry) => {
    const pngPath = join(PNG_DIR, `${entry.ispb}.png`);
    const svgPath = join(SVG_DIR, `${entry.ispb}.svg`);
    const pngExists = existsSync(pngPath);
    const previous = oldManifest[entry.ispb];

    const carryPrevious = () => {
      if (pngExists && previous) newManifest[entry.ispb] = previous;
    };

    if (!entry.source) {
      if (pngExists) {
        stats.keptWithoutSource.push(entry.compe4);
        carryPrevious();
      } else {
        stats.noLogo.push(entry.compe4);
      }
      return;
    }

    let bytes: Buffer;
    let refUri: string;
    try {
      if (entry.source === 'override') {
        const file = overrides.get(entry.ispb);
        if (!file) throw new Error('override desapareceu durante a execução');
        bytes = readFileSync(file);
        refUri = `override:${basename(file)}`;
      } else {
        if (!entry.uri) throw new Error('entrada sem URI');
        bytes = await downloadLogo(entry.uri, {
          maxBytes: config.maxDownloadBytes,
          timeoutMs: config.timeoutMs,
        });
        refUri = entry.uri;
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      stats.failed.push({ compe4: entry.compe4, ispb: entry.ispb, reason });
      carryPrevious();
      return;
    }

    const hash = sha256(bytes);
    const isSvg = looksLikeSvg(bytes);
    const svgSafe = isSvg && isSafeSvg(bytes.toString('utf8'));
    if (isSvg && !svgSafe) stats.svgRejected.push(entry.compe4);

    const svgConsistent = !svgSafe || existsSync(svgPath);
    if (!force && previous && previous.sourceSha256 === hash && pngExists && svgConsistent) {
      stats.unchanged.push(entry.compe4);
      newManifest[entry.ispb] = { ...previous, compe4: entry.compe4 };
      return;
    }

    let png: Buffer;
    try {
      png = await rasterize(bytes, { sizePx: config.pngSizePx });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      stats.failed.push({
        compe4: entry.compe4,
        ispb: entry.ispb,
        reason: `rasterizar: ${reason}`,
      });
      carryPrevious();
      return;
    }

    if (png.byteLength > 25 * 1024)
      stats.large.push({ compe4: entry.compe4, bytes: png.byteLength });

    if (dryRun) {
      stats[pngExists ? 'updated' : 'created'].push(entry.compe4);
    } else {
      const status = writeIfChanged(pngPath, png);
      if (svgSafe) writeIfChanged(svgPath, bytes);
      stats[status].push(entry.compe4);
    }

    newManifest[entry.ispb] = {
      compe4: entry.compe4,
      org: entry.orgName,
      cnpj: entry.orgCnpj,
      uri: refUri,
      sourceSha256: hash,
      svg: svgSafe,
      updatedAt: previous && previous.sourceSha256 === hash ? previous.updatedAt : today,
    };
  });

  // Orphans: files on disk whose ISPB is no longer in the backbone (manual removal).
  const currentIspbs = new Set(entries.map((entry) => entry.ispb));
  const orphanPngs = listIspbFiles(PNG_DIR, 'png')
    .map((file) => file.slice(0, 8))
    .filter((ispb) => !currentIspbs.has(ispb));
  const orphanSvgs = listIspbFiles(SVG_DIR, 'svg')
    .map((file) => file.slice(0, 8))
    .filter((ispb) => !currentIspbs.has(ispb));

  const manifestFinal: Manifest = only ? { ...oldManifest, ...newManifest } : newManifest;
  const sortedManifest: Manifest = {};
  for (const key of Object.keys(manifestFinal).sort()) {
    sortedManifest[key] = manifestFinal[key] as ManifestEntry;
  }

  const pngIspbs = new Set(listIspbFiles(PNG_DIR, 'png').map((file) => file.slice(0, 8)));
  const svgIspbs = new Set(listIspbFiles(SVG_DIR, 'svg').map((file) => file.slice(0, 8)));
  const dataset = buildDataset({ entries, manifest: sortedManifest, pngIspbs, svgIspbs });

  let generatedFiles = 'não gerados (dry-run)';
  if (!dryRun) {
    const datasetStatus = writeIfChanged(DATASET_PATH, toDatasetJson(dataset));
    const previewStatus = writeIfChanged(PREVIEW_PATH, buildPreviewMarkdown(dataset));
    const rnStatus = writeIfChanged(RN_MAP_PATH, buildReactNativeMap(dataset.banks));
    writeFileSync(MANIFEST_PATH, `${JSON.stringify(sortedManifest, null, 2)}\n`);
    generatedFiles = `bancos.json ${datasetStatus} · PREVIEW.md ${previewStatus} · react-native.js ${rnStatus}`;
  }

  // ---- report ----
  const withLogo = dataset.banks.filter((bank) => bank.logo !== null).length;
  const totalSize = dirSizeBytes(PNG_DIR) + dirSizeBytes(SVG_DIR);

  const reportLines: string[] = [
    '## Atualização de logos — relatório',
    '',
    `Fontes oficiais: lista de participantes do STR (Banco Central) + diretório de participantes do Open Finance Brasil. Rodada de ${today}${dryRun ? ' (dry-run)' : ''}.`,
    '',
    '| Métrica | Valor |',
    '|---|---|',
    `| Instituições na espinha (STR com COMPE) | ${entries.length} |`,
    `| Com logo | ${withLogo} |`,
    `| Match automático por ISPB | ${bySource.ispb ?? 0} |`,
    `| Matches forçados (revisados) | ${(bySource['forced-match'] ?? 0) + (bySource['forced-uri'] ?? 0)} |`,
    `| Overrides manuais | ${bySource.override ?? 0} |`,
    `| Novos · atualizados · inalterados | ${stats.created.length} · ${stats.updated.length} · ${stats.unchanged.length} |`,
    `| Sem logo nas fontes | ${stats.noLogo.length} |`,
    `| Mantidos sem fonte atual | ${stats.keptWithoutSource.length} |`,
    `| Falhas de download/render (asset anterior mantido) | ${stats.failed.length} |`,
    `| Sugestões por nome (não gravadas) | ${suggestions.length} |`,
    `| Órfãos (png/svg sem instituição) | ${orphanPngs.length}/${orphanSvgs.length} |`,
    `| Tamanho total dos logos | ${kb(totalSize)} |`,
  ];

  if (stats.created.length) reportLines.push('', `**Novos:** ${stats.created.sort().join(', ')}`);
  if (stats.updated.length)
    reportLines.push('', `**Atualizados:** ${stats.updated.sort().join(', ')}`);
  if (stats.failed.length) {
    reportLines.push('', '### Falhas (asset anterior mantido)', '');
    for (const failure of stats.failed) {
      reportLines.push(`- \`${failure.compe4}\` (ISPB ${failure.ispb}): ${failure.reason}`);
    }
  }
  if (stats.svgRejected.length) {
    reportLines.push(
      '',
      `**SVGs rejeitados pela sanitização (apenas PNG distribuído):** ${stats.svgRejected.sort().join(', ')}`,
    );
  }
  if (suggestions.length) {
    reportLines.push(
      '',
      '### Sugestões por nome (revisar e promover a `forcedMatches` em pipeline/config.json)',
      '',
      '| COMPE | ISPB | Nome (BCB) | Organização (Open Finance) | CNPJ | Score |',
      '|---|---|---|---|---|---|',
    );
    for (const suggestion of suggestions) {
      reportLines.push(
        `| ${suggestion.compe4} | ${suggestion.ispb} | ${suggestion.strName} | ${suggestion.orgName} | ${suggestion.cnpj} | ${suggestion.score} |`,
      );
    }
  }
  if (orphanPngs.length || orphanSvgs.length) {
    reportLines.push(
      '',
      `**Órfãos (remoção manual):** png [${orphanPngs.join(', ')}] · svg [${orphanSvgs.join(', ')}]`,
    );
  }
  if (unusedOverrides.length) {
    reportLines.push(
      '',
      `**Overrides sem instituição correspondente no STR:** ${unusedOverrides.join(', ')}`,
    );
  }
  reportLines.push('');
  writeFileSync(REPORT_PATH, reportLines.join('\n'));

  // ---- console summary ----
  console.log('\n──────────── Resumo ────────────');
  console.log(`Instituições (espinha STR):  ${entries.length}`);
  console.log(`Com logo:                    ${withLogo}${dryRun ? ' (estimado)' : ''}`);
  console.log(
    `  ↳ ISPB ${bySource.ispb ?? 0} · forçados ${(bySource['forced-match'] ?? 0) + (bySource['forced-uri'] ?? 0)} · override ${bySource.override ?? 0}`,
  );
  console.log(
    `  ↳ novos ${stats.created.length} · atualizados ${stats.updated.length} · inalterados ${stats.unchanged.length}`,
  );
  console.log(`Sem logo (fallback do app):  ${stats.noLogo.length}`);
  console.log(`Mantidos sem fonte:          ${stats.keptWithoutSource.length}`);
  console.log(`Falhas (mantidos):           ${stats.failed.length}`);
  console.log(
    `Sugestões por nome:          ${suggestions.length} (revisar; ver pipeline/report.md)`,
  );
  console.log(`Órfãos png/svg:              ${orphanPngs.length}/${orphanSvgs.length}`);
  console.log(`Tamanho total dos logos:     ${kb(totalSize)}`);
  console.log(`Arquivos gerados:            ${generatedFiles}`);
  console.log(`Relatório:                   pipeline/report.md`);

  if (stats.failed.length) {
    console.log(`\n✖ Falhas (${stats.failed.length}) — asset anterior mantido:`);
    for (const failure of stats.failed.slice(0, 40)) {
      console.log(`  ${failure.compe4} (ISPB ${failure.ispb}): ${failure.reason}`);
    }
  }
  if (suggestions.length) {
    console.log(`\n⚠ Sugestões por NOME (não gravadas — top 20 de ${suggestions.length}):`);
    for (const suggestion of suggestions.slice(0, 20)) {
      console.log(
        `  ${suggestion.compe4} "${suggestion.strName}" → "${suggestion.orgName}" [cnpj ${suggestion.cnpj}] (score ${suggestion.score})`,
      );
    }
  }
  console.log('');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
