import { NextResponse } from 'next/server';
import { gdriveExchangeCode } from '@/lib/gdrive';

export const runtime = 'nodejs';

function origin(req: Request): string {
  const host = req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`;
}

/**
 * Callback OAuth Google : Google renvoie ici avec ?code=... après le consentement.
 * On échange le code contre un refresh token (stocké en DB), puis on renvoie sur le panel.
 * L'URL exacte à déclarer dans Google Cloud = https://<domaine>/api/gdrive/callback
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const base = origin(req);
  if (u.searchParams.get('error')) return NextResponse.redirect(`${base}/panel?gdrive=refuse`);
  const code = u.searchParams.get('code');
  if (!code) return NextResponse.redirect(`${base}/panel?gdrive=annule`);
  try {
    await gdriveExchangeCode(code, `${base}/api/gdrive/callback`);
    return NextResponse.redirect(`${base}/panel?gdrive=ok`);
  } catch {
    return NextResponse.redirect(`${base}/panel?gdrive=erreur`);
  }
}
