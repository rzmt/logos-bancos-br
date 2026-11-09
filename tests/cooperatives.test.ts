import { describe, expect, it } from 'vitest';
import {
  cooperativeSnapshot,
  parseCooperativeRegistry,
  registryFromSnapshot,
  sameCooperativeSnapshot,
} from '../pipeline/sources';

// Formato da API Olinda (SedesCooperativas), com as colunas do $select.
const RESPONSE = {
  '@odata.context': 'https://olinda.bcb.gov.br/olinda/servico/…/$metadata#SedesCooperativas',
  value: [
    {
      CNPJ: '00966246',
      NOME_INSTITUICAO: 'COOPERATIVA DE CREDITO CREDICERIPA - SICOOB CREDICERIPA',
      FILIACAO: 'COOPERATIVA CENTRAL DE CRÉDITO DO ESTADO DE SÃO PAULO - SICOOB SÃO PAULO',
    },
    {
      CNPJ: '03795072',
      NOME_INSTITUICAO: 'CONFEDERAÇÃO DAS COOPERATIVAS DO SICREDI - CONFEDERAÇÃO SICREDI',
      FILIACAO: '',
    },
    // A API repete linhas idênticas (a Confederação Sicredi aparece duas vezes).
    {
      CNPJ: '03795072',
      NOME_INSTITUICAO: 'CONFEDERAÇÃO DAS COOPERATIVAS DO SICREDI - CONFEDERAÇÃO SICREDI',
      FILIACAO: '',
    },
    { CNPJ: '5494591', NOME_INSTITUICAO: '  CRESOL NASCENTE  ', FILIACAO: null },
    { CNPJ: '', NOME_INSTITUICAO: 'SEM CNPJ', FILIACAO: '' },
    { CNPJ: '12345678', NOME_INSTITUICAO: null, FILIACAO: '' },
  ],
};

describe('parseCooperativeRegistry', () => {
  it('indexa pela raiz do CNPJ com nome e filiação, sem repetir linhas', () => {
    const registry = parseCooperativeRegistry(RESPONSE, { minRows: 1 });
    expect([...registry.keys()]).toEqual(['00966246', '03795072', '05494591']);
    expect(registry.get('00966246')).toEqual({
      name: 'COOPERATIVA DE CREDITO CREDICERIPA - SICOOB CREDICERIPA',
      affiliation: 'COOPERATIVA CENTRAL DE CRÉDITO DO ESTADO DE SÃO PAULO - SICOOB SÃO PAULO',
    });
    expect(registry.get('05494591')).toEqual({ name: 'CRESOL NASCENTE', affiliation: '' });
  });

  it('aceita CNPJ completo e fica com a raiz', () => {
    const registry = parseCooperativeRegistry(
      { value: [{ CNPJ: '00.966.246/0001-08', NOME_INSTITUICAO: 'X', FILIACAO: '' }] },
      { minRows: 1 },
    );
    expect([...registry.keys()]).toEqual(['00966246']);
  });

  it('recusa resposta fora do formato, paginada ou pequena demais', () => {
    expect(() => parseCooperativeRegistry({ erro: 'x' }, { minRows: 1 })).toThrow(/inesperado/);
    expect(() =>
      parseCooperativeRegistry({ ...RESPONSE, '@odata.nextLink': 'https://…' }, { minRows: 1 }),
    ).toThrow(/paginado/);
    expect(() => parseCooperativeRegistry(RESPONSE)).toThrow(/poucas cooperativas/i);
  });
});

describe('cópia do cadastro (pipeline/cooperativas.json)', () => {
  const registry = parseCooperativeRegistry(RESPONSE, { minRows: 1 });

  it('guarda os nomes e só as filiações preenchidas, e volta ao mesmo cadastro', () => {
    const snapshot = cooperativeSnapshot(registry, '2026-11-09');
    expect(snapshot.atualizadoEm).toBe('2026-11-09');
    expect(snapshot.fonte).toMatch(/SedesCooperativas$/);
    expect(Object.keys(snapshot.nomes)).toHaveLength(3);
    expect(snapshot.filiacoes).toEqual({
      '00966246': 'COOPERATIVA CENTRAL DE CRÉDITO DO ESTADO DE SÃO PAULO - SICOOB SÃO PAULO',
    });
    const parsed = JSON.parse(JSON.stringify(snapshot));
    expect(registryFromSnapshot(parsed)).toEqual(registry);
  });

  it('compara pelo conteúdo, não pela data', () => {
    const before = cooperativeSnapshot(registry, '2026-11-01');
    const sameData = cooperativeSnapshot(registry, '2026-11-09');
    expect(sameCooperativeSnapshot(before, sameData)).toBe(true);

    const renamed = new Map(registry);
    renamed.set('05494591', { name: 'CRESOL NASCENTE - NOVO NOME', affiliation: '' });
    expect(sameCooperativeSnapshot(before, cooperativeSnapshot(renamed, '2026-11-09'))).toBe(false);
  });
});
