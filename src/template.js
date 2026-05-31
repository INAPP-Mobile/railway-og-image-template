/**
 * Satori template for OG image generation.
 * Returns a JSX-like virtual DOM tree that Satori can render.
 */

const WIDTH = 1200;
const HEIGHT = 630;

function truncate(text, maxLen) {
  if (!text || text.length <= maxLen) return text || '';
  return text.slice(0, maxLen - 3) + '...';
}

/**
 * Build the OG image VDOM tree.
 * @param {Object} opts
 * @param {string} opts.title
 * @param {string} opts.description
 * @param {string} [opts.imageUrl]
 * @returns {Object} Satori-compatible VDOM element
 */
export function buildOGRect(opts) {
  const title = truncate(opts.title || 'OG Image', 60);
  const description = truncate(opts.description || '', 120);
  const imageUrl = opts.imageUrl || null;

  const children = [];

  // Main content area
  const contentChildren = [];

  // Title
  contentChildren.push({
    type: 'div',
    props: {
      style: {
        fontSize: '64px',
        fontWeight: 700,
        color: '#ffffff',
        lineHeight: 1.2,
        marginBottom: description ? '16px' : '0',
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
          fontSize: '28px',
          color: '#cccccc',
          lineHeight: 1.4,
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
          width: '200px',
          height: '200px',
          borderRadius: '16px',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundImage: `url(${imageUrl})`,
          flexShrink: 0,
          border: '2px solid rgba(255,255,255,0.1)',
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
        paddingRight: imageUrl ? '40px' : '0',
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

  // Footer text
  const footer = {
    type: 'div',
    props: {
      style: {
        position: 'absolute',
        bottom: '24px',
        right: '40px',
        fontSize: '14px',
        color: 'rgba(255,255,255,0.3)',
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
        padding: '60px',
        position: 'relative',
        overflow: 'hidden',
      },
      children: [
        // Decorative accent
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: '-100px',
              right: '-100px',
              width: '400px',
              height: '400px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(79,172,254,0.15) 0%, transparent 70%)',
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
              zIndex: 1,
            },
            children: rowChildren,
          },
        },
        footer,
      ],
    },
  };
}

export { WIDTH, HEIGHT };
