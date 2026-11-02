/**
 * Builds PREVIEW.md — a human-reviewable gallery rendered natively by GitHub —
 * and logos/README.md, the name index GitHub shows when someone opens the
 * logos/ folder (the files there are named by ISPB only).
 *
 * Institutions with their OWN logo appear in the gallery; cooperative-system
 * affiliates (which share the system's logo) are grouped into one card per
 * brand, so the page shows each distinct image once. Regenerated on every
 * pipeline run.
 */

import type { Bank, Dataset, PixDataset, PixInstitution } from './types';

type AnyInstitution = Bank | PixInstitution;

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|');
}

function fold(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Name shown in the markdown pages: the curated popular name plus the BCB
 * short name, so a search finds "Nubank" and "NU PAGAMENTOS" alike.
 */
export function displayLabel(institution: AnyInstitution): string {
  const official = institution.shortName || institution.name;
  const popular = institution.displayName;
  if (!popular) return official;
  return fold(popular) === fold(official) ? popular : `${popular} (${official})`;
}

// Same labels as the gallery (pipeline/gallery.ts, BRAND_NAMES).
const BRAND_LABELS: Record<string, string> = {
  SICOOB: 'Sicoob',
  SICREDI: 'Sicredi',
  CRESOL: 'Cresol',
  UNICRED: 'Unicred',
};

function brandLabel(token: string): string {
  return BRAND_LABELS[token] ?? token.charAt(0) + token.slice(1).toLowerCase();
}

function sourceLabel(institution: AnyInstitution): string {
  const logo = institution.logo;
  if (!logo) return '';
  switch (logo.source.type) {
    case 'openfinance':
      return `Open Finance — ${escapeCell(logo.source.org ?? '')}`;
    case 'direct-uri':
      return 'Site oficial (revisado)';
    case 'override':
      return 'Override manual';
    case 'brand':
      return `Sistema ${logo.source.brand ?? ''}`;
  }
}

export function buildPreviewMarkdown(dataset: Dataset, pixDataset: PixDataset): string {
  const all: AnyInstitution[] = [...dataset.banks, ...pixDataset.institutions];
  const ownLogo = all.filter((i) => i.logo && i.logo.source.type !== 'brand');
  const brandLogo = all.filter((i) => i.logo?.source.type === 'brand');
  const withoutLogo = all.filter((i) => !i.logo);

  const byBrand = new Map<string, AnyInstitution[]>();
  for (const institution of brandLogo) {
    const brand = institution.logo?.source.brand ?? '?';
    byBrand.set(brand, [...(byBrand.get(brand) ?? []), institution]);
  }

  const lines: string[] = [
    '# Galeria de logos',
    '',
    '> Arquivo gerado automaticamente pelo pipeline (`npm run pipeline`) — não editar à mão.',
    '',
    `**${ownLogo.length}** instituições com logo próprio · **${brandLogo.length}** afiliadas usando o logo do seu sistema cooperativo · **${withoutLogo.length}** sem logo nas fontes oficiais.`,
    '',
    '## Logos próprios',
    '',
    '| Logo | COMPE | ISPB | Instituição | Fonte do logo |',
    '|---|---|---|---|---|',
  ];

  for (const institution of ownLogo) {
    const logo = institution.logo;
    if (!logo) continue;
    const alt = escapeCell(institution.displayName || institution.shortName || institution.name);
    lines.push(
      `| <img src="${logo.png}" width="40" alt="${alt}"> | ${institution.compe4 ?? '—'} | ${institution.ispb} | ${escapeCell(displayLabel(institution))} | ${sourceLabel(institution)} |`,
    );
  }

  if (byBrand.size > 0) {
    lines.push(
      '',
      '## Sistemas cooperativos',
      '',
      'Afiliadas de sistemas de marca única usam o logo do sistema (regra curada — um único arquivo por marca):',
      '',
    );
    for (const [brand, members] of [...byBrand.entries()].sort((a, b) =>
      a[0].localeCompare(b[0]),
    )) {
      const png = members[0]?.logo?.png;
      lines.push(
        `### ${brand}`,
        '',
        `<img src="${png}" width="56" alt="${brand}"> — usado por **${members.length}** afiliada(s).`,
        '',
        `<details><summary>Ver afiliadas (${members.length})</summary>`,
        '',
      );
      for (const member of members) {
        lines.push(
          `- \`${member.compe4 ?? '——'}\` ${escapeCell(displayLabel(member))} (ISPB ${member.ispb})`,
        );
      }
      lines.push('', '</details>', '');
    }
  }

  lines.push(
    '',
    `<details><summary>Instituições sem logo (${withoutLogo.length}) — consumidores devem usar um ícone genérico</summary>`,
    '',
  );
  for (const institution of withoutLogo) {
    lines.push(
      `- \`${institution.compe4 ?? '——'}\` ${escapeCell(displayLabel(institution))} (ISPB ${institution.ispb})`,
    );
  }
  lines.push('', '</details>', '');

  return lines.join('\n');
}

interface IndexRow {
  label: string;
  compe: string;
  ispb: string;
  png: string;
  svg: string | null;
}

/** Link relative to logos/README.md ("logos/png/x.png" -> "png/x.png"). */
function fromLogosDir(path: string): string {
  return path.replace(/^logos\//, '');
}

/**
 * Builds logos/README.md: every distinct logo file by institution name, in
 * alphabetical order. Cooperative affiliates that share their system's logo
 * get one row per system. The file stays out of the npm package ("files" in
 * package.json lists only logos/png and logos/svg).
 */
export function buildLogoIndexMarkdown(dataset: Dataset, pixDataset: PixDataset): string {
  const all: AnyInstitution[] = [...dataset.banks, ...pixDataset.institutions];
  const rows: IndexRow[] = [];
  const brands = new Map<string, IndexRow>();

  for (const institution of all) {
    const logo = institution.logo;
    if (!logo) continue;
    if (logo.source.type === 'brand') {
      const token = logo.source.brand ?? '?';
      if (!brands.has(token)) {
        brands.set(token, {
          label: `${brandLabel(token)} (sistema cooperativo)`,
          compe: '',
          ispb: '',
          png: logo.png,
          svg: logo.svg,
        });
      }
      continue;
    }
    rows.push({
      label: displayLabel(institution),
      compe: institution.compe4 ?? '',
      ispb: institution.ispb,
      png: logo.png,
      svg: logo.svg,
    });
  }
  rows.push(...brands.values());

  const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });
  rows.sort((a, b) => collator.compare(a.label, b.label) || a.ispb.localeCompare(b.ispb));

  const systems = [...brands.keys()].map(brandLabel).sort(collator.compare);
  const systemsText =
    systems.length > 1
      ? `${systems.slice(0, -1).join(', ')} e ${systems.at(-1)}`
      : (systems[0] ?? '');

  const lines: string[] = [
    '# Logos por nome',
    '',
    'Arquivo gerado pelo pipeline (`npm run pipeline`). Não edite à mão.',
    '',
    'Os arquivos têm o ISPB da instituição no nome: `png/<ispb>.png` (quadrado de 256 px, fundo transparente) e, quando a fonte tem vetor, `svg/<ispb>.svg`.',
  ];
  if (systemsText) {
    lines.push(
      `As cooperativas de ${systemsText} usam o logo do sistema, que aparece numa linha só.`,
    );
  }
  lines.push(
    'Para ver as imagens, use a [galeria com busca](https://rzmt.github.io/logos-bancos-br/) ou o [PREVIEW.md](../PREVIEW.md).',
    '',
    '| Instituição | COMPE | ISPB | Arquivos |',
    '|---|---|---|---|',
  );
  for (const row of rows) {
    const files = [`[png](${fromLogosDir(row.png)})`];
    if (row.svg) files.push(`[svg](${fromLogosDir(row.svg)})`);
    lines.push(`| ${escapeCell(row.label)} | ${row.compe} | ${row.ispb} | ${files.join(' · ')} |`);
  }
  lines.push('');
  return lines.join('\n');
}
