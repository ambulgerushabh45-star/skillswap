import crypto from 'node:crypto';
import config from '../config/env.js';
import { COOKIE_NAME, verifySessionToken } from '../lib/auth.js';

/**
 * Redacts credentials from MongoDB URIs (both mongodb:// and mongodb+srv://)
 * Replaces username:password with [REDACTED].
 */
export function redactMongoUri(input) {
  if (typeof input !== 'string') {
    return input;
  }
  return input.replace(/(mongodb(?:\+srv)?:\/\/)[^@\s/]+@/gi, '$1[REDACTED]@');
}

/**
 * Formats uncaught exceptions or unhandled rejections as a single JSON error line
 * with credentials redacted.
 */
export function formatProcessErrorJson(error) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'error',
    message: redactMongoUri(message),
    ...(stack ? { stack: redactMongoUri(stack) } : {}),
  });
}

/**
 * Registers process crash handlers that log 1 JSON error line and exit non-zero.
 */
export function registerProcessErrorHandlers(proc = process) {
  proc.on('unhandledRejection', (reason) => {
    try {
      console.error(formatProcessErrorJson(reason));
    } catch {
      // Fallback
    }
    proc.exit(1);
  });

  proc.on('uncaughtException', (err) => {
    try {
      console.error(formatProcessErrorJson(err));
    } catch {
      // Fallback
    }
    proc.exit(1);
  });
}

/**
 * Formats a production request log entry as a clean JSON object.
 * Strictly avoids logging headers, cookies, bodies, query strings, IP addresses or emails.
 */
export function buildProductionLogEntry({ req, res, start, requestId }) {
  const durationMs = Date.now() - start;
  const pathWithoutQuery = (req.originalUrl || req.url || '').split('?')[0];

  let userId = req.user?.id || null;
  if (!userId && req.cookies?.[COOKIE_NAME]) {
    const decoded = verifySessionToken(req.cookies[COOKIE_NAME]);
    if (decoded?.sub) {
      userId = decoded.sub;
    }
  }

  const entry = {
    timestamp: new Date().toISOString(),
    requestId,
    method: req.method,
    path: pathWithoutQuery,
    status: res.statusCode,
    durationMs,
  };

  if (userId) {
    entry.userId = userId;
  }

  return entry;
}

export function requestLogger(req, res, next) {
  const requestId = crypto.randomUUID();
  res.setHeader('X-Request-Id', requestId);
  req.requestId = requestId;

  if (config.IS_TEST && !req.app?.locals?.forceLoggerInTest) {
    return next();
  }

  const start = Date.now();
  const isProd = config.IS_PRODUCTION || process.env.NODE_ENV === 'production';

  res.on('finish', () => {
    if (isProd) {
      const entry = buildProductionLogEntry({ req, res, start, requestId });
      console.log(JSON.stringify(entry));
    } else {
      const duration = Date.now() - start;
      const { method, originalUrl } = req;
      const { statusCode } = res;
      const ip = req.ip || req.socket?.remoteAddress || 'unknown';
      console.log(`[${new Date().toISOString()}] ${method} ${originalUrl} ${statusCode} ${duration}ms - ${ip}`);
    }
  });

  next();
}

export default requestLogger;
