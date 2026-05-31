# OG Image Generation API — Railway Template

## Overview

Build a Railway-deployable Node.js API that generates Open Graph (OG) images on the fly. Uses **Satori** (JSX→SVG) + **sharp** (SVG→PNG). No Puppeteer — keeps memory under 512MB for Railway free tier.

## API Endpoints

### GET /og-image
Generate an OG image as PNG.

**Query Parameters:**
| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `title` | No | `"OG Image"` | Main heading text |
| `description` | No | `""` | Subtitle/description text |
| `image` | No | `""` | Optional URL to embed an image on the right side |

**Response:** `image/png` — binary PNG data

**Error Response (400):** JSON `{ "error": "message" }`

### GET /health
Health check endpoint.

**Response:** JSON `{ "status": "healthy" }`

### GET /
Root redirect or info.

**Response:** JSON `{ "app": "OG Image Generator", "version": "1.0.0" }`

## OG Image Design (Satori template)

Create a JSX component that renders a modern, clean OG image at **1200×630px** (standard OG size):

- Background: dark gradient (#1a1a2e → #16213e)
- Title: Large white text, centered, max 60 chars, auto-truncate with "..." if longer
- Description: Smaller gray (#ccc) text below title, centered, max 120 chars
- Optional image: If `image` param is provided, render a rounded image on the right side (200×200px, border-radius 16px)
- Railway logo or subtle branding at bottom-right corner
- Font: Use Noto Sans SC (or system monospace fallback if font loading fails)

Font handling: Load a bundled font file (Noto Sans SC regular + bold) or use fetch to load from Google Fonts at startup. Cache the font buffer in memory.

## Technical Requirements

### Stack
- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **OG Engine**: Satori (JSX→SVG)
- **Image Conversion**: sharp (SVG→PNG)
- **JSX**: Use `hast-util-from-html` or React-like virtual DOM — Satori accepts a JSX-like tree. Use `@vercel/satori` with a simple vdom approach.

### Memory Management
- No Puppeteer or headless browser
- Keep SVG DOM small (single page, no complex layouts)
- Stream responses — don't buffer entire PNG in memory
- Set timeout: 10 seconds max per request
- Fallback: If generation takes > 8s or errors, return a simple SVG-based fallback image

### Files to Create

```
railway-og-image-template/
├── package.json              # Dependencies: express, @vercel/satori, sharp, etc.
├── railway.json              # Railway deployment config
├── .env.sample               # Environment variables template
├── .gitignore                # node_modules, .env, etc.
├── README.md                 # Docs with deploy button
├── src/
│   ├── index.js              # Express app entry point
│   ├── og.js                 # OG image generation (Satori + sharp)
│   ├── template.js           # Satori JSX component / vdom template
│   ├── fallback.js           # Fallback image generator (simple SVG)
│   ├── fonts.js              # Font loading and caching
│   └── config.js             # Environment config
├── fonts/
│   └── .gitkeep              # Keep dir so fonts can be bundled
```

### Dependencies (package.json)
```json
{
  "name": "railway-og-image-template",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "express": "^4.18.2",
    "@vercel/satori": "^0.5.0",
    "sharp": "^0.33.0",
    "satori": "^0.10.0"
  }
}
```

Note: Satori uses `yoga-layout-wasm` internally — it should work on Railway's Node.js environment. Use `satori` directly (not via Next.js).

### railway.json
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node src/index.js",
    "healthcheckPath": "/health",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### .env.sample
```
# No required environment variables — all parameters passed via query string
# PORT is auto-set by Railway

# Optional: Custom font URL (Google Fonts CSS URL)
# FONT_URL=https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700

# Optional: Response timeout in ms (default: 8000)
# TIMEOUT_MS=8000
```

### .gitignore
```
node_modules/
.env
.railway/
```

## Implementation Details

### og.js (main generation logic)
1. Validate input params (title length, description length)
2. Build Satori JSX tree using the template component
3. Convert to SVG via `satori()` (max 8s timeout)
4. Convert SVG to PNG via sharp
5. Set response headers: `Content-Type: image/png`, `Cache-Control: public, max-age=3600`
6. Handle errors gracefully with fallback

### template.js (Satori component)
Create a JSX-like virtual DOM tree that Satori can render. Satori accepts React-style JSX elements. Use:
```js
const element = {
  type: 'div',
  props: {
    style: { ... },
    children: [ ... ]
  }
}
```

Design:
- 1200×630 viewport
- Dark gradient background
- Title: white 64px font, bold
- Description: gray 28px font
- Optional image on right side (rounded, 200×200)
- Subtle footer text "railway-og-image" bottom-right

### fallback.js
If Satori fails or times out, generate a simple SVG directly (no Satori needed):
```js
export function generateFallbackSVG(title, description) {
  return `<svg ...>...</svg>`;
}
```
Then convert via sharp and return.

### fonts.js
Fetch and cache font buffers. Try bundled fonts first, then fetch from Google Fonts URL.

### config.js
Read env vars with defaults:
- `PORT` = process.env.PORT || 3000
- `TIMEOUT_MS` = parseInt(process.env.TIMEOUT_MS || '8000')
- `FONT_URL` = process.env.FONT_URL || ''

## README.md
Use same format as `railway-form-template`:
- Frontmatter: title, description, tags (nodejs, express, satori, sharp, og-image)
- Deploy button
- Architecture diagram (simple ASCII)
- Quick start
- API documentation
- Environment variables table
- Deployment guide

## Verification
After implementation, run:
1. `npm install` — should install cleanly
2. `node src/index.js` — should start server
3. `curl http://localhost:$PORT/health` — should return 200
4. `curl http://localhost:$PORT/og-image?title=Hello&description=World -o test.png` — should generate valid PNG
5. `npm run build` — no build step needed (JS only), just ensure no syntax errors

## Notes
- Node.js 20+ required (Railway supports it via Nixpacks)
- No TypeScript — keep it simple JS
- No Dockerfile — Nixpacks auto-detects Node.js
- No database needed — stateless
- Memory target: < 300MB under load
