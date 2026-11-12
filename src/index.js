/**
 * OG Image Generation API — Railway Template
 * Express.js app that generates OG images using Satori + sharp.
 *
 * Two render paths:
 *  - /og-image         plain Satori card (gradient background)
 *  - /og-image-ai      hybrid card: generated background + Satori text overlay
 *
 * The hybrid path calls the existing internal media service for the
 * background. If that service is unavailable the hybrid path degrades to
 * the plain render — a social crawler never receives a 500.
 */

import express from 'express';
import { generateOGImage, generateOGImageWithAI, preloadFonts } from './og.js';
import { STYLES } from './ai.js';
import * as cache from './cache.js';
import config from './config.js';

const app = express();

// Trust Railway proxy headers
app.set('trust proxy', 1);

// Warm the font cache so the first request does not pay for a font fetch.
preloadFonts();

// ─── Health Check ──────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    cache: cache.stats(),
  });
});

// ─── Root ──────────────────────────────────────────────────────────────

app.get('/', (_req, res) => {
  res.json({
    app: 'OG Image Generator',
    version: '1.2.0',
    endpoints: {
      '/og-image': 'GET ?title=&description=&badge=&image= → PNG',
      '/og-image-ai': 'GET ?title=&description=&badge=&style= → PNG (generated background)',
      '/health': 'GET → { status }',
    },
    styles: Object.keys(STYLES),
  });
});

// ─── OG Image Generation ───────────────────────────────────────────────

/**
 * Serve a PNG buffer with the standard image headers.
 * @param {import('express').Response} res
 * @param {Buffer} buffer
 */
function sendPNG(res, buffer) {
  res.set({
    'Content-Type': 'image/png',
    'Content-Length': buffer.length,
    'Cache-Control': 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(buffer);
}

// Serve the generator on both paths: /og-image is the documented route and
// /og is the short alias used by the api-mono gateway (handle_path /og*
// strips the prefix, so the upstream sees /og-image).
app.get(['/og-image', '/og', '/og/og-image', '/og/og'], async (req, res) => {
  try {
    const pngBuffer = await generateOGImage(req.query);
    sendPNG(res, pngBuffer);
  } catch (err) {
    console.error('OG image generation error:', err.message);
    res.status(500).json({ error: 'Failed to generate image' });
  }
});

/**
 * Hybrid render: generated background + Satori text overlay.
 *
 * Results are cached by a hash of every input that affects the output, so
 * repeated crawler hits cost nothing and never re-trigger a generation.
 */
app.get(
  ['/og-image-ai', '/og-ai', '/og/og-image-ai', '/og/og-ai'],
  async (req, res) => {
    try {
      const key = cache.cacheKey({
        title: req.query.title,
        description: req.query.description,
        badge: req.query.badge,
        style: req.query.style,
        imageUrl: req.query.image,
        variant: 'ai',
      });

      const cached = cache.get(key);
      if (cached) {
        res.set('X-Cache', 'HIT');
        sendPNG(res, cached);
        return;
      }

      const { buffer, fallback } = await generateOGImageWithAI(req.query);

      // A degraded (plain) render is NOT cached. Caching it would pin the
      // card to the fallback for the whole TTL even after the media service
      // recovers, so the next crawler hit would keep getting the plain card.
      if (!fallback) {
        cache.set(key, buffer);
      }

      res.set('X-Cache', fallback ? 'FALLBACK' : 'MISS');
      sendPNG(res, buffer);
    } catch (err) {
      console.error('AI OG image generation error:', err.message);
      res.status(500).json({ error: 'Failed to generate image' });
    }
  },
);

// ─── 404 ───────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ─── Start Server ──────────────────────────────────────────────────────

app.listen(config.port, () => {
  console.log(`OG Image Generator running on port ${config.port}`);
  console.log(`  Health:  http://localhost:${config.port}/health`);
  console.log(`  OG Image: http://localhost:${config.port}/og-image?title=Hello&description=World`);
  console.log(`  OG Image AI: http://localhost:${config.port}/og-image-ai?title=Hello&style=gradient3d`);
});

export default app;
