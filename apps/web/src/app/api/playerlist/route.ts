import { NextResponse } from 'next/server';
import { db } from '@xo/db';
import { ALL_GRADES } from '@xo/shared';
import { requireLevel, RESP_LEVEL } from '@/lib/guard';

export const runtime = 'nodejs';

async function ensureTable() {
  await db()`
    create table if not exists playerlist_entries (
      id serial primary key,
      pseudo text not null,
      grade text not null
    )
  `;
}

/** Liste des entrées playerlist (esthétique). Resp+ */
export async function GET() {
  const g = await requireLevel(RESP_LEVEL);
  if (g instanceof NextResponse) return g;
  await ensureTable();
  const rows = await db()`select id, pseudo, grade from playerlist_entries order by id desc`;
  return NextResponse.json(rows);
}

/** Ajouter un pseudo + grade. Resp+ */
export async function POST(req: Request) {
  const g = await requireLevel(RESP_LEVEL);
  if (g instanceof NextResponse) return g;
  const { pseudo, grade } = await req.json().catch(() => ({}));
  if (!pseudo || !grade || !ALL_GRADES[grade]) {
    return NextResponse.json({ error: 'Pseudo + grade valide requis.' }, { status: 400 });
  }
  await ensureTable();
  await db()`insert into playerlist_entries (pseudo, grade) values (${String(pseudo)}, ${String(grade)})`;
  return NextResponse.json({ ok: true });
}

/** Retirer une entrée. Resp+ */
export async function DELETE(req: Request) {
  const g = await requireLevel(RESP_LEVEL);
  if (g instanceof NextResponse) return g;
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id requis.' }, { status: 400 });
  await db()`delete from playerlist_entries where id = ${Number(id)}`;
  return NextResponse.json({ ok: true });
}
