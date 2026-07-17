/**
 * Safe logo download and normalization.
 *
 * Every logo becomes a square transparent PNG (`fit: contain`). When the
 * source is a safe SVG, the original vector is also kept for consumers that
 * want lossless scaling.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

/**
 * Browser-like UA for LOGO downloads only (data sources identify themselves
 * via sources.ts). The logo hosts sit behind WAFs (Akamai etc.) that block
 * "bot-looking" agents with 403/hangs — these are public logos published by
 * the institutions in a public directory precisely for third-party display,
 * so avoiding the false positive is legitimate.
 */
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

export function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Downloads logo bytes with guardrails: https only, timeout, size cap and a
 * single retry for transient failures (timeouts, 5xx).
 */
export async function downloadLogo(
  uri: string,
  {
    maxBytes = 2 * 1024 * 1024,
    timeoutMs = 15_000,
    attempts = 2,
  }: { maxBytes?: number; timeoutMs?: number; attempts?: number } = {},
): Promise<Buffer> {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    throw new Error(`URI inválida: ${uri}`);
  }
  if (url.protocol !== 'https:') throw new Error(`protocolo não permitido (${url.protocol})`);

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(uri, {
        headers: { 'user-agent': BROWSER_USER_AGENT, accept: 'image/*,*/*' },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'follow',
      });
      if (!response.ok) {
        // Client errors are definitive; only retry server errors.
        if (response.status < 500 || attempt === attempts) {
          throw new Error(`HTTP ${response.status}`);
        }
        lastError = new Error(`HTTP ${response.status}`);
        continue;
      }

      const contentLength = Number(response.headers.get('content-length') ?? 0);
      if (contentLength && contentLength > maxBytes) {
        throw new Error(`excede ${maxBytes} bytes (content-length ${contentLength})`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength === 0) throw new Error('resposta vazia');
      if (buffer.byteLength > maxBytes)
        throw new Error(`excede ${maxBytes} bytes (${buffer.byteLength})`);
      return buffer;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      // Retry only on network-ish failures.
      if (attempt === attempts || !/timeout|network|fetch failed|HTTP 5\d\d/i.test(message)) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw lastError;
}

/** Content sniff: does the buffer look like an SVG document? */
export function looksLikeSvg(buffer: Buffer): boolean {
  let head = buffer.subarray(0, 2048).toString('utf8');
  if (head.charCodeAt(0) === 0xfeff) head = head.slice(1); // UTF-8 BOM
  head = head.trimStart();
  if (!head.startsWith('<')) return false;
  return /<svg[\s>]/i.test(head);
}

/**
 * Conservative filter for SVGs we redistribute as-is. Anything with script,
 * event handlers, foreignObject or external references is rejected — the
 * institution still gets a PNG (librsvg ignores those constructs), we just
 * don't ship the raw vector.
 */
export function isSafeSvg(svgText: string): boolean {
  const patterns: RegExp[] = [
    /<\s*script/i,
    /\son[a-z]+\s*=/i,
    /javascript:/i,
    /<\s*foreignObject/i,
    // External references (http/https or protocol-relative) in href/src/url().
    /(?:xlink:href|href|src)\s*=\s*["']\s*(?:https?:)?\/\//i,
    /url\(\s*["']?\s*(?:https?:)?\/\//i,
  ];
  return !patterns.some((pattern) => pattern.test(svgText));
}

/**
 * Converts SVG/PNG/JPEG/WebP into a square transparent PNG of `sizePx`.
 *
 * SVGs without an intrinsic pixel size are rasterized via density (DPI); a
 * high density on a huge viewBox can blow the pixel limit, so decreasing
 * densities are tried. `limitInputPixels` (100 MP) protects against
 * decompression bombs. A palette re-encode keeps files small, with a
 * quality fallback when the result exceeds 20 KB.
 */
export async function rasterize(
  buffer: Buffer,
  { sizePx = 256 }: { sizePx?: number } = {},
): Promise<Buffer> {
  const densities = [300, 150, 72];
  let lastError: unknown;
  for (const density of densities) {
    try {
      const base = () =>
        sharp(buffer, { density, limitInputPixels: 100_000_000, failOn: 'error' }).resize(
          sizePx,
          sizePx,
          { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } },
        );
      let png = await base()
        .png({ palette: true, quality: 100, compressionLevel: 9, effort: 10 })
        .toBuffer();
      if (png.byteLength > 20 * 1024) {
        const smaller = await base()
          .png({ palette: true, quality: 80, compressionLevel: 9, effort: 10 })
          .toBuffer();
        if (smaller.byteLength < png.byteLength) png = smaller;
      }
      return png;
    } catch (error) {
      lastError = error;
      // Only retry on size-related errors (big SVG); real decode errors abort.
      const message = error instanceof Error ? error.message : String(error);
      if (!/pixel limit|exceeds|too large/i.test(message)) throw error;
    }
  }
  throw lastError;
}

export type WriteStatus = 'created' | 'updated' | 'unchanged';

/** Writes only when the content changed, keeping git diffs clean. */
export function writeIfChanged(path: string, content: Buffer | string): WriteStatus {
  const buffer = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
  if (existsSync(path)) {
    if (readFileSync(path).equals(buffer)) return 'unchanged';
    writeFileSync(path, buffer);
    return 'updated';
  }
  writeFileSync(path, buffer);
  return 'created';
}
