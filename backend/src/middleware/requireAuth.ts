import type { NextFunction, Request, Response } from 'express';
import { pool } from '../db.js';
import { AUTH_COOKIE, verifyToken, type AuthUser } from '../auth/jwt.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token: unknown = req.cookies?.[AUTH_COOKIE];
  if (typeof token !== 'string') {
    res.status(401).json({ error: 'not_authenticated' });
    return;
  }

  const user = verifyToken(token);
  if (!user) {
    res.status(401).json({ error: 'session_expired' });
    return;
  }

  // A JWT stays valid until it expires. Without this check a deleted user (or one without login,
  // e.g. the default user, or an expired demo user the cleanup job hasn't caught yet) could keep
  // working with an old cookie.
  const { rows } = await pool.query<{ username: string }>(
    `SELECT username FROM users
     WHERE id = $1 AND password_hash IS NOT NULL AND (demo_expires_at IS NULL OR demo_expires_at > now())`,
    [user.id],
  );
  if (rows.length === 0) {
    res.status(401).json({ error: 'session_expired' });
    return;
  }

  req.user = { id: user.id, username: rows[0].username };
  next();
}

// For routes behind requireAuth: returns the logged-in user without non-null assertions.
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw new Error('currentUser() called without requireAuth');
  return req.user;
}
