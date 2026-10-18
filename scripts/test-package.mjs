// Testa o pacote como ele chega ao usuário: empacota com `npm pack`, instala o
// tarball num projeto consumidor temporário (offline) e usa o que foi
// publicado — o entry principal sem nada do Node (é o da web e do React
// Native), require()/import dos entry points, `logos-bancos-br/node` (caminhos
// dos assets num diretório com espaço, '#' e '%'), subpaths de dados, CLI,
// require() do react-native.js e os tipos (tsc do repositório em node16
// ESM/CJS e bundler). Os testes de tests/ importam ../src direto e não
// enxergam um build quebrado.
//
// Uso: npm run build && npm run test:package

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { builtinModules } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join, posix, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const lerJson = (caminho) => JSON.parse(readFileSync(caminho, 'utf8'));
const PKG = lerJson(join(RAIZ, 'package.json'));
const TSC = join(RAIZ, 'node_modules', 'typescript', 'bin', 'tsc');
// Tempo máximo de cada comando filho (npm, tsc, sondas).
const LIMITE_MS = 5 * 60 * 1000;

// ── sondas de runtime (escritas no projeto consumidor) ──────────────────────

// Corpo comum das sondas CJS e ESM: elas só carregam o pacote instalado e
// relatam o que viram; as asserções ficam em conferirSonda().
const CORPO_SONDA = `
(async () => {
  const bancos = await carregar('logos-bancos-br/data/bancos.json');
  const pix = await carregar('logos-bancos-br/data/instituicoes-pix.json');
  const cdnIndex = await carregar('logos-bancos-br/data/cdn-index.min.json');
  const logoUrls = await carregar('logos-bancos-br/data/logo-urls.min.json');
  const pkg = await carregar('logos-bancos-br/package.json');
  const copia = node.copyLogos({ dest: process.argv[2], only: ['341'] });
  const relato = {
    resolvido: {
      main: resolver('logos-bancos-br'),
      node: resolver('logos-bancos-br/node'),
      reactNative: resolver('logos-bancos-br/react-native'),
    },
    version: main.version,
    versionPackageJson: pkg.version,
    logoItau: main.byCompe('341')?.logo?.png ?? null,
    displayNameBb: main.byIspb('00000000')?.displayName,
    pngItau: node.logoPngPath('341'),
    svgItau: node.logoSvgPath('60701190'),
    copiados: copia.copied,
    contagens: {
      banks: main.banks().length,
      pixInstitutions: main.pixInstitutions().length,
      displayNames: main.allInstitutions().filter((i) => i.displayName != null).length,
      'data/bancos.json': bancos.banks.length,
      'data/instituicoes-pix.json': pix.institutions.length,
      'data/cdn-index.min.json': Object.keys(cdnIndex.institutions).length,
      'data/logo-urls.min.json': Object.keys(logoUrls).length,
    },
  };
  process.stdout.write(JSON.stringify(relato));
})().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
`;

const SONDAS = {
  cjs: {
    arquivo: 'sonda.cjs',
    ext: 'cjs',
    fonte: `const main = require('logos-bancos-br');
const node = require('logos-bancos-br/node');
const carregar = async (especificador) => require(especificador);
const resolver = (especificador) => require.resolve(especificador);
${CORPO_SONDA}`,
  },
  esm: {
    arquivo: 'sonda.mjs',
    ext: 'js',
    fonte: `import { fileURLToPath } from 'node:url';
import * as main from 'logos-bancos-br';
import * as node from 'logos-bancos-br/node';

const carregar = async (especificador) =>
  (await import(especificador, { with: { type: 'json' } })).default;
const resolver = (especificador) => fileURLToPath(import.meta.resolve(especificador));
${CORPO_SONDA}`,
  },
};

// ── consumidor TypeScript ───────────────────────────────────────────────────

