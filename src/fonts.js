/**
 * Font loading and caching for Satori.
 *
 * Design notes (all verified empirically against satori 0.12 + sharp):
 *
 *  - Satori's `fontFamily` must be a COMMA-SEPARATED STRING. Passing an array
 *    throws `t.split is not a function`. Fallback across families therefore
 *    works by listing families in priority order in one string.
 *  - One buffer can NOT back two weights. Registering the same 400-weight
 *    buffer as 700 produces "fake bold" (a ghosted double-stroke), measured
 *    as 7px stems instead of 12px. Every weight needs its own real font file.
 *  - Google Fonts `text=` subsetting is per family AND per script. Asking
 *    `Noto Sans SC` for Hangul returns an HTML error page, not a font.
 *    We therefore split the text by script and fetch each script from its own
 *    family (Noto Sans / KR / SC / JP / TC / Emoji).
 *
 * Fonts are subset to only the characters actually used, so a CJK title costs
 * a few KB instead of the ~10MB full CJK font.
 */

import config from './config.js';

const GOOGLE_CSS = 'https://fonts.googleapis.com/css2?family=';

/**
 * Script buckets, in fallback priority order. The first entry (Latin) is the
 * primary family; later entries only get loaded when the text needs them.
 */
const SCRIPTS = [
  {
    family: 'Noto Sans',
    css: 'Noto+Sans',
    // ASCII + Latin-1 + Latin Extended + general punctuation.
    match: /[\u0020-\u007E\u00A0-\u00FF\u0100-\u024F\u2000-\u206F\u20A0-\u20BF]/,
  },
  {
    family: 'Noto Sans KR',
    css: 'Noto+Sans+KR',
    // Hangul Jamo, Compatibility Jamo, Jamo Extended-A, Hangul Syllables.
    match: /[\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uAC00-\uD7AF]/,
  },
  {
    family: 'Noto Sans TC',
    css: 'Noto+Sans+TC',
    // Bopomofo.
    match: /[\u3100-\u312F\u31A0-\u31BF]/,
  },
  {
    family: 'Noto Sans JP',
    css: 'Noto+Sans+JP',
    // Hiragana, Katakana, halfwidth Katakana, Katakana phonetic extensions.
    match: /[\u3040-\u30FF\u31F0-\u31FF\uFF66-\uFF9F]/,
  },
  {
    family: 'Noto Sans SC',
    css: 'Noto+Sans+SC',
    // CJK radicals, CJK punctuation, CJK Ext-A, CJK Unified, compat ideographs.
    match: /[\u2E80-\u2FFF\u3000-\u303F\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/,
  },
  {
    family: 'Noto Emoji',
    css: 'Noto+Emoji',
    match: /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\uFE0F]/u,
  },
];

const WEIGHTS = [400, 700];

/** Printable ASCII — preloaded at startup so the common case never waits. */
const ASCII_CHARSET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' +
  ' !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~';

const MAX_CACHE_ENTRIES = 96;

/** Per-HTTP-request timeout for font fetches. */
const FETCH_TIMEOUT_MS = 5000;

/**
 * key -> { family, weight, data: ArrayBuffer, chars: Set<string> }
 * One entry per (family, weight, exact charset). Subset reuse is decided by
 * coverage: an entry can serve a request when it already contains every
 * character that request needs.
 */
const cache = new Map();

let preloadPromise = null;
let customFontsPromise = null;

/** Guard against a poisoned cache: a failed fetch must never be cached. */
let lastFailureAt = 0;
const FAILURE_BACKOFF_MS = 5000;

function isCacheCoolingDown() {
  return Date.now() - lastFailureAt < FAILURE_BACKOFF_MS;
}

/**
 * Split text into per-script character sets.
 * @param {string} text
 * @returns {Map<string, Set<string>>} family -> chars
 */
function charsByFamily(text) {
  const result = new Map();
  if (!text) return result;

  for (const char of text) {
    for (const script of SCRIPTS) {
      if (script.match.test(char)) {
        let set = result.get(script.family);
        if (!set) {
          set = new Set();
          result.set(script.family, set);
        }
        set.add(char);
        break; // first matching script wins (priority order)
      }
    }
  }
  return result;
}

