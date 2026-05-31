/**
 * OG Image generation module.
 * Uses Satori for JSX→SVG, then sharp for SVG→PNG.
 * Falls back to simple SVG generation if Satori fails or times out.
 */

import satori from 'satori';
import sharp from 'sharp';
import { buildOGRect, WIDTH, HEIGHT } from './template.js';
import { renderFallbackPNG } from './fallback.js';
import { getFonts } from './fonts.js';
import config from './config.js';

/**
 * Validate and normalize input parameters.
 */
function validateParams(query) {
  const title = query.title
    ? String(query.title).trim().slice(0, 60)
    : 'OG Image';

  const description = query.description
    ? String(query.description).trim().slice(0, 120)
    : '';

  let imageUrl = query.image
    ? String(query.image).trim()
    : '';

  // Basic URL validation
  if (imageUrl && !imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
    imageUrl = '';
  }

  return { title, description, imageUrl };
}

/**
 * Generate OG image using Satori + sharp.
 * Falls back to simple SVG if Satori fails.
 * @param {Object} params - { title, description, imageUrl }
 * @returns {Promise<Buffer>} PNG buffer
 */
export async function generateOGImage(query) {
  const params = validateParams(query);
  const timeoutMs = config.timeoutMs;

  try {
    // Attempt Satori generation with timeout
    const pngBuffer = await generateWithSatori(params, timeoutMs);
    return pngBuffer;
  } catch (err) {
    if (config.isDebug) {
      console.error(`Satori generation failed: ${err.message}`);
    }
    console.warn(`Falling back to simple SVG for OG image (title: "${params.title}")`);
    return renderFallbackPNG(params.title, params.description);
  }
}

/**
 * Generate image using Satori with a timeout wrapper.
 */
async function generateWithSatori(params, timeoutMs) {
  const fonts = await getFonts();

  // Create the VDOM tree
  const vdom = buildOGRect(params);

  // Timeout promise
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Satori generation timed out')), timeoutMs)
  );

  // Satori converts VDOM → SVG
  const svg = await Promise.race([
    satori(vdom, {
      width: WIDTH,
      height: HEIGHT,
      fonts: fonts.length > 0 ? fonts : [
        { name: 'sans-serif', weight: 400, style: 'normal', data: new Uint8Array(0) }
      ],
    }),
    timeoutPromise,
  ]);

  // sharp converts SVG → PNG
  const pngBuffer = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();

  return pngBuffer;
}
