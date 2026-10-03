import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import routes from './routes/index.js';
import { notFound, errorHandler } from './middleware/error.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Render's blueprint injects bare hostnames (no scheme), so normalise them.
  const origins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
    .map((o) => (/^https?:\/\//.test(o) ? o : `https://${o}`))
    .map((o) => o.replace(/\/$/, ''));
  app.use(cors({ origin: origins, credentials: true }));

  if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

  // Brute-force protection on the login endpoint only.
  app.use(
    '/api/auth/login',
    rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
      message: { success: false, message: 'Too many login attempts, please try again in 15 minutes' } }),
  );
  app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }));

  app.use('/api', routes);

  // ---------------------------------------------------------------------
  // In production the API also serves the built React app, so the whole
  // product lives on one origin: no CORS, one domain, one TLS certificate.
  // The build is produced by `npm run build` in ../frontend during deploy.
  // ---------------------------------------------------------------------
  const dist = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../frontend/dist',
  );

  if (fs.existsSync(path.join(dist, 'index.html'))) {
    // Hashed asset filenames can be cached hard; index.html never is,
    // otherwise a deploy would not reach browsers that already have it.
    app.use(express.static(dist, { index: false, maxAge: '1y' }));

    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.set('Cache-Control', 'no-cache');
      res.sendFile(path.join(dist, 'index.html'));
    });
    console.log('[api] serving the web app from frontend/dist');
  } else {
    console.log('[api] no frontend build found — running API only');
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
