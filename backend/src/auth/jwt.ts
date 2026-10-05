import type { CookieOptions } from 'express';
import jwt from 'jsonwebtoken';

export const AUTH_COOKIE = 'token';

// Generous, because you don't want to log in again and again while training.
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface AuthUser {
  id: number;
  username: string;
}

function secret(): string {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error('JWT_SECRET is not set');
  return value;
}

export function signToken(user: AuthUser, expiresInMs = SESSION_MAX_AGE_MS): string {
  return jwt.sign({ sub: String(user.id), username: user.username }, secret(), {
    expiresIn: Math.floor(expiresInMs / 1000),
  });
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, secret());
    if (typeof payload === 'string' || !payload.sub || typeof payload.username !== 'string') return null;
    return { id: Number(payload.sub), username: payload.username };
  } catch {
    return null;
  }
}

export function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
}
