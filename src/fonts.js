import config from './config.js';

let fontCache = null;
let fontFetchAttempted = false;

const SYSTEM_FONTS = {
  sans: {
    name: 'Noto Sans SC',
    weight: 400,
    style: 'normal',
  },
  sansBold: {
    name: 'Noto Sans SC',
    weight: 700,
    style: 'normal',
  },
};

/**
 * Build a Google Fonts CSS URL for Noto Sans SC with weights 400 and 700.
 */
function defaultFontUrl() {
  return 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&text='
    + encodeURIComponent('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-–—.,!?()[]{}@#$%^&*+=/\\|:;\'""<>~` _');
}

/**
 * Fetch font data from Google Fonts API.
 * Returns array of { name, weight, style, data: ArrayBuffer }
 */
async function fetchGoogleFonts(url) {
  // Fetch the CSS to get the actual font file URL
  const cssResp = await fetch(url);
  if (!cssResp.ok) throw new Error(`Font CSS fetch failed: ${cssResp.status}`);
  const css = await cssResp.text();

  // Parse woff2 URLs from the CSS
  const urlRegex = /url\(([^)]+)\)/g;
  const fontUrls = [];
  let match;
  while ((match = urlRegex.exec(css)) !== null) {
    fontUrls.push(match[1].replace(/['"]/g, ''));
  }

  if (fontUrls.length === 0) {
    throw new Error('No font URLs found in CSS');
  }

  // Fetch the first font file (usually the regular weight)
  const fontResp = await fetch(fontUrls[0]);
  if (!fontResp.ok) throw new Error(`Font file fetch failed: ${fontResp.status}`);
  const fontData = await fontResp.arrayBuffer();

  return fontData;
}

/**
 * Get font data for Satori.
 * Returns array of { name: string, weight: number, style: string, data: ArrayBuffer }
 */
export async function getFonts() {
  if (fontCache) return fontCache;

  let fontData;

  if (!fontFetchAttempted) {
    fontFetchAttempted = true;
    const fontUrl = config.fontUrl || defaultFontUrl();
    try {
      fontData = await fetchGoogleFonts(fontUrl);
    } catch (err) {
      console.warn(`Font fetch failed (${err.message}), using fallback sans-serif`);
      fontData = null;
    }
  }

  if (!fontData) {
    // Satori needs at least one font — return minimal placeholder
    fontCache = [];
    return fontCache;
  }

  const buffer = new Uint8Array(fontData).buffer;
  fontCache = [
    { name: 'Noto Sans SC', weight: 400, style: 'normal', data: buffer },
    { name: 'Noto Sans SC', weight: 700, style: 'normal', data: buffer },
  ];
  return fontCache;
}

export function hasFonts() {
  return fontCache !== null && fontCache.length > 0;
}
