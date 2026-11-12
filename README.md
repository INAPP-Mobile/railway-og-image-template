---
title: OG Image Generator
description: Self-hosted OG Image Generation API using Node.js + Satori (JSX→SVG) + sharp (SVG→PNG), with an optional AI-generated background layer. No Puppeteer — stays under 512MB RAM for Railway free tier.
tags:
  - nodejs
  - express
  - satori
  - sharp
  - og-image
  - serverless
---

# OG Image Generator

> Generate beautiful Open Graph images on the fly. No Puppeteer, no headless browser — just pure SVG magic with Satori and sharp. Deploy on Railway free tier (512MB RAM) in one click.

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.com/new/template?templateUrl=https://github.com/INAPP-Mobile/railway-og-image-template)

```text
┌─────────────────────────────────────────────────────┐
│              Your OG Image API                       │
│                                                       │
│  ┌─── GET /og-image?title=...&description=... ────┐  │
│  │                                                  │  │
│  │  ┌──────────────────────────────────────────┐   │  │
│  │  │         Hello World!                      │   │  │
│  │  │   My awesome blog post description         │   │  │
│  │  │                                🌄         │   │  │
│  │  │                        railway-og-image   │   │  │
│  │  └──────────────────────────────────────────┘   │  │
│  │                                                  │  │
│  │  ↕ Satori (JSX→SVG) + sharp (SVG→PNG)           │  │
│  │                                                  │  │
│  │  Response: image/png                             │  │
│  └──────────────────────────────────────────────────┘  │
│                                                       │
│  GET /health  →  { "status": "healthy" }              │
└─────────────────────────────────────────────────────┘
```

## What It Does

- **Generate OG images** for social sharing (Twitter/X, Facebook, Discord, Slack)
- **Accept custom parameters** — title, description, and optional image URL
- **Return PNG** images at 1200×630px (standard OG image size)
- **Optionally use a generated background** — the hybrid route composes an AI-generated background with perfectly crisp Satori text
- **Fallback gracefully** if generation takes too long or errors occur — a crawler never gets a 500
- **Stay memory-efficient** — no Puppeteer, pure Node.js SVG rendering

## Quick Start

### Deploy on Railway

Click the button above to deploy. No configuration needed — just deploy and go.

### Use the API

```bash
# Basic OG image
curl "https://your-app.railway.app/og-image?title=Hello%20World&description=My%20first%20OG%20image" -o output.png

# With an image
curl "https://your-app.railway.app/og-image?title=Blog%20Post&description=Check%20out%20this%20amazing%20content&image=https://example.com/photo.jpg" -o output.png
```

### Embed in HTML

```html
<meta property="og:title" content="My Page" />
<meta property="og:description" content="Page description" />
<meta property="og:image" content="https://your-app.railway.app/og-image?title=My%20Page&description=Page%20description" />
<meta name="twitter:card" content="summary_large_image" />
```

## API Endpoints

### GET /og-image

Generate an OG image as PNG.

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `title` | No | `OG Image` | Main heading (max 60 chars) |
| `description` | No | `""` | Subtitle text (max 120 chars) |
| `image` | No | `""` | URL to embed as image on right side |

**Response:** `Content-Type: image/png` — binary PNG (1200×630px)

**Error:** `400` — JSON with `{ "error": "message" }`

### GET /og-image-ai

Generate an OG image with an **AI-generated background** and a Satori text
overlay. The background is requested from an internal media service; the
title and description are drawn by Satori so the text is always pixel-perfect
and correctly spelled.

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `title` | No | `OG Image` | Main heading (max 60 chars) |
| `description` | No | `""` | Subtitle text (max 120 chars) |
| `badge` | No | `""` | Eyebrow label above the title (max 28 chars) |
| `style` | No | `gradient3d` | Background style: `photo`, `gradient3d`, `illustration`, `minimal` |

**Response:** `Content-Type: image/png` — binary PNG (1200×630px)

**Response headers:**
- `X-Cache: HIT` — served from cache (no generation cost)
- `X-Cache: MISS` — freshly generated
- `X-Cache: FALLBACK` — the media service was unavailable, so the plain
  Satori render was used. Fallback renders are **not** cached, so the next
  request retries the generated background.

**If the media service is unreachable, slow, or not configured, this route
degrades to the plain `/og-image` render instead of returning an error.**

```bash
curl "https://your-app.railway.app/og-image-ai?title=Launch%20Day&description=We%20just%20shipped%20v2&style=photo" -o output.png
```

### GET /health

