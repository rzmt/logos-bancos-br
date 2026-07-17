import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, describe, expect, it } from 'vitest';
import { isSafeSvg, looksLikeSvg, rasterize, writeIfChanged } from '../pipeline/images';

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
