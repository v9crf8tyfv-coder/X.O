import { NextResponse } from 'next/server';
import { findByUsername, publicAccount, verifyPassword } from '@/lib/accounts';
import { setSession } from '@/lib/session';
import { db } from '@xo/db';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { username, password } = await req.json().catch(() => ({}));
  if (!username || !password) {
    return NextResponse.json({ error: 'Pseudo et mot de passe requis.' }, { status: 400 });
  }

  const account = await findByUsername(username);
  if (!account || !(await verifyPassword(password, account.password_hash))) {
    return NextResponse.json({ error: 'Pseudo ou mot de passe incorrect.' }, { status: 401 });
  }

  setSession(account.id);
  await db()`update accounts set last_login_at = now() where id = ${account.id}`.catch(() => {});
  return NextResponse.json(publicAccount(account));
}
