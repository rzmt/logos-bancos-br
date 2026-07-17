import { describe, expect, it } from 'vitest';
import { parseStrCsv } from '../pipeline/sources';

const HEADER =
  'ISPB,Nome_Reduzido,Número_Código,Participa_da_Compe,Acesso_Principal,Nome_Extenso,Início_da_Operação';

const FIXTURE = [
  HEADER,
  '00000000,BCO DO BRASIL S.A.,001,Sim,RSFN,Banco do Brasil S.A.,22/04/2002',
  '00038166,BCB,n/a,Não,RSFN,Banco Central do Brasil,22/04/2002',
  '60701190,ITAÚ UNIBANCO S.A.,341,Sim,RSFN,"Itaú Unibanco S.A.",22/04/2002',
  '31597552,CÂMARA B3,0,Não,RSFN,Câmara B3 (câmbio),05/04/2002',
].join('\n');

describe('parseStrCsv', () => {
  it('keeps only rows with a non-zero COMPE number', () => {
    const participants = parseStrCsv(FIXTURE, { minRows: 1 });
    expect(participants).toHaveLength(2);
    expect(participants[0]).toEqual({
      ispb: '00000000',
      compe: '001',
      compe4: '0001',
      shortName: 'BCO DO BRASIL S.A.',
      fullName: 'Banco do Brasil S.A.',
    });
    expect(participants[1]?.compe4).toBe('0341');
    expect(participants[1]?.fullName).toBe('Itaú Unibanco S.A.');
  });

  it('strips the UTF-8 BOM before parsing', () => {
    const participants = parseStrCsv(`﻿${FIXTURE}`, { minRows: 1 });
    expect(participants).toHaveLength(2);
  });

  it('throws when an expected column is missing', () => {
    const broken = FIXTURE.replace('Número_Código', 'Outra_Coluna');
    expect(() => parseStrCsv(broken, { minRows: 1 })).toThrow(/coluna esperada/i);
  });

  it('rejects suspiciously small files with the default threshold', () => {
    expect(() => parseStrCsv(FIXTURE)).toThrow(/poucas linhas/i);
  });
});
