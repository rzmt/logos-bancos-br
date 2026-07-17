#!/usr/bin/env node
/**
 * CLI: vendoriza logos em qualquer projeto (qualquer stack) e lista o dataset.
 *
 *   npx logos-bancos-br copy --dest ./assets/banks [--format png|svg|both]
 *                            [--by compe|ispb] [--only 341,001,60701190]
 *   npx logos-bancos-br list [--json]
 */

import { parseArgs } from 'node:util';
import { banks, pixInstitutions, version } from './index';
import { copyLogos } from './node';

const HELP = `logos-bancos-br v${version} — logos e dados de bancos brasileiros (fontes oficiais)

Uso:
  logos-bancos-br copy --dest <dir> [--format png|svg|both] [--by compe|ispb] [--only 341,001]
      Copia os logos para um diretório do seu projeto (qualquer stack).
      --format  png (padrão), svg ou both
      --by      nome dos arquivos: compe (0341.png, padrão) ou ispb (60701190.png)
      --only    restringe a códigos COMPE/ISPB separados por vírgula

  logos-bancos-br list [--all] [--json]
      Lista a lista principal (instituições com COMPE). --all inclui também as
      instituições só-Pix (sem COMPE). --json emite o(s) dataset(s).

  logos-bancos-br help
`;

function fail(message: string): never {
  console.error(`erro: ${message}\n`);
  console.error(HELP);
  process.exit(1);
}

const [command, ...rest] = process.argv.slice(2);

switch (command) {
  case 'copy': {
    const { values } = parseArgs({
      args: rest,
      options: {
        dest: { type: 'string' },
        format: { type: 'string', default: 'png' },
        by: { type: 'string', default: 'compe' },
        only: { type: 'string' },
      },
    });
    if (!values.dest) fail('--dest é obrigatório em `copy`');
    if (!['png', 'svg', 'both'].includes(values.format ?? '')) {
      fail(`--format inválido: ${values.format}`);
    }
    if (!['compe', 'ispb'].includes(values.by ?? '')) fail(`--by inválido: ${values.by}`);

    const only = values.only
      ? values.only
          .split(',')
          .map((token) => token.trim())
          .filter(Boolean)
      : undefined;
    const result = copyLogos({
      dest: values.dest,
      format: values.format as 'png' | 'svg' | 'both',
      by: values.by as 'compe' | 'ispb',
      only,
    });
    console.log(`${result.copied.length} arquivo(s) copiado(s) para ${values.dest}`);
    if (result.skippedNoCompe.length) {
      console.log(
        `${result.skippedNoCompe.length} instituição(ões) sem código COMPE ignorada(s) — use --by ispb para incluí-las.`,
      );
    }
    if (result.skippedNoSvg.length) {
      console.log(
        `${result.skippedNoSvg.length} instituição(ões) sem SVG seguro (só PNG): ${result.skippedNoSvg.join(', ')}`,
      );
    }
    break;
  }

  case 'list': {
    const { values } = parseArgs({
      args: rest,
      options: { json: { type: 'boolean' }, all: { type: 'boolean' } },
    });
    if (values.json) {
      const payload = values.all
        ? { banks: banks(), pixInstitutions: pixInstitutions() }
        : { banks: banks() };
      console.log(JSON.stringify(payload, null, 2));
      break;
    }

    for (const bank of banks()) {
      const marker = bank.logo ? '●' : '·';
      console.log(`${marker} ${bank.compe4}  ${bank.ispb}  ${bank.shortName || bank.name}`);
    }
    const mainWithLogo = banks().filter((bank) => bank.logo).length;
    console.log(
      `\n${banks().length} instituições na lista principal · ${mainWithLogo} com logo (●)`,
    );

    const pix = pixInstitutions();
    if (values.all) {
      console.log('\n── Instituições só-Pix (sem COMPE) ──');
      for (const institution of pix) {
        const marker = institution.logo ? '●' : '·';
        console.log(
          `${marker} ----  ${institution.ispb}  ${institution.shortName || institution.name}`,
        );
      }
      console.log(
        `\n${pix.length} instituições só-Pix · ${pix.filter((i) => i.logo).length} com logo (●)`,
      );
    } else {
      const byBrand = new Map<string, number>();
      let other = 0;
      for (const institution of pix) {
        const brand =
          institution.logo?.source.type === 'brand' ? institution.logo.source.brand : null;
        if (brand) byBrand.set(brand, (byBrand.get(brand) ?? 0) + 1);
        else other++;
      }
      const parts = [...byBrand.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([brand, count]) => `${brand} ${count}`);
      console.log(
        `+ ${pix.length} instituições só-Pix em instituicoes-pix.json` +
          (parts.length ? ` (afiliadas: ${parts.join(', ')}; outras: ${other})` : '') +
          ' — use --all para listar',
      );
    }
    break;
  }

  case 'help':
  case '--help':
  case '-h':
  case undefined:
    console.log(HELP);
    break;

  default:
    fail(`comando desconhecido: ${command}`);
}
