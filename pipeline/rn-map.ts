/**
 * Builds `react-native.js` — a static require() map so Metro (React Native)
 * can bundle the logos. Keys are the 4-digit COMPE (main list) and the
 * 8-digit ISPB (every institution). Brand affiliates point at the shared
 * system asset, so Metro bundles each distinct image only once.
 */

import type { Bank, PixInstitution } from './types';

export function buildReactNativeMap(institutions: Array<Bank | PixInstitution>): string {
  const lines: string[] = [
    '// ARQUIVO GERADO AUTOMATICAMENTE pelo pipeline (`npm run pipeline`) — NÃO EDITAR.',
    '// Mapa estático de require() para Metro (React Native). Importar este entry',
    '// adiciona todos os logos DISTINTOS ao bundle do app (afiliadas de sistemas',
    '// cooperativos compartilham o mesmo asset).',
    '/* eslint-disable */',
    'export const logos = {',
  ];

  for (const institution of institutions) {
    if (!institution.logo) continue;
    const requirePath = `require('./${institution.logo.png}')`;
    if (institution.compe4) lines.push(`  '${institution.compe4}': ${requirePath},`);
    lines.push(`  '${institution.ispb}': ${requirePath},`);
  }

  lines.push('};', '', 'export default logos;', '');
  return lines.join('\n');
}
