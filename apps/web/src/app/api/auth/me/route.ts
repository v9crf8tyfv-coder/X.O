import { NextResponse } from 'next/server';
import { findById, publicAccount } from '@/lib/accounts';
import { getSessionAccountId } from '@/lib/session';
import { isSiteBlocked } from '@/lib/siteLock';

export const runtime = 'nodejs';

export async function GET() {
  if (await isSiteBlocked()) {
    return NextResponse.json({ error: 'Site verrouillé.' }, { status: 503 });
  }
  const id = getSessionAccountId();
  if (!id) return NextResponse.json({ error: 'Non connecté.' }, { status: 401 });

  const account = await findById(id);
  if (!account) return NextResponse.json({ error: 'Compte introuvable.' }, { status: 401 });

  return NextResponse.json(publicAccount(account));
}
