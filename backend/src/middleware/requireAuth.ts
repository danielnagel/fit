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

  // Ein JWT bleibt bis zum Ablauf gueltig. Ohne diese Pruefung koennte ein geloeschter Benutzer
  // (oder einer ohne Login, z. B. der Default-User) mit einem alten Cookie weiterarbeiten.
  const { rows } = await pool.query<{ username: string }>(
    'SELECT username FROM users WHERE id = $1 AND password_hash IS NOT NULL',
    [user.id],
  );
  if (rows.length === 0) {
    res.status(401).json({ error: 'session_expired' });
    return;
  }

  req.user = { id: user.id, username: rows[0].username };
  next();
}

// Fuer Routen hinter requireAuth: liefert den eingeloggten Benutzer ohne Non-Null-Assertions.
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw new Error('currentUser() ohne requireAuth aufgerufen');
  return req.user;
}
