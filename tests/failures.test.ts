import { describe, expect, it } from 'vitest';
import { classifyFailure } from '../pipeline/failures';

describe('classifyFailure', () => {
  it.each([
    ['HTTP 404', 'broken'],
    ['HTTP 410', 'broken'],
    ['página HTML em vez de imagem (URL quebrada?)', 'broken'],
    ['rasterizar: Input buffer contains unsupported image format', 'broken'],
    ['fetch failed (ENOTFOUND)', 'broken'],
    ['excede 2097152 bytes (2519325)', 'broken'],
    ['HTTP 403', 'blocked'],
    ['HTTP 429', 'blocked'],
    ['HTTP 503', 'blocked'],
    ['página HTML em vez de imagem (desafio anti-bot)', 'blocked'],
    ['fetch failed (ECONNRESET)', 'blocked'],
    ['fetch failed', 'blocked'],
    ['The operation was aborted due to timeout', 'blocked'],
    ['fetch failed (UNABLE_TO_VERIFY_LEAF_SIGNATURE)', 'tls'],
    ['fetch failed (CERT_HAS_EXPIRED)', 'tls'],
    ['fetch failed (ERR_TLS_CERT_ALTNAME_INVALID)', 'tls'],
  ])('%s → %s', (reason, kind) => {
    expect(classifyFailure(reason)).toBe(kind);
  });
});
