/**
 * Builds PREVIEW.md — a human-reviewable gallery rendered natively by GitHub.
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
    const name = escapeCell(institution.shortName || institution.name);
    lines.push(
      `| <img src="${logo.png}" width="40" alt="${name}"> | ${institution.compe4 ?? '—'} | ${institution.ispb} | ${name} | ${sourceLabel(institution)} |`,
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
          `- \`${member.compe4 ?? '——'}\` ${escapeCell(member.shortName || member.name)} (ISPB ${member.ispb})`,
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
      `- \`${institution.compe4 ?? '——'}\` ${escapeCell(institution.shortName || institution.name)} (ISPB ${institution.ispb})`,
    );
  }
  lines.push('', '</details>', '');

  return lines.join('\n');
}
