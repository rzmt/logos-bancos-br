import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import {
  describeFetchError,
  downloadLogo,
  isSafeSvg,
  looksLikeHtml,
  looksLikeSvg,
  rasterize,
  writeIfChanged,
} from '../pipeline/images';

const TINY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#e11" /></svg>`;

describe('looksLikeSvg', () => {
  it('detects a plain svg document', () => {
    expect(looksLikeSvg(Buffer.from(TINY_SVG))).toBe(true);
  });

  it('detects svg behind xml declaration and BOM', () => {
    const text = `﻿<?xml version="1.0" encoding="UTF-8"?>\n${TINY_SVG}`;
    expect(looksLikeSvg(Buffer.from(text))).toBe(true);
  });

  it('rejects binary raster content', async () => {
    const png = await sharp({
      create: { width: 4, height: 4, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 1 } },
    })
      .png()
      .toBuffer();
    expect(looksLikeSvg(png)).toBe(false);
  });
});

describe('looksLikeHtml', () => {
  it.each([
    ['doctype', '<!DOCTYPE html><html><head></head></html>'],
    ['leading whitespace and comment', '\n  <!-- cms --> <html lang="pt-br"><body></body></html>'],
    ['bare head', '<head><title>x</title></head>'],
  ])('detects an html page (%s)', (_label, text) => {
    expect(looksLikeHtml(Buffer.from(text))).toBe(true);
  });

  it('does not flag svg documents', () => {
    expect(looksLikeHtml(Buffer.from(TINY_SVG))).toBe(false);
    expect(looksLikeHtml(Buffer.from(`<?xml version="1.0"?>\n${TINY_SVG}`))).toBe(false);
  });
});

describe('describeFetchError', () => {
  it('appends the cause code hidden behind "fetch failed"', () => {
    const error = new TypeError('fetch failed', {
      cause: Object.assign(new Error('unable to verify the first certificate'), {
        code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
      }),
    });
    expect(describeFetchError(error)).toBe('fetch failed (UNABLE_TO_VERIFY_LEAF_SIGNATURE)');
  });

  it('keeps plain messages untouched', () => {
    expect(describeFetchError(new Error('HTTP 404'))).toBe('HTTP 404');
  });
});

describe('downloadLogo', () => {
  afterEach(() => vi.unstubAllGlobals());

  const respond = (body: string, status = 200) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(body, { status })),
    );

  it('returns the bytes of an image', async () => {
    respond(TINY_SVG);
    const bytes = await downloadLogo('https://logos.example/x.svg');
    expect(bytes.toString()).toBe(TINY_SVG);
  });

  it('rejects an html page served with 200 (soft 404)', async () => {
    respond('<!DOCTYPE html><html><title>Uniprime</title></html>');
    await expect(downloadLogo('https://logos.example/logo.svg')).rejects.toThrow(
      'página HTML em vez de imagem (URL quebrada?)',
    );
  });

  it('tells an anti-bot challenge apart from a broken URL', async () => {
    respond('<!DOCTYPE html><html><head><title>Just a moment...</title></head></html>');
    await expect(downloadLogo('https://logos.example/logo.svg')).rejects.toThrow(
      'desafio anti-bot',
    );
  });

  it('surfaces the network cause after retrying', async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError('fetch failed', {
        cause: Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(downloadLogo('https://logos.example/x.png')).rejects.toThrow(
      'fetch failed (ECONNRESET)',
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('refuses non-https URLs', async () => {
    await expect(downloadLogo('http://logos.example/x.png')).rejects.toThrow('protocolo');
  });
});

describe('isSafeSvg', () => {
  it('accepts a clean svg with internal references', () => {
    const clean = `<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g"/></defs><rect fill="url(#g)" href="#g"/></svg>`;
    expect(isSafeSvg(clean)).toBe(true);
  });

  it.each([
    ['script tag', '<svg><script>alert(1)</script></svg>'],
    ['event handler', '<svg onload="alert(1)"><rect/></svg>'],
    ['javascript uri', '<svg><a href="javascript:alert(1)"><rect/></a></svg>'],
    ['foreignObject', '<svg><foreignObject><div/></foreignObject></svg>'],
    ['external href', '<svg><image href="https://evil.example/x.png"/></svg>'],
    ['external xlink:href', '<svg><image xlink:href="//evil.example/x.png"/></svg>'],
    ['external url()', '<svg><rect style="fill:url(https://evil.example/f)"/></svg>'],
  ])('rejects svg with %s', (_label, svg) => {
    expect(isSafeSvg(svg)).toBe(false);
  });
});

describe('rasterize', () => {
  it('turns an svg into a square transparent png of the requested size', async () => {
    // Landscape source: `fit: contain` must letterbox with transparent bands.
    const wide = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect width="20" height="10" fill="#e11" /></svg>`;
    const png = await rasterize(Buffer.from(wide), { sizePx: 256 });
    const meta = await sharp(png).metadata();
    expect(meta.format).toBe('png');
    expect(meta.width).toBe(256);
    expect(meta.height).toBe(256);

    const raw = await sharp(png).ensureAlpha().raw().toBuffer();
    expect(raw[3]).toBe(0); // top-left corner is transparent (letterbox)
    const centerOffset = (128 * 256 + 128) * 4;
    expect(raw[centerOffset + 3]).toBe(255); // center is opaque
  });

  it('normalizes raster input to the same square canvas', async () => {
    const source = await sharp({
      create: { width: 20, height: 8, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .jpeg()
      .toBuffer();
    const png = await rasterize(source, { sizePx: 128 });
    const meta = await sharp(png).metadata();
    expect(meta.width).toBe(128);
    expect(meta.height).toBe(128);
  });

  it('draws an svg declared small at full resolution instead of upscaling it', async () => {
    // 16×16 favicon-style SVG: at 300 DPI it would render at 67px and be
    // blown up 3.8× (soft edges). It must match a high-resolution reference.
    const favicon = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="6" fill="#123456"/></svg>`,
    );
    const reference = await sharp(favicon, { density: 2400 })
      .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha()
      .raw()
      .toBuffer();
    const output = await sharp(await rasterize(favicon, { sizePx: 256 }))
      .ensureAlpha()
      .raw()
      .toBuffer();
    let diff = 0;
    for (let i = 3; i < reference.length; i += 4) {
      diff += Math.abs((reference[i] ?? 0) - (output[i] ?? 0));
    }
    // Upscaled from 67px this is ~1.08; drawn at full resolution, ~0.
    expect(diff / (reference.length / 4)).toBeLessThan(0.2);
  });

  it('throws on undecodable input', async () => {
    await expect(rasterize(Buffer.from('not an image at all'))).rejects.toThrow();
  });
});

describe('writeIfChanged', () => {
  const dir = mkdtempSync(join(tmpdir(), 'logos-bancos-br-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('reports created, unchanged and updated', () => {
    const file = join(dir, 'sample.txt');
    expect(writeIfChanged(file, 'a')).toBe('created');
    expect(writeIfChanged(file, 'a')).toBe('unchanged');
    expect(writeIfChanged(file, 'b')).toBe('updated');
  });
});
