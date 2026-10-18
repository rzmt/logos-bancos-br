import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default defineConfig({
  entry: { index: 'src/index.ts', node: 'src/node.ts', cli: 'src/cli.ts' },
  format: ['esm', 'cjs'],
  // Explicit: the package supports Node >= 20, so the build target must not
  // follow the tsconfig used by the pipeline and tests.
  target: 'es2022',
  dts: true,
  clean: true,
  // Shares the inlined dataset chunk between entries instead of tripling it.
  splitting: true,
  // Keeps import.meta out of the CJS build (src/node.ts only reaches for
  // import.meta.url when there is no __dirname).
  shims: true,
  esbuildOptions(options, { format }) {
    // ESM has no __dirname. Without this, `shims` injects tsup's ESM __dirname
    // shim (imports of path and url) into the chunk shared with the universal
    // main entry, and web bundlers fail on it.
    if (format === 'esm') options.define = { ...options.define, __dirname: 'undefined' };
  },
  define: { __PKG_VERSION__: JSON.stringify(pkg.version) },
});