// tsc do repositório contra arquivos de um consumidor, como o usuário compila.
// node16 (não nodenext): desde o TS 5.8 o nodenext aceita require() de ESM, e
// tipos ESM servidos a quem faz require (TS1479) passariam batido.
// skipLibCheck: false valida também os .d.ts publicados; types: [] e lib
// es2022 garantem que eles não exigem @types/node nem DOM do consumidor (se um
// dia o ./node exigir, apontar typeRoots para o node_modules/@types daqui).
const TS_BASE = {
  strict: true,
  noEmit: true,
  skipLibCheck: false,
  target: 'es2022',
  lib: ['es2022'],
  types: [],
};
const TS_NODE16 = { module: 'node16', moduleResolution: 'node16' };
const TS_BUNDLER = { module: 'esnext', moduleResolution: 'bundler' };

const TS_CONSUMIDOR = `import {
  type Bank,
  byCompe,
  byIspb,
  type Institution,
  type PixInstitution,
  version,
} from 'logos-bancos-br';
import { type CopyLogosResult, copyLogos, logoPngPath, logoSvgPath } from 'logos-bancos-br/node';

const banco: Bank | undefined = byCompe('341');
const nomePopular: string | null | undefined = banco?.displayName;
const instituicao: Institution | undefined = byIspb('00000000');
const rotulo: string | undefined = instituicao && (instituicao.displayName ?? instituicao.name);
const soPix: PixInstitution['displayName'] = null;
const png: string | null = logoPngPath('341');
const svg: string | null = logoSvgPath('60701190');
const copia: CopyLogosResult = copyLogos({ dest: 'logos', only: ['341'] });
const versao: string = version;
// @ts-expect-error tipos reais (não any): campo inexistente tem que dar erro
banco?.campoInexistente;

export { copia, nomePopular, png, rotulo, soPix, svg, versao };
`;

const TS_REACT_NATIVE = `
import logos from 'logos-bancos-br/react-native';

export const logoRn: number | undefined = logos['0341'];
`;

// ── execução ────────────────────────────────────────────────────────────────

if (!existsSync(join(RAIZ, 'dist', 'index.js'))) {
  console.error('erro: dist/ não encontrado — rode `npm run build` antes do test:package.');
  process.exit(1);
}
if (!existsSync(TSC)) {
  console.error('erro: TypeScript não encontrado em node_modules/ — rode `npm ci` antes.');
  process.exit(1);
}
avisarSeDistVelho();

// Esperado: o dataset do repositório (o mesmo que o build embute no dist/).
const BANCOS = lerJson(join(RAIZ, 'data', 'bancos.json')).banks;
const SO_PIX = lerJson(join(RAIZ, 'data', 'instituicoes-pix.json')).institutions;
const DISPLAY_NAME_BB = BANCOS.find((banco) => banco.ispb === '00000000')?.displayName;
// O que o ./node tem que devolver para o Itaú (COMPE 341, ISPB 60701190):
// o caminho do dataset, não só "algum arquivo que existe".
const LOGO_ITAU = BANCOS.find((banco) => banco.ispb === '60701190')?.logo ?? null;
const CONTAGENS = {
  banks: BANCOS.length,
  pixInstitutions: SO_PIX.length,
  displayNames: [...BANCOS, ...SO_PIX].filter((i) => i.displayName != null).length,
  'data/bancos.json': BANCOS.length,
  'data/instituicoes-pix.json': SO_PIX.length,
  'data/cdn-index.min.json': Object.keys(
    lerJson(join(RAIZ, 'data', 'cdn-index.min.json')).institutions,
  ).length,
  'data/logo-urls.min.json': Object.keys(lerJson(join(RAIZ, 'data', 'logo-urls.min.json'))).length,
};

// realpath: no macOS o tmpdir é symlink (/var -> /private/var) e o Node
// devolve caminhos reais — sem isso, a comparação de caminhos falharia.
const TMP = realpathSync(mkdtempSync(join(tmpdir(), 'logos-bancos-br-pacote-')));
process.on('exit', () => {
  if (process.env.MANTER_TMP) console.log(`MANTER_TMP: arquivos mantidos em ${TMP}`);
  else rmSync(TMP, { recursive: true, force: true });
});
// Sinais chegam entre as verificações (verificar() devolve o controle ao
// event loop) ou derrubam o filho em execução (rodar()).
process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(143));
process.on('SIGHUP', () => process.exit(129));

