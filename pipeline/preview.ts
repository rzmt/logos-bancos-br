/**
 * Builds PREVIEW.md — a human-reviewable gallery of every shipped logo,
 * rendered natively by GitHub. Regenerated on every pipeline run.
 */

import type { Dataset } from './types';

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|');
}

export function buildPreviewMarkdown(dataset: Dataset): string {
  const withLogo = dataset.banks.filter((bank) => bank.logo !== null);
  const withoutLogo = dataset.banks.filter((bank) => bank.logo === null);

  const lines: string[] = [
    '# Galeria de logos',
    '',
    '> Arquivo gerado automaticamente pelo pipeline (`npm run pipeline`) — não editar à mão.',
    '',
    `**${withLogo.length}** instituições com logo · **${withoutLogo.length}** sem logo nas fontes oficiais.`,
    '',
    '| Logo | COMPE | ISPB | Instituição | Fonte do logo |',
    '|---|---|---|---|---|',
  ];

  for (const bank of withLogo) {
    const logo = bank.logo;
    if (!logo) continue;
    const sourceLabel =
      logo.source.type === 'openfinance'
        ? `Open Finance — ${escapeCell(logo.source.org ?? '')}`
        : logo.source.type === 'direct-uri'
          ? 'URL direta (revisada)'
          : 'Override manual';
    const name = escapeCell(bank.shortName || bank.name);
    lines.push(
      `| <img src="${logo.png}" width="40" alt="${name}"> | ${bank.compe4} | ${bank.ispb} | ${name} | ${sourceLabel} |`,
    );
  }

  lines.push(
    '',
    `<details><summary>Instituições sem logo (${withoutLogo.length}) — consumidores devem usar um ícone genérico</summary>`,
    '',
  );
  for (const bank of withoutLogo) {
    lines.push(
      `- \`${bank.compe4}\` ${escapeCell(bank.shortName || bank.name)} (ISPB ${bank.ispb})`,
    );
  }
  lines.push('', '</details>', '');

  return lines.join('\n');
}
