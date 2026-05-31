/**
 * Fallback image generator.
 * Generates a simple SVG directly (no Satori needed) when Satori fails or times out.
 */

import sharp from 'sharp';

const WIDTH = 1200;
const HEIGHT = 630;

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(text, maxLen) {
  if (!text || text.length <= maxLen) return text || '';
  return text.slice(0, maxLen - 3) + '...';
}

/**
 * Generate a fallback SVG image.
 * @param {string} title
 * @param {string} description
 * @returns {string} SVG markup
 */
export function generateFallbackSVG(title, description) {
  const safeTitle = escapeXml(truncate(title || 'OG Image', 60));
  const safeDesc = escapeXml(truncate(description || '', 120));

  return `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#16213e;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0f3460;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)" />
  <circle cx="1100" cy="-50" r="250" fill="rgba(79,172,254,0.1)" />
  <text x="60" y="280" font-family="sans-serif" font-size="64" font-weight="bold" fill="#ffffff">${safeTitle}</text>
  ${safeDesc ? `<text x="60" y="360" font-family="sans-serif" font-size="28" fill="#cccccc">${safeDesc}</text>` : ''}
  <text x="1050" y="600" font-family="sans-serif" font-size="14" fill="rgba(255,255,255,0.3)">railway-og-image</text>
</svg>`;
}

/**
 * Render a fallback PNG image.
 * @param {string} title
 * @param {string} description
 * @returns {Promise<Buffer>} PNG buffer
 */
export async function renderFallbackPNG(title, description) {
  const svg = generateFallbackSVG(title, description);
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export { WIDTH, HEIGHT };