function findCoveringEntry(family, weight, chars) {
  for (const entry of cache.values()) {
    if (entry.family !== family || entry.weight !== weight) continue;
    let covers = true;
    for (const char of chars) {
      if (!entry.chars.has(char)) {
        covers = false;
        break;
      }
    }
    if (covers) return entry;
  }
  return null;
}

function cacheEntry(entry) {
  cache.set(entry.key, entry);
  // Simple FIFO eviction — the cache is small and the hot entries are the
  // preloaded ASCII ones, which are inserted first.
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  return entry;
}

/**
 * Fetch a subsetted font from Google Fonts.
 * Retries with exponential backoff — a single blip must not fail the render.
 * @param {string} cssFamily e.g. 'Noto+Sans+KR'
 * @param {number} weight
 * @param {string} charset
 * @returns {Promise<ArrayBuffer>}
 */
async function fetchSubset(cssFamily, weight, charset) {
  const url =
    `${GOOGLE_CSS}${cssFamily}:wght@${weight}&text=` + encodeURIComponent(charset);

  const cssResp = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; og-image-generator)' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!cssResp.ok) {
    throw new Error(`Font CSS fetch failed for ${cssFamily}@${weight}: ${cssResp.status}`);
  }

  const css = await cssResp.text();

  // A Google Fonts error page is HTML, not CSS. Treat that as a hard failure
  // instead of silently "parsing" a bogus URL out of it.
  if (!/@font-face/.test(css)) {
    throw new Error(`Font CSS for ${cssFamily}@${weight} contained no @font-face`);
  }

  const urlMatch = css.match(/url\(([^)]+)\)/);
  if (!urlMatch) {
    throw new Error(`No font URL found for ${cssFamily}@${weight}`);
  }

  const fontUrl = urlMatch[1].replace(/['"]/g, '');
  const fontResp = await fetch(fontUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!fontResp.ok) {
    throw new Error(`Font file fetch failed for ${cssFamily}@${weight}: ${fontResp.status}`);
  }

  const buffer = Buffer.from(await fontResp.arrayBuffer());

  // Sanity check the magic bytes: TTF (00010000) or OTF (4f54544f).
  const magic = buffer.subarray(0, 4).toString('hex');
  if (magic !== '00010000' && magic !== '4f54544f') {
    throw new Error(`Font file for ${cssFamily}@${weight} was not a TTF/OTF (magic=${magic})`);
  }

  return new Uint8Array(buffer).buffer;
}

/**
 * fetchSubset with retries and exponential backoff.
 */
async function fetchSubsetWithRetry(cssFamily, weight, charset, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetchSubset(cssFamily, weight, charset);
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 250 * 2 ** i));
      }
    }
  }
  throw lastErr;
}

/**
 * Get (or fetch) a font subset for a family/weight/charset.
 * Never caches failures.
 */
async function getSubset(script, weight, chars) {
  const charset = [...chars].sort().join('');
  const existing = findCoveringEntry(script.family, weight, chars);
  if (existing) return existing;

  const key = `${script.family}|${weight}|${charset}`;
  const data = await fetchSubsetWithRetry(script.css, weight, charset);

  return cacheEntry({
    key,
    family: script.family,
    weight,
    data,
    chars: new Set(charset),
  });
}

/**
 * Load a custom font CSS URL (config.fontUrl) supplied by the operator.
 * Every @font-face in the stylesheet is registered with its declared weight,
 * which also fixes the fake-bold bug for custom URLs.
 */
