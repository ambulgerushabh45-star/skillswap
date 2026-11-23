import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import config from './config/env.js';
import requestLogger from './middleware/logger.js';
import csrfOriginCheck from './middleware/csrf.js';
import notFoundHandler from './middleware/not-found.js';
import errorHandler from './middleware/error-handler.js';

import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import profileRouter from './routes/profile.js';
import usersRouter from './routes/users.js';
import skillsRouter from './routes/skills.js';
import matchesRouter from './routes/matches.js';
import conversationsRouter from './routes/conversations.js';
import messagesRouter from './routes/messages.js';
import reviewsRouter from './routes/reviews.js';
import eventsRouter from './routes/events.js';
import geocodeRouter from './routes/geocode.js';
import avatarRouter from './routes/avatar.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultClientDistDir = path.resolve(__dirname, '..', '..', 'client', 'dist');

function rejectPathTraversal(req, res, next) {
  const rawPath = (req.originalUrl || req.url || '').split('?')[0];
  let decodedPath = rawPath;
  try {
    decodedPath = decodeURIComponent(rawPath);
  } catch {
    return res.status(400).json({ error: 'Invalid path' });
  }

  if (
    rawPath.includes('..') ||
    decodedPath.includes('..') ||
    rawPath.toLowerCase().includes('%2e%2e') ||
    decodedPath.includes('\\') ||
    req.path.includes('..')
  ) {
    return res.status(400).json({ error: 'Invalid path' });
  }

  return next();
}

export function createApp(options = {}) {
  const {
    isProduction = config.IS_PRODUCTION,
    clientDistDir = defaultClientDistDir,
  } = options;

  const app = express();

  // Reverse proxy IP trust configuration
  if (config.TRUST_PROXY) {
    app.set('trust proxy', true);
  }

  // 0. Reject any path traversal segments early
  app.use(rejectPathTraversal);

  // Disable x-powered-by header
  app.disable('x-powered-by');

  // Set modern Permissions-Policy header (deny camera, microphone, geolocation)
  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  // 1. Helmet security headers (strict CSP enabled in production when serving the SPA)
  app.use(
    helmet({
      contentSecurityPolicy: isProduction
        ? {
            useDefaults: false,
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
              connectSrc: ["'self'"],
              frameAncestors: ["'none'"],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
            },
          }
        : false,
      crossOriginResourcePolicy: {
        policy: isProduction ? 'same-origin' : 'cross-origin',
      },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: false } : false,
    })
  );

  // 2. JSON body parser with 100kb limit
  app.use(express.json({ limit: '100kb' }));

  // 3. Cookie parser
  app.use(cookieParser());

  // 4. Request logging
  app.use(requestLogger);

  // 5. CSRF origin check
  app.use(csrfOriginCheck);

  // 6. API Routes
  app.use('/api', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/user', profileRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/skills', skillsRouter);
  app.use('/api/matches', matchesRouter);
  app.use('/api/conversations', conversationsRouter);
  app.use('/api/messages', messagesRouter);
  app.use('/api/reviews', reviewsRouter);
  app.use('/api/events', eventsRouter);
  app.use('/api/geocode', geocodeRouter);
  app.use('/api', avatarRouter);

  // 7. Unknown /api paths strictly return JSON 404 (never fall through to SPA shell)
  app.use('/api', notFoundHandler);

  // 8. Production static serving & SPA fallback for built React client (client/dist)
  if (isProduction) {
    const assetsDir = path.join(clientDistDir, 'assets');
    const indexPath = path.join(clientDistDir, 'index.html');

    app.use(
      '/assets',
      express.static(assetsDir, {
        maxAge: '1y',
        immutable: true,
      })
    );

    app.use(
      express.static(clientDistDir, {
        index: 'index.html',
        setHeaders(res, filePath) {
          if (path.basename(filePath) === 'index.html') {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      })
    );

    app.get('*', (req, res, next) => {
      if (req.path === '/api' || req.path.startsWith('/api/') || req.path.startsWith('/assets/')) {
        return next();
      }
      if (!req.accepts('html')) {
        return next();
      }
      if (!fs.existsSync(indexPath)) {
        return next();
      }
      res.setHeader('Cache-Control', 'no-cache');
      return res.sendFile(indexPath);
    });
  }

  // 9. Catch-all 404 handler
  app.use(notFoundHandler);

  // 10. Central Error Handler
  app.use(errorHandler);

  return app;
}

export default createApp;
