import { NextResponse } from 'next/server';
import { requireRp } from '@/lib/guard';
import { getRp, setRpGrades, removeRp, queueRpAction, cleanRpGrades } from '@/lib/rp';

export const runtime = 'nodejs';

/** Change les grades RP d'un membre */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await requireRp();
  if (g instanceof NextResponse) return g;
  const { grades } = await req.json().catch(() => ({}));
  const clean = cleanRpGrades(Array.isArray(grades) ? grades : []);
  const m = await getRp(params.id);
  if (!m) return NextResponse.json({ error: 'Membre RP introuvable.' }, { status: 404 });
  await setRpGrades(params.id, clean);
  await queueRpAction({ type: clean.length ? 'rp.apply' : 'rp.remove', discordTag: m.discord_tag, pseudo: m.pseudo, grades: clean });
  return NextResponse.json({ ok: true });
}

/** Retire un membre RP */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await requireRp();
  if (g instanceof NextResponse) return g;
  const m = await removeRp(params.id);
  if (m) await queueRpAction({ type: 'rp.remove', discordTag: m.discord_tag, pseudo: m.pseudo, grades: [] });
  return NextResponse.json({ ok: true });
}
