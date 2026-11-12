/**
 * Fallback image generator.
 * Generates a simple SVG directly (no Satori needed) when Satori fails or times out.
 */

import sharp from 'sharp';

const WIDTH = 1200;
const HEIGHT = 630;

const TITLE_MAX = 60;
const DESC_MAX = 120;

/** Left margin used by every text block. */
const PAD_X = 64;
const PAD_Y = 96;

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(text, maxLen) {
  if (!text || text.length <= maxLen) return text || '';
  return text.slice(0, maxLen - 3).trimEnd() + '...';
}

/**
 * Greedy word wrap against an approximate character budget.
 *
 * SVG <text> does not wrap on its own, and a single long line runs straight
 * off the canvas. We estimate width from the character count instead of
 * measuring glyphs — good enough for a fallback that must never overflow.
 *
 * @param {string} text
 * @param {number} fontSize
 * @param {number} maxWidth
 * @returns {string[]}
 */
function wrapText(text, fontSize, maxWidth) {
  // Average glyph advance for a bold sans-serif is ~0.55em.
  const charBudget = Math.max(8, Math.floor(maxWidth / (fontSize * 0.55)));

  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (!words.length) return [];

  const lines = [];
  let current = '';

  for (const word of words) {
    // A single word longer than the budget has to be hard-split.
    if (word.length > charBudget) {
      if (current) {
        lines.push(current);
        current = '';
      }
      let rest = word;
      while (rest.length > charBudget) {
        lines.push(rest.slice(0, charBudget));
        rest = rest.slice(charBudget);
      }
      current = rest;
      continue;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > charBudget) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) lines.push(current);
  return lines;
}

/**
 * Generate a fallback SVG image.
 * @param {string} title
 * @param {string} description
 * @returns {string} SVG markup
 */
export function generateFallbackSVG(title, description) {
  const safeTitle = escapeXml(truncate(title || 'OG Image', TITLE_MAX));
  const safeDesc = escapeXml(truncate(description || '', DESC_MAX));

  const titleSize = 60;
  const descSize = 26;
  const lineHeight = titleSize * 1.2;

  const titleLines = wrapText(truncate(title || 'OG Image', TITLE_MAX), titleSize, WIDTH - PAD_X * 2);
  const descLines = wrapText(truncate(description || '', DESC_MAX), descSize, WIDTH - PAD_X * 2);

  // Vertically centre the title block, then stack the description under it.
  const titleBlockHeight = titleLines.length * lineHeight;
  const descBlockHeight = descLines.length ? descSize * 1.5 + 24 : 0;
  const totalHeight = titleBlockHeight + descBlockHeight;
  const startY = Math.max(PAD_Y, (HEIGHT - totalHeight) / 2 + titleSize);

  const titleSvg = titleLines
    .map((line, i) => {
      const y = startY + i * lineHeight;
      return `<text x="${PAD_X}" y="${y}" font-family="Noto Sans, Noto Sans KR, Noto Sans SC, sans-serif" font-size="${titleSize}" font-weight="700" fill="#ffffff">${escapeXml(line)}</text>`;
    })
    .join('\n  ');

  const descSvg = descLines
    .map((line, i) => {
      const y = startY + titleBlockHeight + 24 + descSize * 1.2 + i * descSize * 1.5;
      return `<text x="${PAD_X}" y="${y}" font-family="Noto Sans, Noto Sans KR, Noto Sans SC, sans-serif" font-size="${descSize}" fill="#c7d2e4">${escapeXml(line)}</text>`;
    })
    .join('\n  ');

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
  <rect x="${PAD_X}" y="${PAD_Y - 44}" width="72" height="6" rx="3" fill="rgba(79,172,254,0.5)" />
  ${titleSvg}
  ${descSvg}
  <text x="${WIDTH - PAD_X}" y="${HEIGHT - 32}" text-anchor="end" font-family="Noto Sans, sans-serif" font-size="15" font-weight="700" fill="rgba(255,255,255,0.42)">railway-og-image</text>
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

export { WIDTH, HEIGHT, wrapText };
