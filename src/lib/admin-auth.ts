import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const ADMIN_SESSION_COOKIE = 'kota_admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function getSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!secret) {
    throw new Error('Admin authentication is not configured. Set ADMIN_PASSWORD and preferably ADMIN_SESSION_SECRET.');
  }
  return secret;
}

function signature(payload: string) {
  return createHmac('sha256', getSessionSecret()).update(payload).digest('hex');
}

export function createAdminSessionToken() {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = String(expiresAt);
  return {
    value: `${payload}.${signature(payload)}`,
    maxAge: SESSION_TTL_SECONDS,
  };
}

function verifyAdminSessionToken(token: string | undefined) {
  if (!token) return false;
  const [expiresRaw, suppliedSignature] = token.split('.');
  if (!expiresRaw || !suppliedSignature) return false;

  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return false;

  const expectedSignature = signature(expiresRaw);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length) return false;

  return timingSafeEqual(supplied, expected);
}

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  return verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
}

export async function requireAdmin() {
  if (!(await isAdminAuthenticated())) {
    redirect('/admin-login');
  }
}