// O mesmo npm que roda o `npm run` (npm_execpath), chamado via node: sem shell,
// funciona também no Windows. Fora do `npm run`, usa o `npm` do PATH.
const NPM = /npm-cli\.[cm]?js$/.test(process.env.npm_execpath ?? '')
  ? [process.execPath, process.env.npm_execpath]
  : ['npm'];

// Espaço, '#' e '%' no caminho: o shim de import.meta.url do build CJS montava
// a URL sem escapar, e logoPngPath() saía do pacote nesses caminhos.
const consumidor = join(TMP, 'consumidor #1 %');
const falhas = [];
let total = 0;
let instalado;

console.log(`test:package — ${PKG.name}@${PKG.version}`);

// Instalação: `npm install <tgz> --offline`, com cache vazio e descartável. É
// o caminho do usuário de verdade (extração, `files`, link do bin com chmod —
// ou shim .cmd no Windows) e, sem dependências de runtime, não precisa de
// rede: qualquer ida ao registry falharia na hora (ENOTCACHED) em vez de
// travar, e nada é gravado no ~/.npm. Extrair o tar à mão testaria as nossas
// suposições sobre o npm, não o npm.
await verificar('npm pack + npm install offline do tarball', () => {
  const dirPack = join(TMP, 'pack');
  mkdirSync(dirPack);
  const pack = npm(['pack', '--pack-destination', dirPack, '--loglevel=warn'], RAIZ);
  if (pack.stderr.trim()) console.log(`  avisos do npm pack:\n${recuar(pack.stderr.trim())}`);
  const tgzs = readdirSync(dirPack).filter((arquivo) => arquivo.endsWith('.tgz'));
  if (tgzs.length !== 1) throw new Error(`npm pack gerou ${tgzs.length} tarballs: ${tgzs}`);
  const tarball = join(dirPack, tgzs[0]);

  mkdirSync(consumidor);
  const pkgConsumidor = { name: 'consumidor', version: '0.0.0', private: true };
  writeFileSync(join(consumidor, 'package.json'), `${JSON.stringify(pkgConsumidor, null, 2)}\n`);
  npm(
    [
      'install',
      tarball,
      '--offline',
      '--cache',
      join(TMP, 'npm-cache'),
      '--prefix',
      consumidor,
      // Explícitos: um ~/.npmrc com install-strategy=linked ou bin-links=false
      // daria falso negativo.
      '--install-strategy=hoisted',
      '--bin-links',
      '--no-audit',
      '--no-fund',
      '--no-update-notifier',
      '--loglevel=warn',
    ],
    consumidor,
  );
  const destino = join(consumidor, 'node_modules', PKG.name);
  if (!existsSync(join(destino, 'package.json'))) {
    throw new Error(`npm install não criou node_modules/${PKG.name}`);
  }
  instalado = realpathSync(destino);
  return `${basename(tarball)}, ${(statSync(tarball).size / 1e6).toFixed(1)} MB`;
});
// Sem o pacote instalado não há o que testar.
if (falhas.length) encerrar();
const PKG_INSTALADO = lerJson(join(instalado, 'package.json'));
const BINS =
  typeof PKG_INSTALADO.bin === 'string'
    ? { [PKG_INSTALADO.name]: PKG_INSTALADO.bin }
    : (PKG_INSTALADO.bin ?? {});

await verificar('arquivos de main/module/types/bin/exports existem no pacote', () => {
  const declarados = new Set([
    PKG_INSTALADO.main,
    PKG_INSTALADO.module,
    PKG_INSTALADO.types,
    ...Object.values(BINS),
    ...alvosDeExports(PKG_INSTALADO.exports),
  ]);
  // "./logos/*": confere o diretório-base do padrão.
  const ausentes = [...declarados].filter(
    (alvo) => !existsSync(join(instalado, alvo.split('*')[0])),
  );
  if (ausentes.length) throw new Error(`ausentes no pacote: ${ausentes.join(', ')}`);
  return `${declarados.size} caminhos`;
});

