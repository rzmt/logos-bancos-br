import { expectTypeOf, it } from 'vitest';
import type * as Pipeline from '../pipeline/types';
import type * as Publico from '../src/index';

// Os tipos públicos (src/index.ts) são uma cópia documentada dos tipos que o
// pipeline grava em data/*.json. Se um campo novo entrar no pipeline e faltar
// aqui (foi o caso do displayName na 0.8.0), o `npm run typecheck` falha.
it('tipos públicos espelham os tipos do dataset gerado pelo pipeline', () => {
  expectTypeOf<Publico.Bank>().toEqualTypeOf<Pipeline.Bank>();
  expectTypeOf<Publico.PixInstitution>().toEqualTypeOf<Pipeline.PixInstitution>();
  expectTypeOf<Publico.BankLogo>().toEqualTypeOf<Pipeline.BankLogo>();
  expectTypeOf<Publico.BankLogoSource>().toEqualTypeOf<Pipeline.BankLogoSource>();
  expectTypeOf<Publico.PixInfo>().toEqualTypeOf<Pipeline.PixInfo>();
});
