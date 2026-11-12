const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  timeoutMs: parseInt(process.env.TIMEOUT_MS || '8000', 10),
  fontUrl: process.env.FONT_URL || '',
  logLevel: process.env.LOG_LEVEL || 'info',

  // --- AI background (hybrid render) ---------------------------------------
  // The media generation service is reached over internal HTTP. It owns the
  // upstream provider credentials; this service never holds them.
  // Inside Railway the service name resolves on the internal network; the
  // default matches the existing media service in the same project.
  mediaApiBaseUrl: (
    process.env.MEDIA_API_BASE_URL ||
    'http://x402-media-api.railway.internal:8080'
  ).replace(/\/+$/, ''),
  internalApiKey: process.env.INTERNAL_API_KEY || '',
  ingestToken: process.env.INGEST_TOKEN || '',
  mediaTimeoutMs: parseInt(process.env.MEDIA_TIMEOUT_MS || '60000', 10),

  // --- Cache ----------------------------------------------------------------
  // Social crawlers request the same card many times. Generation costs money
  // and takes seconds, so a cached card is served without touching the media
  // service at all.
  cacheTtlMs: parseInt(process.env.OG_CACHE_TTL || '86400', 10) * 1000,
  cacheMaxEntries: parseInt(process.env.OG_CACHE_MAX || '200', 10),

  get isDebug() { return this.logLevel === 'debug'; },
};

export default config;
