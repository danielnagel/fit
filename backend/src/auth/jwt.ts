import type { CookieOptions } from 'express';
import jwt from 'jsonwebtoken';

export const AUTH_COOKIE = 'token';

// Grosszuegig, weil man sich beim Training nicht staendig neu einloggen will.
const SESSION_DAYS = 30;

export interface AuthUser {
  id: number;
  username: string;
}

function secret(): string {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error('JWT_SECRET ist nicht gesetzt');
  return value;
}

export function signToken(user: AuthUser): string {
  return jwt.sign({ sub: String(user.id), username: user.username }, secret(), { expiresIn: `${SESSION_DAYS}d` });
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

export const SESSION_MAX_AGE_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;