// O entry principal é o da web e do React Native (README): nada de módulos do
// Node nem import.meta no grafo dele. Já aconteceu de o shim de __dirname do
// tsup ir parar no chunk compartilhado e quebrar o webpack 5 e o esbuild.
await verificar('entry principal sem módulos do Node nem import.meta', () => {
  const nativos = new Set(builtinModules.flatMap((m) => [m, `node:${m}`]));
  const problemas = [];
  const vistos = new Set();
  for (const inicio of ['dist/index.js', 'dist/index.cjs']) {
    const fila = [inicio];
    while (fila.length) {
      const arquivo = fila.pop();
      if (vistos.has(arquivo)) continue;
      vistos.add(arquivo);
      const fonte = readFileSync(join(instalado, arquivo), 'utf8');
      if (/\bimport\.meta\b/.test(fonte)) problemas.push(`${arquivo}: import.meta`);
      for (const [, esp] of fonte.matchAll(/(?:\bfrom|\bimport|\brequire\()\s*["']([^"']+)["']/g)) {
        if (esp.startsWith('.')) fila.push(posix.join(posix.dirname(arquivo), esp));
        else if (nativos.has(esp)) problemas.push(`${arquivo}: ${esp}`);
      }
    }
  }
  if (problemas.length) throw new Error(problemas.join('\n'));
  return `${vistos.size} arquivos (ESM + CJS)`;
});
await verificar('runtime CJS (require)', () => conferirSonda('cjs'));
await verificar('runtime ESM (import)', () => conferirSonda('esm'));

await verificar('CLI (bin instalado): list --json e copy --only 341', () => {
  const [nome, alvo] = Object.entries(BINS)[0] ?? [];
  if (!nome) throw new Error('package.json sem "bin"');
  const link = join(consumidor, 'node_modules', '.bin', nome);
  const windows = process.platform === 'win32';
  if (!existsSync(windows ? `${link}.cmd` : link)) throw new Error('npm não criou o link do bin');
  // No POSIX executa o link (shebang + permissão de execução); no Windows o
  // link é um .cmd (exigiria shell), então roda o alvo do bin com o node.
  const cli = (args) =>
    windows
      ? rodar(process.execPath, [join(instalado, alvo), ...args], consumidor)
      : rodar(link, args, consumidor);
  const lista = JSON.parse(cli(['list', '--json']).stdout);
  igual(lista.banks?.length, CONTAGENS.banks, 'list --json: banks.length');
  const destino = join(TMP, 'copia-cli');
  cli(['copy', '--dest', destino, '--only', '341']);
  if (LOGO_ITAU && !existsSync(join(destino, '0341.png'))) {
    throw new Error('copy --only 341 não gravou 0341.png');
  }
  return `list --json com ${lista.banks.length} bancos; copy --only 341 ok`;
});

await verificar('react-native.js: todo require() aponta para arquivo do pacote', () => {
  const fonte = readFileSync(join(instalado, 'react-native.js'), 'utf8');
  const caminhos = [...fonte.matchAll(/require\((['"])(\.\/[^'"]+)\1\)/g)].map((m) => m[2]);
  if (caminhos.length === 0) throw new Error('nenhum require() encontrado');
  const distintos = [...new Set(caminhos)];
  const ausentes = distintos.filter((caminho) => !existsSync(join(instalado, caminho)));
  if (ausentes.length) throw new Error(`ausentes no pacote: ${ausentes.join(', ')}`);
  return `${caminhos.length} require() → ${distintos.length} arquivos`;
});

await verificar('logos citados no dataset e no logo-urls.min.json estão no pacote', () => {
  const dados = (arquivo) => lerJson(join(instalado, 'data', arquivo));
  const { banks } = dados('bancos.json');
  const { institutions } = dados('instituicoes-pix.json');
  const caminhos = new Set();
  for (const item of [...banks, ...institutions]) {
    if (item.logo) caminhos.add(item.logo.png);
    if (item.logo?.svg) caminhos.add(item.logo.svg);
  }
  // URLs do jsDelivr (…/logos-bancos-br@0/logos/x.svg): o caminho depois da versão.
  for (const url of Object.values(dados('logo-urls.min.json'))) {
    caminhos.add(url.replace(/^.*?@[^/]+\//, ''));
  }
  const ausentes = [...caminhos].filter((caminho) => !existsSync(join(instalado, caminho)));
  if (ausentes.length) throw new Error(`ausentes no pacote: ${ausentes.join(', ')}`);
  return `${caminhos.size} arquivos`;
});

await verificar('tipos node16 ESM (.mts)', () => conferirTipos('tipos.mts', TS_NODE16));
await verificar('tipos node16 CJS (.cts)', () => conferirTipos('tipos.cts', TS_NODE16));
await verificar('tipos bundler (.ts, com react-native)', () =>
  conferirTipos('tipos.ts', TS_BUNDLER, TS_REACT_NATIVE),
);

encerrar();

// ── verificações ────────────────────────────────────────────────────────────

function conferirSonda(formato) {
  const { arquivo, ext, fonte } = SONDAS[formato];
  writeFileSync(join(consumidor, arquivo), fonte);
  const destino = join(TMP, `copia-${formato}`);
  const relato = JSON.parse(rodar(process.execPath, [arquivo, destino], consumidor).stdout);

  // A condição certa do exports: o Node 22 aceita require() de ESM, então
  // carregar sem erro não basta — o arquivo resolvido tem que ser o do formato.
  igual(noPacote(relato.resolvido.main), `dist/index.${ext}`, "'logos-bancos-br' resolve para");
  igual(noPacote(relato.resolvido.node), `dist/node.${ext}`, "'logos-bancos-br/node' resolve para");
  igual(noPacote(relato.resolvido.reactNative), 'react-native.js', "'…/react-native' resolve para");

  igual(relato.version, PKG.version, 'version exportado');
  igual(relato.versionPackageJson, PKG.version, "version de 'logos-bancos-br/package.json'");
  igual(relato.logoItau, LOGO_ITAU?.png ?? null, "byCompe('341').logo.png");
  if (relato.logoItau && !existsSync(join(instalado, relato.logoItau))) {
    throw new Error(`byCompe('341').logo.png não existe no pacote: ${relato.logoItau}`);
  }
  igual(relato.displayNameBb, DISPLAY_NAME_BB, "byIspb('00000000').displayName");
  igual(relato.pngItau && noPacote(relato.pngItau), LOGO_ITAU?.png ?? null, "logoPngPath('341')");
  igual(
    relato.svgItau && noPacote(relato.svgItau),
    LOGO_ITAU?.svg ?? null,
    "logoSvgPath('60701190')",
  );
  for (const caminho of [relato.pngItau, relato.svgItau].filter(Boolean)) {
    if (!existsSync(caminho)) throw new Error(`logoPngPath/logoSvgPath: não existe ${caminho}`);
  }
  igual(relato.copiados.length, LOGO_ITAU ? 1 : 0, "copyLogos({ only: ['341'] }): copiados");
  if (LOGO_ITAU && !readFileSync(relato.copiados[0]).equals(readFileSync(relato.pngItau))) {
    throw new Error('copyLogos copiou um arquivo diferente do PNG do pacote');
  }
  for (const [chave, esperado] of Object.entries(CONTAGENS)) {
    igual(relato.contagens[chave], esperado, `contagem ${chave}`);
  }
  const { version, displayNameBb } = relato;
  return `dist/*.${ext}; version ${version}; displayName "${displayNameBb}"; ./node e data/ ok`;
}

function conferirTipos(arquivo, opcoes, extra = '') {
  writeFileSync(join(consumidor, arquivo), TS_CONSUMIDOR + extra);
  const tsconfig = join(consumidor, `tsconfig.${arquivo}.json`);
  const config = { compilerOptions: { ...TS_BASE, ...opcoes }, files: [arquivo] };
  writeFileSync(tsconfig, JSON.stringify(config, null, 2));
  rodar(process.execPath, [TSC, '-p', tsconfig, '--pretty', 'false'], consumidor);
  return `${opcoes.module}/${opcoes.moduleResolution}, strict, skipLibCheck: false`;
}

// ── utilitários ─────────────────────────────────────────────────────────────

async function verificar(nome, teste) {
  total++;
  try {
    const detalhe = teste();
    console.log(`  ✓ ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
  } catch (erro) {
    falhas.push(nome);
    console.log(`  ✗ ${nome}\n${recuar(erro instanceof Error ? erro.message : String(erro))}`);
  }
  // Devolve o controle ao event loop: um Ctrl+C que chegou durante a etapa é
  // tratado aqui, em vez de só no fim.
  await new Promise((resolve) => setImmediate(resolve));
}

function encerrar() {
  if (falhas.length) {
    console.error(`\nFALHOU: ${falhas.length} de ${total} verificações — ${falhas.join('; ')}`);
    process.exit(1);
  }
  console.log(`\nOK: ${total} verificações passaram no tarball de ${PKG.name}@${PKG.version}.`);
}

/** Roda um comando; erro com a saída (stdout + stderr) se terminar com código ≠ 0. */
function rodar(comando, args, cwd) {
  const r = spawnSync(comando, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    timeout: LIMITE_MS,
    killSignal: 'SIGKILL',
  });
  if (r.error?.code === 'ETIMEDOUT') {
    throw new Error(`passou de ${LIMITE_MS / 1000} s: ${basename(comando)} ${args.join(' ')}`);
  }
  // Ctrl+C também mata o filho: aborta já (o handler de 'exit' limpa o TMP).
  if (r.signal === 'SIGINT') process.exit(130);
  if (r.signal === 'SIGTERM') process.exit(143);
  if (r.signal === 'SIGHUP') process.exit(129);
  if (r.error) throw r.error;
  if (r.status !== 0) {
    const saida = `${r.stdout}\n${r.stderr}`.trim();
    throw new Error(`saiu com ${r.status ?? r.signal}${saida ? `:\n${saida}` : ''}`);
  }
  return r;
}

function npm(args, cwd) {
  return rodar(NPM[0], [...NPM.slice(1), ...args], cwd);
}

function igual(atual, esperado, oque) {
  if (atual !== esperado) {
    throw new Error(`${oque}: esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(atual)}`);
  }
}

/** Caminho relativo à raiz do pacote instalado, com "/" ("../…" = fora dele). */
function noPacote(caminho) {
  return relative(instalado, caminho).split(sep).join('/');
}

function alvosDeExports(valor) {
  if (typeof valor === 'string') return [valor];
  return Object.values(valor ?? {}).flatMap(alvosDeExports);
}

function recuar(texto) {
  return texto
    .split('\n')
    .map((linha) => `      ${linha}`)
    .join('\n');
}

// Avisa (sem falhar) quando uma fonte do build mudou depois do último build:
// testar um dist/ velho daria resultado enganoso. No CI o build vem logo antes.
function avisarSeDistVelho() {
  const build = statSync(join(RAIZ, 'dist', 'index.js')).mtimeMs;
  const fontes = [
    ...readdirSync(join(RAIZ, 'src')).map((arquivo) => `src/${arquivo}`),
    'data/bancos.json',
    'data/instituicoes-pix.json',
    'package.json',
    'tsup.config.ts',
  ];
  const novas = fontes.filter((fonte) => statSync(join(RAIZ, fonte)).mtimeMs > build);
  if (novas.length) {
    const lista = novas.join(', ');
    console.warn(`aviso: ${lista} mudou depois do build — dist/ velho? Rode \`npm run build\`.`);
  }
}