Health check endpoint.

```bash
curl https://your-app.railway.app/health
```

**Response:**
```json
{ "status": "healthy" }
```

### GET /

Get API info.

```bash
curl https://your-app.railway.app/
```

**Response:**
```json
{
  "app": "OG Image Generator",
  "version": "1.2.0",
  "endpoints": {
    "/og-image": "GET ?title=&description=&badge=&image= → PNG",
    "/og-image-ai": "GET ?title=&description=&badge=&style= → PNG (generated background)",
    "/health": "GET → { status }"
  },
  "styles": ["photo", "gradient3d", "illustration", "minimal"]
}
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | ❌ | `3000` | Server port (auto-set by Railway) |
| `FONT_URL` | ❌ | Google Fonts (Noto Sans SC) | Custom font CSS URL |
| `TIMEOUT_MS` | ❌ | `8000` | Max generation time in ms |
| `LOG_LEVEL` | ❌ | `info` | `debug`, `info`, `warn`, `error` |

### AI background (optional)

These only affect `/og-image-ai`. Without them, that route falls back to the
plain render and `/og-image` is unaffected.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MEDIA_API_BASE_URL` | ❌ | `http://x402-media-api.railway.internal:8080` | Base URL of the media generation service |
| `INTERNAL_API_KEY` | ❌ | `""` | Shared secret sent as `X-Internal-Auth` |
| `INGEST_TOKEN` | ❌ | `""` | Alternative credential sent as `X-Ingest-Token` |
| `MEDIA_TIMEOUT_MS` | ❌ | `60000` | Timeout for a generation request (ms) |
| `OG_CACHE_TTL` | ❌ | `86400` | Render cache TTL in seconds |
| `OG_CACHE_MAX` | ❌ | `200` | Max cached renders |

The media service owns the upstream generation credentials — this service
never holds a provider key.

## Architecture

```
┌─────────────┐     GET /og-image?title=...&desc=...&image=...
│   Browser   │─────────────────────────────────────────────┐
│  / Social   │                                              ▼
│   Crawler   │   ┌──────────────────────────────────────────┐
└─────────────┘   │         Express.js (this app)             │
                   │                                          │
                   │  ┌──────────┐   ┌──────────┐             │
                   │  │  Satori  │──▶│   sharp  │             │
                   │  │ JSX→SVG  │   │ SVG→PNG  │             │
                   │  └──────────┘   └──────────┘             │
                   │                                          │
                   │  If Satori fails/times out:               │
                   │  ┌──────────┐   ┌──────────┐             │
                   │  │ Fallback │──▶│   sharp  │             │
                   │  │ SVG Gen  │   │ SVG→PNG  │             │
                   │  └──────────┘   └──────────┘             │
                   └──────────────────────────────────────────┘
                                    │
                                    ▼
                           image/png response
```

### Hybrid render (`/og-image-ai`)

The text layer is never generated by the AI — it is always rendered by
Satori, so spelling and typography stay exact.

```
GET /og-image-ai?title=...&style=photo
   │
   ├─▶ [Prompt Builder] ──▶ media service ──▶ generated background
   │                              │
   │                              └──▶ 1200x630 background image
   │
   ├─▶ [Satori] ──▶ transparent overlay (title + description + badge)
   │
   └─▶ [sharp] ──▶ background + dark scrim + overlay ──▶ final PNG
```

If the media service fails, times out, or is not configured, the route falls
back to the plain Satori-only render — the response is still a valid PNG.

## Development

```bash
# Clone and install
git clone https://github.com/INAPP-Mobile/railway-og-image-template.git
cd railway-og-image-template
npm install

# Run locally
npm start

# Test it
curl "http://localhost:3000/og-image?title=Test&description=Hello%20World" -o test.png
open test.png
```

## How It Works

1. **Request** comes in with `title`, `description`, and optional `image` URL
2. **Satori** renders the JSX-like template into an SVG string (1200×630px)
3. **sharp** converts the SVG to a PNG buffer
4. **Response** is returned as `image/png` with caching headers

If Satori times out or errors, a **fallback SVG** is generated directly (no dependencies) and converted to PNG via sharp. This ensures the API always returns an image, even under load.

## Memory Profile

| Component | Memory |
|-----------|--------|
| Node.js runtime | ~30MB |
| Express + sharp | ~80MB |
| Satori (per request) | ~50MB (released after) |
| **Total (idle)** | **~120MB** |
| **Peak (under load)** | **~250MB** |

Well within Railway free tier (512MB limit).

## License

MIT
