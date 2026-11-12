/**
 * Satori template for OG image generation.
 * Returns a JSX-like virtual DOM tree that Satori can render.
 *
 * Satori specifics that shape this file:
 *  - `fontFamily` must be a comma-separated STRING (an array throws).
 *  - `fontWeight` only picks a real weight if a font file is registered for
 *    that exact weight. fonts.js registers one real file per weight.
 *  - `zIndex` must be unitless (it is not a CSS length).
 */

const WIDTH = 1200;
const HEIGHT = 630;

const FONT_STACK =
  'Noto Sans, Noto Sans KR, Noto Sans TC, Noto Sans JP, Noto Sans SC, Noto Emoji';

const COLORS = {
  title: '#ffffff',
  description: '#c7d2e4',
  badge: '#8fd3ff',
  badgeBg: 'rgba(79,172,254,0.14)',
  badgeBorder: 'rgba(143,211,255,0.32)',
  brand: 'rgba(255,255,255,0.42)',
};

function truncate(text, maxLen) {
  if (!text || text.length <= maxLen) return text || '';
  return text.slice(0, maxLen - 3).trimEnd() + '...';
}

/**
 * Estimate how many lines the title will occupy so the font size can be
 * scaled down for long titles instead of overflowing the canvas.
 *
 * Satori does not expose text measurement before layout, so this is a
 * conservative estimate based on average glyph advance widths.
 */
function fitTitleSize(title, hasImage) {
  const len = title.length;
  const maxWidth = hasImage ? 760 : 1040;

  // Average advance width is roughly 0.52em for Noto Sans at bold weight.
  const charsPerLine = Math.max(12, Math.floor(maxWidth / (64 * 0.52)));

  if (len <= charsPerLine) return 68;
  if (len <= charsPerLine * 2) return 56;
  if (len <= charsPerLine * 3) return 46;
  return 38;
}

/**
 * Build the OG image VDOM tree.
 * @param {Object} opts
 * @param {string} opts.title
 * @param {string} opts.description
 * @param {string} [opts.imageUrl]
 * @param {string} [opts.badge] - Optional eyebrow/label above the title
 * @returns {Object} Satori-compatible VDOM element
 */
export function buildOGRect(opts) {
  const title = truncate(opts.title || 'OG Image', 60);
  const description = truncate(opts.description || '', 120);
  const imageUrl = opts.imageUrl || null;
  const badge = opts.badge ? truncate(opts.badge, 28) : '';

  const titleSize = fitTitleSize(title, Boolean(imageUrl));

  const contentChildren = [];

  // Eyebrow badge
  if (badge) {
    contentChildren.push({
      type: 'div',
      props: {
        style: {
          display: 'flex',
          alignSelf: 'flex-start',
          alignItems: 'center',
          padding: '6px 14px',
          marginBottom: '22px',
          borderRadius: '999px',
          background: COLORS.badgeBg,
          border: `1px solid ${COLORS.badgeBorder}`,
          fontSize: '20px',
          fontWeight: 700,
          color: COLORS.badge,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        },
        children: badge,
      },
    });
  }

  // Title
  contentChildren.push({
    type: 'div',
    props: {
      style: {
        fontSize: `${titleSize}px`,
        fontWeight: 700,
        color: COLORS.title,
        lineHeight: 1.18,
        marginBottom: description ? '20px' : '0',
        textAlign: 'left',
        wordBreak: 'break-word',
      },
      children: title,
    },
  });

  // Description
  if (description) {
    contentChildren.push({
      type: 'div',
      props: {
        style: {
          fontSize: '26px',
          fontWeight: 400,
          color: COLORS.description,
          lineHeight: 1.45,
          textAlign: 'left',
          wordBreak: 'break-word',
        },
        children: description,
      },
    });
  }

  // Right side image
  const rightChildren = [];
  if (imageUrl) {
    rightChildren.push({
      type: 'div',
      props: {
        style: {
          display: 'flex',
          width: '300px',
          height: '300px',
          borderRadius: '24px',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundImage: `url(${imageUrl})`,
          flexShrink: 0,
          border: '2px solid rgba(255,255,255,0.14)',
          boxShadow: '0 18px 50px rgba(0,0,0,0.45)',
        },
      },
    });
  }

  // Row layout
  const rowChildren = [];
  rowChildren.push({
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        flex: 1,
        paddingRight: imageUrl ? '48px' : '0',
      },
      children: contentChildren,
    },
  });

  if (imageUrl) {
    rowChildren.push({
      type: 'div',
      props: {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        },
        children: rightChildren,
      },
    });
  }

  // Brand mark — a small pill in the bottom-right so it reads as branding
  // rather than stray debug text.
  const footer = {
    type: 'div',
    props: {
      style: {
        position: 'absolute',
        bottom: '32px',
        right: '48px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 14px',
        borderRadius: '999px',
        background: 'rgba(255,255,255,0.06)',
        fontSize: '15px',
        fontWeight: 700,
        color: COLORS.brand,
        letterSpacing: '0.02em',
      },
      children: 'railway-og-image',
    },
  };

  // Main container
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: `${WIDTH}px`,
        height: `${HEIGHT}px`,
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        padding: '64px',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: FONT_STACK,
      },
      children: [
        // Decorative accent — soft radial glow, top-right.
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: '-140px',
              right: '-140px',
              width: '520px',
              height: '520px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(79,172,254,0.20) 0%, transparent 70%)',
            },
          },
        },
        // Secondary accent — subtle warm glow, bottom-left.
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              bottom: '-180px',
              left: '-120px',
              width: '460px',
              height: '460px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(120,86,255,0.16) 0%, transparent 70%)',
            },
          },
        },
        // Accent rule above the title.
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              left: '64px',
              top: '96px',
              width: '72px',
              height: '6px',
              borderRadius: '3px',
              background: 'linear-gradient(90deg, #4faced 0%, rgba(79,172,254,0) 100%)',
            },
          },
        },
        // Main row
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'row',
              flex: 1,
              alignItems: 'center',
              position: 'relative',
            },
            children: rowChildren,
          },
        },
        footer,
      ],
    },
  };
}

export { WIDTH, HEIGHT, FONT_STACK };
