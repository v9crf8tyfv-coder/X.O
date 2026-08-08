import { NextResponse } from 'next/server';
import { findById, publicAccount } from '@/lib/accounts';
import { getSessionAccountId } from '@/lib/session';

export const runtime = 'nodejs';

export async function GET() {
  const id = getSessionAccountId();
  if (!id) return NextResponse.json({ error: 'Non connecté.' }, { status: 401 });

  const account = await findById(id);
  if (!account) return NextResponse.json({ error: 'Compte introuvable.' }, { status: 401 });

  return NextResponse.json(publicAccount(account));
}
