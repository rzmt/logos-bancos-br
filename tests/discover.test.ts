import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { assessCandidate, extractIconCandidates } from '../pipeline/discover';

const PAGE = 'https://www.banco.com.br/home';

describe('extractIconCandidates', () => {
  it('prefers the largest apple-touch-icon and resolves relative URLs', () => {
    const html = `
      <link rel="apple-touch-icon" sizes="76x76" href="/icons/small.png">
      <link rel="apple-touch-icon" sizes="180x180" href="/icons/big.png">
      <link rel="icon" href="favicon.ico">`;
    const candidates = extractIconCandidates(html, PAGE);
    expect(candidates[0]).toMatchObject({
      url: 'https://www.banco.com.br/icons/big.png',
      origin: 'apple-touch-icon',
      declaredSize: 180,
    });
    // Relative to the page path, not the origin.
    expect(candidates.some((c) => c.url === 'https://www.banco.com.br/favicon.ico')).toBe(true);
  });

  it('ranks svg icon links above og:image, and og:image above plain icons', () => {
    const html = `
      <link rel="icon" href="/favicon-32.png" sizes="32x32">
      <meta property="og:image" content="https://cdn.banco.com.br/social.png">
      <link rel="icon" href="/logo.svg" type="image/svg+xml">`;
    const urls = extractIconCandidates(html, PAGE).map((c) => c.url);
    expect(urls.indexOf('https://www.banco.com.br/logo.svg')).toBeLessThan(
      urls.indexOf('https://cdn.banco.com.br/social.png'),
    );
    expect(urls.indexOf('https://cdn.banco.com.br/social.png')).toBeLessThan(
      urls.indexOf('https://www.banco.com.br/favicon-32.png'),
    );
  });

  it('accepts og:image declared via name= and single quotes', () => {
    const html = `<meta name='og:image' content='/img/logo-oficial.png'>`;
    const candidates = extractIconCandidates(html, PAGE);
    expect(candidates[0]?.url).toBe('https://www.banco.com.br/img/logo-oficial.png');
    expect(candidates[0]?.origin).toBe('og-image');
  });

  it('always appends the well-known fallbacks and dedupes by URL', () => {
    const html = `<link rel="icon" href="/favicon.ico">`;
    const candidates = extractIconCandidates(html, PAGE);
    const urls = candidates.map((c) => c.url);
    expect(urls).toContain('https://www.banco.com.br/apple-touch-icon.png');
    expect(urls.filter((u) => u === 'https://www.banco.com.br/favicon.ico')).toHaveLength(1);
  });

  it('drops non-https and unparsable URLs', () => {
    const html = `
      <link rel="icon" href="http://inseguro.example/logo.png">
      <link rel="icon" href="data:image/png;base64,xxxx">`;
    const candidates = extractIconCandidates(html, PAGE);
    expect(candidates.every((c) => c.url.startsWith('https://'))).toBe(true);
  });
});

describe('assessCandidate', () => {
  const svg = (body: string) =>
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`);

  it('approves safe svgs and rejects unsafe ones', async () => {
    expect((await assessCandidate(svg('<rect width="10" height="10"/>'))).ok).toBe(true);
    const unsafe = await assessCandidate(svg('<script>alert(1)</script>'));
    expect(unsafe.ok).toBe(false);
    expect(unsafe.reason).toMatch(/sanitiza/);
  });

  it('rejects rasters below the minimum side', async () => {
    const tiny = await sharp({
      create: { width: 32, height: 32, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();
    const result = await assessCandidate(tiny);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/pequeno/);
  });

  it('rejects banner-shaped rasters', async () => {
    const banner = await sharp({
      create: { width: 800, height: 120, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();
    const result = await assessCandidate(banner);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/banner/);
  });

  it('approves square-ish rasters at or above the minimum', async () => {
    const good = await sharp({
      create: { width: 180, height: 180, channels: 4, background: { r: 9, g: 9, b: 9, alpha: 1 } },
    })
      .png()
      .toBuffer();
    expect((await assessCandidate(good)).ok).toBe(true);
  });

  it('rejects undecodable content (html disguised as image, .ico)', async () => {
    const result = await assessCandidate(Buffer.from('<html><body>404</body></html> not svg'));
    expect(result.ok).toBe(false);
  });
});
