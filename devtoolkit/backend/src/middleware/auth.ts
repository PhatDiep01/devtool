import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Token-based authentication middleware.
 * Checks the Authorization header for a Bearer token matching AUTH_TOKEN.
 * If AUTH_TOKEN is empty or unset (dev mode), all requests are allowed.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authToken = process.env.AUTH_TOKEN;

  // Dev mode: no token configured, allow all
  if (!authToken) {
    next();
    return;
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = header.slice(7);
  if (!safeEqual(token, authToken)) {
    res.status(401).json({ error: 'Invalid authentication token' });
    return;
  }

  next();
}
