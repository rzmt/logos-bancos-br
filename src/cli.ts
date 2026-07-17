#!/usr/bin/env node
/**
 * CLI: vendoriza logos em qualquer projeto (qualquer stack) e lista o dataset.
 *
 *   npx logos-bancos-br copy --dest ./assets/banks [--format png|svg|both]
 *                            [--by compe|ispb] [--only 341,001,60701190]
 *   npx logos-bancos-br list [--json]
 */

import { parseArgs } from 'node:util';
import { banks, version } from './index';
import { copyLogos } from './node';

const HELP = `logos-bancos-br v${version} — logos e dados de bancos brasileiros (fontes oficiais)

Uso:
  logos-bancos-br copy --dest <dir> [--format png|svg|both] [--by compe|ispb] [--only 341,001]
      Copia os logos para um diretório do seu projeto (qualquer stack).
      --format  png (padrão), svg ou both
      --by      nome dos arquivos: compe (0341.png, padrão) ou ispb (60701190.png)
      --only    restringe a códigos COMPE/ISPB separados por vírgula

  logos-bancos-br list [--json]
      Lista as instituições (COMPE, ISPB, nome, se há logo). --json emite o dataset.

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
    if (result.skippedNoSvg.length) {
      console.log(
        `${result.skippedNoSvg.length} instituição(ões) sem SVG seguro (só PNG): ${result.skippedNoSvg.join(', ')}`,
      );
    }
    break;
  }

  case 'list': {
    const { values } = parseArgs({ args: rest, options: { json: { type: 'boolean' } } });
    const all = banks();
    if (values.json) {
      console.log(JSON.stringify({ banks: all }, null, 2));
      break;
    }
    for (const bank of all) {
      const marker = bank.logo ? '●' : '·';
      console.log(`${marker} ${bank.compe4}  ${bank.ispb}  ${bank.shortName || bank.name}`);
    }
    const withLogo = all.filter((bank) => bank.logo).length;
    console.log(`\n${all.length} instituições · ${withLogo} com logo (●)`);
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
