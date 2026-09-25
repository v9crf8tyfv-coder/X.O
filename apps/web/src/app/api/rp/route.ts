import { NextResponse } from 'next/server';
import { requireRp } from '@/lib/guard';
import { listRp, createRp, findActiveRp, setRpGrades, queueRpAction, cleanRpGrades } from '@/lib/rp';

export const runtime = 'nodejs';

/** Liste des membres RP — accès resp+ ou OPResp.RP */
export async function GET() {
  const g = await requireRp();
  if (g instanceof NextResponse) return g;
  return NextResponse.json(await listRp());
}

/** Ajoute un membre RP (ou fusionne les grades si déjà présent) */
export async function POST(req: Request) {
  const g = await requireRp();
  if (g instanceof NextResponse) return g;
  const { pseudo, discordTag, grades } = await req.json().catch(() => ({}));
  if (!pseudo || typeof pseudo !== 'string') {
    return NextResponse.json({ error: 'Pseudo requis.' }, { status: 400 });
  }
  const clean = cleanRpGrades(Array.isArray(grades) ? grades : []);
  if (clean.length === 0) return NextResponse.json({ error: 'Choisis au moins un grade RP.' }, { status: 400 });

  const existing = await findActiveRp(pseudo);
  if (existing) {
    const merged = cleanRpGrades([...existing.grades, ...clean]);
    await setRpGrades(existing.id, merged);
    await queueRpAction({ type: 'rp.apply', discordTag: existing.discord_tag ?? (discordTag || null), pseudo: existing.pseudo, grades: merged });
    return NextResponse.json({ ok: true, id: existing.id });
  }
  const m = await createRp({ pseudo, discordTag: discordTag || null, grades: clean });
  await queueRpAction({ type: 'rp.apply', discordTag: m.discord_tag, pseudo: m.pseudo, grades: m.grades });
  return NextResponse.json({ ok: true, id: m.id });
}
