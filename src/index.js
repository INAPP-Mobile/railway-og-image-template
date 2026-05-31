/**
 * OG Image Generation API — Railway Template
 * Express.js app that generates OG images using Satori + sharp.
 */

import express from 'express';
import { generateOGImage } from './og.js';
import config from './config.js';

const app = express();

// Trust Railway proxy headers
app.set('trust proxy', 1);

// ─── Health Check ──────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy' });
});

// ─── Root ──────────────────────────────────────────────────────────────

app.get('/', (_req, res) => {
  res.json({
    app: 'OG Image Generator',
    version: '1.0.0',
    endpoints: {
      '/og-image': 'GET ?title=&description=&image= → PNG',
      '/health': 'GET → { status }',
    },
  });
});

// ─── OG Image Generation ───────────────────────────────────────────────

app.get('/og-image', async (req, res) => {
  try {
    const pngBuffer = await generateOGImage(req.query);

    res.set({
      'Content-Type': 'image/png',
      'Content-Length': pngBuffer.length,
      'Cache-Control': 'public, max-age=3600',
    });
    res.end(pngBuffer);
  } catch (err) {
    console.error('OG image generation error:', err.message);
    res.status(500).json({ error: 'Failed to generate image' });
  }
});

// ─── 404 ───────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ─── Start Server ──────────────────────────────────────────────────────

app.listen(config.port, () => {
  console.log(`OG Image Generator running on port ${config.port}`);
  console.log(`  Health:  http://localhost:${config.port}/health`);
  console.log(`  OG Image: http://localhost:${config.port}/og-image?title=Hello&description=World`);
});

export default app;
