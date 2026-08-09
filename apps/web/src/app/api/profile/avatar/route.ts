import { NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/auth';
import { isSiteBlocked } from '@/lib/siteLock';
import { db } from '@xo/db';

export const runtime = 'nodejs';

/** Enregistre la photo de profil (data URL redimensionnée côté client) */
export async function POST(req: Request) {
  if (await isSiteBlocked()) {
    return NextResponse.json({ error: 'Site verrouillé.' }, { status: 503 });
  }
  const account = await getCurrentAccount();
  if (!account) return NextResponse.json({ error: 'Non connecté.' }, { status: 401 });

  const { dataUrl } = await req.json().catch(() => ({}));
  if (
    typeof dataUrl !== 'string' ||
    !dataUrl.startsWith('data:image/') ||
    dataUrl.length > 300_000 // ~200 Ko
  ) {
    return NextResponse.json(
      { error: 'Image invalide ou trop lourde (max ~200 Ko).' },
      { status: 400 },
    );
  }

  await db()`update accounts set avatar_url = ${dataUrl} where id = ${account.id}`;
  return NextResponse.json({ ok: true });
}
