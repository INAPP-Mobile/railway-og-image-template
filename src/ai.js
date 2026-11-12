/**
 * AI background layer — hybrid Satori + generated-background OG cards.
 *
 * Architecture:
 *   1. Build a prompt that asks for a BACKGROUND ONLY (never text).
 *   2. Call the media generation service for a background image.
 *   3. Satori renders the title/description as a transparent overlay.
 *   4. sharp composites background + scrim + text into the final PNG.
 *
 * The generation service is called over HTTP rather than embedding a
 * provider SDK: it is the existing internal media service, which already
 * owns provider credentials, concurrency limiting, asset rehosting and
 * retention. This module never sees a provider key and never names the
 * upstream provider in any error surfaced to a caller.
 *
 * If the media service is unreachable, slow, or errors, the caller falls
 * back to the plain Satori-only render. Social crawlers never get a 500.
 */

import satori from 'satori';
import sharp from 'sharp';
import { buildOGOverlay } from './overlay.js';
import { getFontsForText } from './fonts.js';
import config from './config.js';

const WIDTH = 1200;
const HEIGHT = 630;

/**
 * Preset background styles. The caller may only pick from this list —
 * a free-form prompt would be a direct provider-billing abuse surface.
 */
export const STYLES = {
  photo: 'cinematic photograph, soft depth of field, premium editorial lighting',
  gradient3d: 'premium 3D render, soft glossy abstract shapes, dark studio lighting',
  illustration: 'modern flat illustration, bold shapes, minimal, editorial style',
  minimal: 'clean minimal abstract background, subtle grain, soft gradient',
};

const DEFAULT_STYLE = 'gradient3d';

/**
 * Build the background prompt.
 *
 * Two rules matter:
 *  - The AI must never draw text (it misspells, and it would collide
 *    with our own overlay).
 *  - The left side must stay dark and empty so the overlay stays legible.
 *
 * @param {{title: string, description: string, style: string}} params
 * @returns {string}
 */
export function buildPrompt({ title, description, style = DEFAULT_STYLE }) {
  const styleText = STYLES[style] || STYLES[DEFAULT_STYLE];
  return [
    `Open Graph background, 1200x630, ${styleText}.`,
    `Theme inspired by: "${title} - ${description}".`,
    'Composition: left 55% is darker, clean and mostly empty for text overlay.',
    'Main visual interest on the right side.',
    'No text, no letters, no numbers, no logo, no watermark, no captions.',
    'High contrast, readable, not busy.',
  ].join(' ');
}

/**
 * Validate + normalize the style parameter.
 * @param {string} style
 * @returns {string} a key of STYLES
 */
export function normalizeStyle(style) {
  const key = String(style || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(STYLES, key) ? key : DEFAULT_STYLE;
}

/**
 * Ask the media service for a background image.
 *
 * The media service sleeps when idle, so the first call after a quiet period
 * may hit a cold start. Retries with backoff cover that — a cold start must
 * not push a social crawler onto the fallback path.
 *
 * @param {{title: string, description: string, style: string}} params
 * @param {number} [attempts]
 * @returns {Promise<Buffer>} image bytes
 */
async function generateBackground({ title, description, style }, attempts = 3) {
  const endpoint = `${config.mediaApiBaseUrl}/image/generate`;
  const payload = {
    prompt: buildPrompt({ title, description, style }),
    width: WIDTH,
    height: HEIGHT,
  };

  const headers = { 'Content-Type': 'application/json' };
  if (config.internalApiKey) {
    headers['X-Internal-Auth'] = config.internalApiKey;
  }
  if (config.ingestToken) {
    headers['X-Ingest-Token'] = config.ingestToken;
  }

  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await requestBackground(endpoint, payload, headers);
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
      }
    }
  }
  throw lastErr;
}

/**
 * One generation request against the media service.
 *
 * @param {string} endpoint
 * @param {Object} payload
 * @param {Object} headers
 * @returns {Promise<Buffer>} image bytes
 */
async function requestBackground(endpoint, payload, headers) {
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(config.mediaTimeoutMs),
  });

  if (!resp.ok) {
    throw new Error(`media service returned ${resp.status}`);
  }

  const body = await resp.json();
  const url = body.image_url || body.url;
  if (!url || typeof url !== 'string') {
    throw new Error('media service returned no image URL');
  }

  const imgResp = await fetch(url, {
    signal: AbortSignal.timeout(config.mediaTimeoutMs),
  });
  if (!imgResp.ok) {
    throw new Error(`generated asset fetch returned ${imgResp.status}`);
  }

  const buffer = Buffer.from(await imgResp.arrayBuffer());
  if (!buffer.length) {
    throw new Error('generated asset was empty');
  }
  return buffer;
}

/**
 * The darkening scrim that keeps white text readable over any background.
 * @returns {Promise<Buffer>} PNG buffer
 */
async function renderScrim() {
  const svg = `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="scrim" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#000000" stop-opacity="0.78"/>
      <stop offset="0.55" stop-color="#000000" stop-opacity="0.42"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#scrim)"/>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Render the text overlay as a transparent PNG.
 *
 * @param {{title: string, description: string, badge: string}} params
 * @returns {Promise<Buffer>} PNG buffer with alpha
 */
async function renderOverlay(params) {
  const text = [params.title, params.description, params.badge].filter(Boolean).join(' ');
  const fonts = await getFontsForText(text);

  const svg = await satori(buildOGOverlay(params), {
    width: WIDTH,
    height: HEIGHT,
    fonts,
    // Embed the fonts as base64 in the SVG. Sharp/librsvg has no access to
    // the webfonts we fetched, so without this the glyphs disappear.
    embedFont: true,
  });

  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Render a full hybrid OG image: generated background + Satori text.
 *
 * @param {{title: string, description: string, badge: string, style: string}} params
 * @returns {Promise<Buffer>} PNG buffer
 */
export async function renderHybridImage(params) {
  const background = await generateBackground(params);

  const bg = await sharp(background)
    .resize(WIDTH, HEIGHT, { fit: 'cover' })
    .png()
    .toBuffer();

  const scrim = await renderScrim();
  const overlay = await renderOverlay(params);

  return sharp(bg)
    .composite([
      { input: scrim },
      { input: overlay },
    ])
    .png()
    .toBuffer();
}

/**
 * Render the overlay with an AI-generated background, falling back to the
 * plain Satori render when the media service is unavailable.
 *
 * @param {Object} params
 * @param {Function} fallbackRenderer - (params) => Promise<Buffer>
 * @returns {Promise<{buffer: Buffer, fallback: boolean}>}
 */
export async function renderHybridOrFallback(params, fallbackRenderer) {
  try {
    const buffer = await renderHybridImage(params);
    return { buffer, fallback: false };
  } catch (err) {
    console.warn(`AI background unavailable (${err.message}); using plain render`);
    const buffer = await fallbackRenderer(params);
    return { buffer, fallback: true };
  }
}

export { WIDTH, HEIGHT };
