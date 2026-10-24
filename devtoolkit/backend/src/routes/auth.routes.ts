import { Router, Request, Response } from 'express';
import crypto from 'crypto';

const router = Router();

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// POST /api/auth/login
router.post('/login', (req: Request, res: Response) => {
  const { password } = req.body;
  const configuredToken = process.env.AUTH_TOKEN || 'devtoolkit-secret-change-me';

  if (!configuredToken || (typeof password === 'string' && safeEqual(password, configuredToken))) {
    return res.json({
      success: true,
      token: configuredToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    });
  }

  res.status(401).json({ success: false, message: 'Invalid password' });
});

// GET /api/auth/me
router.get('/me', (req: Request, res: Response) => {
  res.json({
    authenticated: true,
    user: { name: 'Admin', role: 'admin' }
  });
});

// GET /api/auth/health
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

export default router;
