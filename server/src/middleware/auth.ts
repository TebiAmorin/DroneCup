import type { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    res.status(500).json({ error: { code: 'CONFIG_ERROR', message: 'Admin authentication not configured' } });
    return;
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authorization required' } });
    return;
  }

  const token = header.slice(7);

  try {
    const tokenBuf = Buffer.from(token);
    const secretBuf = Buffer.from(secret);
    if (tokenBuf.length !== secretBuf.length || !timingSafeEqual(tokenBuf, secretBuf)) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } });
      return;
    }
  } catch {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } });
    return;
  }

  next();
}
