import { NextResponse } from 'next/server';
import { db } from '@xo/db';
import { requireLevel, FOUNDER_LEVEL } from '@/lib/guard';

export const runtime = 'nodejs';

/** Liste des Responsables support (accès au support du site officiel). Fonda/co-fonda. */
async function list(): Promise<string[]> {
  const rows = await db()<{ pseudo: string }[]>`select pseudo from support_staff order by pseudo`;
  return rows.map((r) => r.pseudo);
}

export async function GET() {
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;
  return NextResponse.json({ staff: await list() });
}

export async function POST(req: Request) {
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;
  const { pseudo } = await req.json().catch(() => ({}));
  const p = String(pseudo || '').trim();
  if (!/^[A-Za-z0-9_]{2,16}$/.test(p)) {
    return NextResponse.json({ error: 'Pseudo Minecraft invalide.' }, { status: 400 });
  }
  await db()`insert into support_staff (pseudo, added_by) values (${p}, ${g.account.username}) on conflict (pseudo) do nothing`;
  return NextResponse.json({ ok: true, staff: await list() });
}

export async function DELETE(req: Request) {
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;
  const pseudo = new URL(req.url).searchParams.get('pseudo');
  if (!pseudo) return NextResponse.json({ error: 'pseudo requis.' }, { status: 400 });
  await db()`delete from support_staff where lower(pseudo) = lower(${pseudo})`;
  return NextResponse.json({ ok: true, staff: await list() });
}
