import { NextResponse } from 'next/server';
import { createAccount, findByUsername, publicAccount } from '@/lib/accounts';
import { setSession } from '@/lib/session';
import { isSiteBlocked } from '@/lib/siteLock';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (await isSiteBlocked()) {
    return NextResponse.json({ error: 'Site verrouillé. Réessaie plus tard.' }, { status: 503 });
  }
  const { username, password, minecraftPseudo } = await req.json().catch(() => ({}));

  if (!username || username.length < 3 || username.length > 20) {
    return NextResponse.json({ error: 'Pseudo invalide (3 à 20 caractères).' }, { status: 400 });
  }
  if (!password || password.length < 6) {
    return NextResponse.json({ error: 'Mot de passe trop court (6 caractères min).' }, { status: 400 });
  }
  if (!minecraftPseudo || !/^[a-zA-Z0-9_]{3,16}$/.test(minecraftPseudo)) {
    return NextResponse.json(
      { error: 'Pseudo Minecraft invalide (3 à 16 caractères, lettres/chiffres/_).' },
      { status: 400 },
    );
  }

  const existing = await findByUsername(username);
  if (existing) {
    return NextResponse.json({ error: 'Ce pseudo est déjà pris.' }, { status: 409 });
  }

  const account = await createAccount({ username, password, minecraftPseudo });
  setSession(account.id);
  return NextResponse.json(publicAccount(account));
}
