import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE = 'xo_session';
const SECRET = process.env.SESSION_SECRET ?? 'dev-secret-change-me';

/** Signe une valeur (id de compte) -> "valeur.signature" */
function sign(value: string): string {
  const sig = createHmac('sha256', SECRET).update(value).digest('base64url');
  return `${value}.${sig}`;
}

/** Vérifie et extrait la valeur d'un cookie signé */
function unsign(token: string): string | null {
  const idx = token.lastIndexOf('.');
  if (idx < 0) return null;
  const value = token.slice(0, idx);
  const expected = sign(value);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? value : null;
}

/** Pose le cookie de session (id du compte) */
export function setSession(accountId: string) {
  cookies().set(COOKIE, sign(accountId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 jours
  });
}

/** Retourne l'id du compte connecté, ou null */
export function getSessionAccountId(): string | null {
  const token = cookies().get(COOKIE)?.value;
  return token ? unsign(token) : null;
}

/** Déconnecte */
export function clearSession() {
  cookies().delete(COOKIE);
}
