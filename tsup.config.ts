import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default defineConfig({
  entry: { index: 'src/index.ts', node: 'src/node.ts', cli: 'src/cli.ts' },
  format: ['esm', 'cjs'],
  // Explícito: o pacote declara Node >= 20; o target não pode subir junto com o
  // tsconfig do pipeline/testes.
  target: 'es2022',
  dts: true,
  clean: true,
  // Shares the inlined dataset chunk between entries instead of tripling it.
  splitting: true,
  // import.meta.url shim for the CJS build (used by src/node.ts asset paths).
  shims: true,
  define: { __PKG_VERSION__: JSON.stringify(pkg.version) },
});