async function loadCustomFonts() {
  if (!config.fontUrl) return null;
  if (customFontsPromise) return customFontsPromise;

  customFontsPromise = (async () => {
    const resp = await fetch(config.fontUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; og-image-generator)' },
    });
    if (!resp.ok) {
      throw new Error(`Custom font CSS fetch failed: ${resp.status}`);
    }
    const css = await resp.text();

    const faces = [];
    for (const block of css.split('@font-face').slice(1)) {
      const weightMatch = block.match(/font-weight:\s*(\d+)/);
      const urlMatch = block.match(/url\(([^)]+)\)/);
      if (!urlMatch) continue;
      const weight = weightMatch ? parseInt(weightMatch[1], 10) : 400;
      const fontUrl = urlMatch[1].replace(/['"]/g, '');
      const fontResp = await fetch(fontUrl);
      if (!fontResp.ok) continue;
      const buffer = Buffer.from(await fontResp.arrayBuffer());
      const magic = buffer.subarray(0, 4).toString('hex');
      if (magic !== '00010000' && magic !== '4f54544f') continue;
      faces.push({
        name: 'Custom',
        weight,
        style: 'normal',
        data: new Uint8Array(buffer).buffer,
      });
    }

    if (!faces.length) {
      throw new Error('Custom font CSS contained no usable @font-face');
    }
    return faces;
  })();

  try {
    return await customFontsPromise;
  } catch (err) {
    customFontsPromise = null; // allow a retry on the next request
    throw err;
  }
}

/**
 * Preload the Latin subset for both weights. Fire-and-forget at startup so
 * the overwhelmingly common ASCII request renders with zero font latency.
 */
export function preloadFonts() {
  if (preloadPromise) return preloadPromise;

  preloadPromise = (async () => {
    const script = SCRIPTS[0];
    const chars = new Set(ASCII_CHARSET);
    const entries = await Promise.all(
      WEIGHTS.map((w) => getSubset(script, w, chars)),
    );
    return entries;
  })().catch((err) => {
    preloadPromise = null;
    console.warn(`Font preload failed (${err.message}); will retry per request`);
    return [];
  });

  return preloadPromise;
}

/**
 * Build the Satori font list for a given text.
 * Returns one real font file per (family, weight) pair that the text needs.
 *
 * @param {string} text
 * @returns {Promise<Array<{name: string, weight: number, style: string, data: ArrayBuffer}>>}
 */
export async function getFontsForText(text) {
  // Operator-supplied fonts win outright.
  if (config.fontUrl) {
    try {
      const custom = await loadCustomFonts();
      if (custom && custom.length) return custom;
    } catch (err) {
      console.warn(`Custom font load failed (${err.message}); using built-in stack`);
    }
  }

  const byFamily = charsByFamily(text);

  // Ensure the base Latin font is available (also covers the pure-CJK case
  // where digits or punctuation may still appear).
  if (!byFamily.size) {
    byFamily.set(SCRIPTS[0].family, new Set(ASCII_CHARSET));
  }

  const scriptsNeeded = SCRIPTS.filter((s) => byFamily.has(s.family));
  const fonts = [];

  for (const script of scriptsNeeded) {
    const chars = byFamily.get(script.family);
    try {
      const entries = await Promise.all(
        WEIGHTS.map((w) => getSubset(script, w, chars)),
      );
      for (const entry of entries) {
        fonts.push({
          name: entry.family,
          weight: entry.weight,
          style: 'normal',
          data: entry.data,
        });
      }
    } catch (err) {
      // A script font that cannot be fetched (network blip, Google Fonts
      // outage) must not sink the whole render. The glyphs for that script
      // will be missing, but the card still renders.
      console.warn(`Font subset failed for ${script.family}: ${err.message}`);
    }
  }

  if (!fonts.length) {
    throw new Error('No usable fonts could be loaded');
  }

  return fonts;
}

/**
 * Backwards-compatible entry point: base Latin fonts only.
 */
export async function getFonts() {
  await preloadFonts();
  const entries = [];
  for (const [key, entry] of cache) {
    if (key.startsWith('Noto Sans|')) {
      entries.push({
        name: entry.family,
        weight: entry.weight,
        style: 'normal',
        data: entry.data,
      });
    }
  }
  return entries;
}

/**
 * The font-family stack handed to Satori. Satori needs a comma-separated
 * string here — an array throws.
 */
export function fontFamilyStack() {
  return SCRIPTS.map((s) => s.family).join(', ');
}

export function hasFonts() {
  return cache.size > 0;
}
