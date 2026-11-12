/**
 * OG Image generation module.
 * Uses Satori for JSX→SVG, then sharp for SVG→PNG.
 * Falls back to simple SVG generation if Satori fails or times out.
 */

import satori from 'satori';
import sharp from 'sharp';
import { buildOGRect, WIDTH, HEIGHT } from './template.js';
import { renderFallbackPNG } from './fallback.js';
import { getFontsForText, preloadFonts, fontFamilyStack } from './fonts.js';
import { renderHybridOrFallback, normalizeStyle, STYLES } from './ai.js';
import config from './config.js';

const MAX_TITLE = 60;
const MAX_DESCRIPTION = 120;
const MAX_BADGE = 28;

/** Per-request timeout for remote image fetches. */
const IMAGE_TIMEOUT_MS = 5000;

/**
 * Reject anything that is not an http(s) URL. This blocks `data:` and
 * `file:` URLs, which would otherwise let a caller pull arbitrary local
 * resources into the render.
 */
function safeRemoteUrl(raw) {
  if (!raw) return '';
  let parsed;
  try {
    parsed = new URL(String(raw).trim());
  } catch {
    return '';
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
  return parsed.toString();
}

/**
 * Fetch a remote image and return it as a data URI for Satori.
 *
 * Validates the content type and the magic bytes so an HTML error page (a very
 * common response from a stale URL or a blocked CDN) can never be embedded as
 * a picture. Returns null when the URL is unusable — the card then renders
 * without a thumbnail instead of with an empty box.
 *
 * @param {string} url
 * @returns {Promise<string|null>} data URI, or null
 */
async function fetchImageAsDataUri(url) {
  const safe = safeRemoteUrl(url);
  if (!safe) return null;

  let resp;
  try {
    resp = await fetch(safe, {
      signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
      redirect: 'follow',
    });
  } catch (err) {
    console.warn(`Image fetch failed for ${safe}: ${err.message}`);
    return null;
  }

  if (!resp.ok) {
    console.warn(`Image fetch returned ${resp.status} for ${safe}`);
    return null;
  }

  const contentType = (resp.headers.get('content-type') || '').toLowerCase();
  if (!contentType.startsWith('image/')) {
    console.warn(`Image URL returned non-image content-type "${contentType}" for ${safe}`);
    return null;
  }

  const buffer = Buffer.from(await resp.arrayBuffer());
  if (!buffer.length) {
    console.warn(`Image URL returned an empty body for ${safe}`);
    return null;
  }

  // Verify it really is an image by magic bytes, not just by the header.
  const magic = buffer.subarray(0, 12);
  const isJpeg = magic[0] === 0xff && magic[1] === 0xd8;
  const isPng = magic.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
  const isGif = magic.subarray(0, 3).toString('ascii') === 'GIF';
  const isWebp =
    magic.subarray(0, 4).toString('ascii') === 'RIFF' &&
    magic.subarray(8, 12).toString('ascii') === 'WEBP';
  const isAvif =
    magic.subarray(4, 8).toString('ascii') === 'ftyp' &&
    magic.subarray(8, 12).toString('ascii').startsWith('avif');

  if (!isJpeg && !isPng && !isGif && !isWebp && !isAvif) {
    console.warn(`Image URL did not return a recognised image format for ${safe}`);
    return null;
  }

  return `data:${contentType};base64,${buffer.toString('base64')}`;
}

/**
 * Validate and normalize input parameters.
 */
function validateParams(query) {
  const title = query.title
    ? String(query.title).trim().slice(0, MAX_TITLE)
    : 'OG Image';

  const description = query.description
    ? String(query.description).trim().slice(0, MAX_DESCRIPTION)
    : '';

  const badge = query.badge ? String(query.badge).trim().slice(0, MAX_BADGE) : '';

  const imageUrl = safeRemoteUrl(query.image);

  const style = normalizeStyle(query.style);

  const enhance = query.enhance === 'true' || query.enhance === '1';

  return { title, description, imageUrl, badge, style, enhance };
}

/**
 * Generate OG image using Satori + sharp.
 * Falls back to simple SVG if Satori fails.
 * @param {Object} query - { title, description, imageUrl, badge }
 * @returns {Promise<Buffer>} PNG buffer
 */
export async function generateOGImage(query) {
  const params = validateParams(query);
  const timeoutMs = config.timeoutMs;

  try {
    return await generateWithSatori(params, timeoutMs);
  } catch (err) {
    if (config.isDebug) {
      console.error(`Satori generation failed: ${err.message}`);
    }
    console.warn(`Falling back to simple SVG for OG image (title: "${params.title}")`);
    try {
      return await renderFallbackPNG(params.title, params.description);
    } catch (fallbackErr) {
      console.error(`Fallback generation also failed: ${fallbackErr.message}`);
      throw fallbackErr;
    }
  }
}

/**
 * Generate image using Satori with a timeout wrapper.
 */
async function generateWithSatori(params, timeoutMs) {
  // Fonts are chosen from the text itself, so CJK/emoji titles get their own
  // subsetted font files instead of rendering as tofu.
  const text = [params.title, params.description, params.badge].filter(Boolean).join(' ');
  const fonts = await getFontsForText(text);

  if (!fonts.length) {
    throw new Error('No fonts available');
  }

  // Fetch the thumbnail ourselves so we can validate it (and so Satori is
  // never handed a URL that resolves to an HTML error page).
  let imageUrl = null;
  if (params.imageUrl) {
    imageUrl = await fetchImageAsDataUri(params.imageUrl);
  }

  const vdom = buildOGRect({ ...params, imageUrl });

  // Satori converts VDOM → SVG. The timer is cleared once the race settles so
  // a slow-but-successful render does not leave a pending rejection behind.
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('Satori generation timed out')),
      timeoutMs,
    );
  });

  let svg;
  try {
    svg = await Promise.race([
      satori(vdom, {
        width: WIDTH,
        height: HEIGHT,
        fonts,
        // Embed the fonts as base64 in the SVG. Sharp/librsvg has no access
        // to the webfonts we fetched, so without this the glyphs disappear.
        embedFont: true,
      }),
      timeoutPromise,
    ]);
  } finally {
    clearTimeout(timer);
  }

  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Generate an OG image with a generated (AI) background.
 *
 * Falls back to the plain Satori render when the media service is
 * unavailable — a crawler must never receive a 500 because a background
 * generation failed.
 *
 * @param {Object} query - { title, description, badge, style }
 * @returns {Promise<{buffer: Buffer, fallback: boolean}>}
 */
export async function generateOGImageWithAI(query) {
  const params = validateParams(query);

  const plainRender = async (p) => {
    try {
      return await generateWithSatori(p, config.timeoutMs);
    } catch (err) {
      console.warn(`Plain render failed (${err.message}); using SVG fallback`);
      return renderFallbackPNG(p.title, p.description);
    }
  };

  return renderHybridOrFallback(params, plainRender);
}

export { preloadFonts, fontFamilyStack, STYLES };
