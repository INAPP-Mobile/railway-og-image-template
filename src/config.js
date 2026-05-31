const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  timeoutMs: parseInt(process.env.TIMEOUT_MS || '8000', 10),
  fontUrl: process.env.FONT_URL || '',
  logLevel: process.env.LOG_LEVEL || 'info',
  get isDebug() { return this.logLevel === 'debug'; },
};

export default config;
