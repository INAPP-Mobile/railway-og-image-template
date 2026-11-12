/**
 * Satori overlay template for the hybrid (AI background + text) render.
 *
 * Produces a TRANSPARENT 1200x630 SVG that sharp composites over a
 * generated background. The plain (non-AI) card lives in template.js and
 * has its own gradient background; this file only draws the text layer so
 * the two renders stay visually consistent.
 *
 * Satori specifics that shape this file:
 *  - `fontFamily` must be a comma-separated STRING (an array throws).
 *  - `fontWeight` only picks a real weight if a font file is registered for
 *    that exact weight. fonts.js registers one real file per weight.
 */

const WIDTH = 1200;
const HEIGHT = 630;

const FONT_STACK =
  'Noto Sans, Noto Sans KR, Noto Sans TC, Noto Sans JP, Noto Sans SC, Noto Emoji';

const COLORS = {
  title: '#ffffff',
  description: '#e5e7eb',
  badge: '#a5d8ff',
  badgeBg: 'rgba(10,20,40,0.42)',
  badgeBorder: 'rgba(165,216,255,0.42)',
  brand: 'rgba(255,255,255,0.55)',
  accent: '#8fd3ff',
};

function truncate(text, maxLen) {
  if (!text || text.length <= maxLen) return text || '';
  return text.slice(0, maxLen - 3).trimEnd() + '...';
}

/**
 * Scale the title font size down as the title grows so a long headline
 * never overruns the canvas.
 *
 * @param {string} title
 * @returns {number} font size in px
 */
function fitTitleSize(title) {
  const len = title.length;
  if (len <= 26) return 72;
  if (len <= 38) return 62;
  if (len <= 50) return 52;
  if (len <= 62) return 44;
  return 38;
}

/**
 * Build the transparent text-overlay VDOM.
 *
 * @param {{title: string, description: string, badge: string}} opts
 * @returns {Object} Satori-compatible VDOM element
 */
export function buildOGOverlay(opts) {
  const title = truncate(opts.title || 'OG Image', 60);
  const description = truncate(opts.description || '', 120);
  const badge = opts.badge ? truncate(opts.badge, 28) : '';

  const titleSize = fitTitleSize(title);

  const contentChildren = [];

  if (badge) {
    contentChildren.push({
      type: 'div',
      props: {
        style: {
          display: 'flex',
          alignSelf: 'flex-start',
          alignItems: 'center',
          padding: '6px 14px',
          marginBottom: '20px',
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

  contentChildren.push({
    type: 'div',
    props: {
      style: {
        fontSize: `${titleSize}px`,
        fontWeight: 700,
        color: COLORS.title,
        lineHeight: 1.14,
        marginBottom: description ? '18px' : '0',
        textAlign: 'left',
        wordBreak: 'break-word',
        // A soft shadow keeps the headline legible even if the generated
        // background is bright in the text area.
        textShadow: '0 2px 18px rgba(0,0,0,0.55)',
      },
      children: title,
    },
  });

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
          textShadow: '0 1px 12px rgba(0,0,0,0.5)',
        },
        children: description,
      },
    });
  }

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start',
        width: `${WIDTH}px`,
        height: `${HEIGHT}px`,
        padding: '0 72px',
        background: 'transparent',
        fontFamily: FONT_STACK,
      },
      children: [
        // Accent rule above the title.
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              left: '72px',
              top: '84px',
              width: '72px',
              height: '6px',
              borderRadius: '3px',
              background: `linear-gradient(90deg, ${COLORS.accent} 0%, rgba(143,211,255,0) 100%)`,
            },
          },
        },
        // Text column — capped so it never runs under the subject on the
        // right-hand side of a generated background.
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              maxWidth: '780px',
            },
            children: contentChildren,
          },
        },
        // Brand mark.
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              bottom: '32px',
              right: '48px',
              display: 'flex',
              alignItems: 'center',
              padding: '6px 14px',
              borderRadius: '999px',
              background: 'rgba(0,0,0,0.32)',
              fontSize: '15px',
              fontWeight: 700,
              color: COLORS.brand,
              letterSpacing: '0.02em',
            },
            children: 'railway-og-image',
          },
        },
      ],
    },
  };
}

export { WIDTH, HEIGHT, FONT_STACK };
