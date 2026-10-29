import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

import { getDb, closeDb } from './db/sqlite';
import { authMiddleware } from './middleware/auth';
import { getDataDir } from './services/file-manager';

import authRoutes from './routes/auth.routes';
import docsRoutes from './routes/docs.routes';
import filesRoutes from './routes/files.routes';
import bugsRoutes from './routes/bugs.routes';
import jiraRoutes from './routes/jira.routes';
import settingsRoutes from './routes/settings.routes';
import stickyNotesRoutes from './routes/sticky-notes.routes';
import apiDocsRoutes from './routes/api-docs.routes';

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database & run migrations
getDb();

// Middlewares
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'", "https:", "data:", "blob:"],
      connectSrc: ["'self'", "https:", "http:", "ws:", "wss:"],
      imgSrc: ["'self'", "https:", "http:", "data:", "blob:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https:"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      fontSrc: ["'self'", "https:", "data:"],
      frameSrc: ["'self'", "https:"],
      objectSrc: ["'none'"]
    }
  }
}));

const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
app.use(cors({
  origin: allowedOrigin === '*' ? '*' : allowedOrigin.split(',').map(o => o.trim()),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-jira-token'],
  exposedHeaders: ['X-App-Build-Id', 'X-App-Version']
}));

app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Locate frontend dist directory early so all routes and static servers can use it
const candidateDistPaths = [
  path.resolve(__dirname, '../../frontend/dist'),
  path.resolve(process.cwd(), '../frontend/dist'),
  path.resolve(process.cwd(), 'frontend/dist')
];

let frontendDist: string | null = null;
for (const p of candidateDistPaths) {
  if (fs.existsSync(p)) {
    frontendDist = p;
    break;
  }
}

// Attach release build id & version headers to all API responses
app.use((req, res, next) => {
  try {
    const versionPath = frontendDist ? path.join(frontendDist, 'version.json') : null;
    if (versionPath && fs.existsSync(versionPath)) {
      const vData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
      if (vData.buildId) res.setHeader('X-App-Build-Id', vData.buildId);
      if (vData.version) res.setHeader('X-App-Version', vData.version);
    }
  } catch {}
  next();
});

// Static images serving with security headers
app.use('/api/files/images', (req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
}, (req, res, next) => {
  const imagesDir = path.join(getDataDir(), 'images');
  express.static(imagesDir)(req, res, next);
});

// Public routes (Handover docs must be accessible to anyone without Jira login)
app.use('/api/auth', authRoutes);
app.use('/api/docs', docsRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/bugs', bugsRoutes);
app.use('/api/api-docs', apiDocsRoutes);
app.use('/api/sticky-notes', stickyNotesRoutes);

// Jira routes (authentication strictly enforced by jiraAuthMiddleware inside router)
app.use('/api/jira', jiraRoutes);

// Settings routes
app.use('/api/settings', settingsRoutes);

if (frontendDist) {
  // Never cache index.html or version.json so browsers always receive the latest release
  app.use((req, res, next) => {
    if (req.path === '/' || req.path === '/index.html' || req.path === '/version.json') {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    next();
  });

  app.use(express.static(frontendDist, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html') || filePath.endsWith('version.json')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      } else if (filePath.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    }
  }));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(frontendDist!, 'index.html'));
  });
}

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start Server (only if not running under test mode)
let server: any = null;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    console.log(`🚀 DevToolkit Backend running on http://localhost:${PORT}`);
    console.log(`📁 Persistent Data directory: ${getDataDir()}`);
  });

  // Hot-Restart Watcher: When dist/index.js is rebuilt on disk, smoothly exit so NSSM instantly relaunches the new build
  const startupTime = Date.now();
  const entryFile = path.resolve(__dirname, 'index.js');
  fs.watchFile(entryFile, { interval: 2000 }, (curr, prev) => {
    if (curr.mtimeMs > prev.mtimeMs && curr.mtimeMs > startupTime) {
      console.log('🔄 New backend build detected in dist/index.js. Restarting service cleanly via NSSM...');
      setTimeout(() => {
        if (server) {
          server.close(() => {
            closeDb();
            process.exit(0);
          });
        } else {
          closeDb();
          process.exit(0);
        }
      }, 500);
    }
  });
}

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received. Closing HTTP server and SQLite database.');
  if (server) {
    server.close(() => {
      closeDb();
      console.log('HTTP server closed.');
      process.exit(0);
    });
  } else {
    closeDb();
    process.exit(0);
  }
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received. Closing HTTP server and SQLite database.');
  if (server) {
    server.close(() => {
      closeDb();
      console.log('HTTP server closed.');
      process.exit(0);
    });
  } else {
    closeDb();
    process.exit(0);
  }
});

export default app;
