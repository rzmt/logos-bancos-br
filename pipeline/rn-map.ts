/**
 * Builds `react-native.js` — a static require() map so Metro (React Native)
 * can bundle the logos. Keys are both the 4-digit COMPE and the 8-digit ISPB.
 */

import type { Bank } from './types';

export function buildReactNativeMap(banks: Bank[]): string {
  const lines: string[] = [
    '// ARQUIVO GERADO AUTOMATICAMENTE pelo pipeline (`npm run pipeline`) — NÃO EDITAR.',
    '// Mapa estático de require() para Metro (React Native). Importar este entry',
    '// adiciona TODOS os logos ao bundle do app.',
    '/* eslint-disable */',
    'export const logos = {',
  ];

  for (const bank of banks) {
    if (!bank.logo) continue;
    const requirePath = `require('./${bank.logo.png}')`;
    if (bank.compe4) lines.push(`  '${bank.compe4}': ${requirePath},`);
    lines.push(`  '${bank.ispb}': ${requirePath},`);
  }

  lines.push('};', '', 'export default logos;', '');
  return lines.join('\n');
}
