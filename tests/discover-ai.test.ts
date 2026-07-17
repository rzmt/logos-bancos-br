import { describe, expect, it } from 'vitest';
import { parseAiAnswer } from '../pipeline/discover-ai';

describe('parseAiAnswer', () => {
  it('parses a fenced json block', () => {
    const text = [
      'Encontrei o site oficial.',
      '```json',
      '{"site": "https://www.bancoexemplo.com.br", "logoUrl": "https://www.bancoexemplo.com.br/logo.svg", "confidence": "alta", "evidence": "Site cita o CNPJ e o ISPB da instituição."}',
      '```',
    ].join('\n');
    expect(parseAiAnswer(text)).toEqual({
      site: 'https://www.bancoexemplo.com.br/',
      logoUrl: 'https://www.bancoexemplo.com.br/logo.svg',
      confidence: 'alta',
      evidence: 'Site cita o CNPJ e o ISPB da instituição.',
    });
  });

  it('parses a bare object surrounded by prose', () => {
    const text =
      'Aqui está: {"site": "https://scd.example", "logoUrl": null, "confidence": "media", "evidence": "Página institucional."} Espero ter ajudado.';
    const answer = parseAiAnswer(text);
    expect(answer?.site).toBe('https://scd.example/');
    expect(answer?.logoUrl).toBeNull();
    expect(answer?.confidence).toBe('media');
  });

  it('handles braces inside string values', () => {
    const text =
      '{"site": "https://x.example", "logoUrl": null, "confidence": "alta", "evidence": "cita {ISPB} e CNPJ"}';
    expect(parseAiAnswer(text)?.evidence).toBe('cita {ISPB} e CNPJ');
  });

  it('rejects non-https and malformed urls', () => {
    const text =
      '{"site": "http://inseguro.example", "logoUrl": "não-é-url", "confidence": "alta", "evidence": "x"}';
    const answer = parseAiAnswer(text);
    expect(answer?.site).toBeNull();
    expect(answer?.logoUrl).toBeNull();
  });

  it('defaults unknown confidence to baixa and missing evidence to empty', () => {
    const text = '{"site": null, "logoUrl": null, "confidence": "certíssima"}';
    const answer = parseAiAnswer(text);
    expect(answer?.confidence).toBe('baixa');
    expect(answer?.evidence).toBe('');
  });

  it('returns null when there is no json object', () => {
    expect(parseAiAnswer('Não encontrei nada útil.')).toBeNull();
    expect(parseAiAnswer('{"quebrado": ')).toBeNull();
  });
});
