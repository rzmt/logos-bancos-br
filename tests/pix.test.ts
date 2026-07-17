import { describe, expect, it } from 'vitest';
import { mergeBackbone, parsePixCsv, pixCsvDateStamp } from '../pipeline/sources';
import type { PixParticipant, StrParticipant } from '../pipeline/types';

const PIX_FIXTURE = [
  'Lista de participantes ativos do Pix',
  ' ;Nome Reduzido;ISPB;CNPJ;Tipo de Instituição;Autorizada pelo BCB;Tipo de Participação no SPI;Tipo de Participação no Pix;Modalidade de Participação no Pix;Iniciação de Transação de Pagamento;Facilitador de serviço de Saque e Troco (FSS)',
  '1;99PAY IP S.A.;24313102;24.313.102/0001-25;Instituição de Pagamento;Sim;Direta;Facultativa;Provedor de Conta Transacional;Sim;Não',
  '2;ACCESSTAGE IP LTDA.;;46.410.407/0001-98;Instituição de Pagamento;Sim;;Facultativa;Iniciador;Sim;N/A',
  '3;ITAÚ UNIBANCO S.A.;60701190;60.701.190/0001-04;Banco Múltiplo;Sim;Direta;Obrigatória;Provedor de Conta Transacional;Sim;Sim',
  '4;ADOPAY IP;31841474;31.841.474/0001-90;Instituição de Pagamento não sujeita à autorização pelo BCB;Não;Indireta;Facultativa;Provedor de Conta Transacional;Não;N/A',
  'Lista de instituições em processo de adesão ao Pix',
  ' ;Nome Reduzido;ISPB;CNPJ;Tipo de Instituição;Autorizada pelo BCB;Tipo de Participação no SPI;Tipo de Participação no Pix;Modalidade de Participação no Pix;Status da adesão',
  '1;EM ADESAO IP;99999990;99.999.990/0001-00;Instituição de Pagamento;Sim;Indireta;Facultativa;Provedor de Conta Transacional;Etapa Homologatória',
].join('\n');

describe('parsePixCsv', () => {
  it('parses only the active section, skipping blank-ISPB rows', () => {
    const { participants, skippedNoIspb } = parsePixCsv(PIX_FIXTURE, { minRows: 1 });
    expect(participants.map((p) => p.ispb)).toEqual(['24313102', '60701190', '31841474']);
    expect(skippedNoIspb).toBe(1);
    // The onboarding section must not leak in.
    expect(participants.some((p) => p.ispb === '99999990')).toBe(false);
  });

  it('captures pix attributes verbatim and the authorized flag', () => {
    const { participants } = parsePixCsv(PIX_FIXTURE, { minRows: 1 });
    const p99 = participants[0];
    expect(p99?.shortName).toBe('99PAY IP S.A.');
    expect(p99?.cnpj).toBe('24313102000125');
    expect(p99?.pix).toEqual({
      spiParticipationType: 'Direta',
      pixParticipationType: 'Facultativa',
      modality: 'Provedor de Conta Transacional',
      institutionType: 'Instituição de Pagamento',
      authorizedByBcb: true,
    });
    const adopay = participants[2];
    expect(adopay?.pix.authorizedByBcb).toBe(false);
  });

  it('rejects suspiciously small files with the default threshold', () => {
    expect(() => parsePixCsv(PIX_FIXTURE)).toThrow(/poucos participantes/i);
  });

  it('throws when the header is missing', () => {
    expect(() => parsePixCsv('só;um;monte;de;lixo', { minRows: 1 })).toThrow(/cabeçalho/i);
  });
});

describe('pixCsvDateStamp', () => {
  it('formats in the São Paulo timezone', () => {
    // 2026-01-02T01:00Z is still 2026-01-01 22:00 in São Paulo (UTC-3).
    expect(pixCsvDateStamp(new Date('2026-01-02T01:00:00Z'))).toBe('20260101');
    expect(pixCsvDateStamp(new Date('2026-01-02T12:00:00Z'))).toBe('20260102');
  });
});

describe('mergeBackbone', () => {
  const str: StrParticipant[] = [
    {
      ispb: '60701190',
      compe: '341',
      compe4: '0341',
      shortName: 'ITAÚ UNIBANCO S.A.',
      fullName: 'Itaú Unibanco S.A.',
    },
  ];
  const pix: PixParticipant[] = [
    {
      ispb: '60701190',
      shortName: 'ITAU UNIBANCO',
      cnpj: '60701190000104',
      pix: {
        spiParticipationType: 'Direta',
        pixParticipationType: 'Obrigatória',
        modality: 'Provedor de Conta Transacional',
        institutionType: 'Banco Múltiplo',
        authorizedByBcb: true,
      },
    },
    {
      ispb: '24313102',
      shortName: '99PAY IP S.A.',
      cnpj: '24313102000125',
      pix: {
        spiParticipationType: 'Direta',
        pixParticipationType: 'Facultativa',
        modality: 'Provedor de Conta Transacional',
        institutionType: 'Instituição de Pagamento',
        authorizedByBcb: true,
      },
    },
  ];

  it('keeps STR names/COMPE and attaches pix info by ISPB', () => {
    const merged = mergeBackbone(str, pix);
    const itau = merged.find((p) => p.ispb === '60701190');
    expect(itau?.compe4).toBe('0341');
    expect(itau?.shortName).toBe('ITAÚ UNIBANCO S.A.'); // STR name wins
    expect(itau?.pix?.pixParticipationType).toBe('Obrigatória');
  });

  it('adds Pix-only institutions with compe null', () => {
    const merged = mergeBackbone(str, pix);
    const pay99 = merged.find((p) => p.ispb === '24313102');
    expect(pay99?.compe).toBeNull();
    expect(pay99?.compe4).toBeNull();
    expect(pay99?.fullName).toBe('99PAY IP S.A.');
    expect(merged).toHaveLength(2);
  });

  it('STR institutions without Pix participation get pix null', () => {
    const merged = mergeBackbone(str, []);
    expect(merged[0]?.pix).toBeNull();
  });
});
