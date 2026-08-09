import { NextResponse } from 'next/server';
import { getGrade } from '@xo/shared';
import { requireLevel, RESP_LEVEL, canAssignGrade } from '@/lib/guard';
import { setStaffGrades, getStaff, removeStaff, syncSiteAccess, queueAction } from '@/lib/staff';

export const runtime = 'nodejs';

/** Changer les grades d'un staff (rank/derank) — responsable+ */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await requireLevel(RESP_LEVEL);
  if (g instanceof NextResponse) return g;

  const { grades } = await req.json().catch(() => ({}));
  if (!Array.isArray(grades) || grades.length === 0) {
    return NextResponse.json({ error: 'Choisis au moins un grade.' }, { status: 400 });
  }
  const myLevel = getGrade(g.account.site_grade).level;
  if (!grades.every((x) => typeof x === 'string' && canAssignGrade(x, myLevel))) {
    return NextResponse.json({ error: 'Grade au-dessus de tes droits.' }, { status: 403 });
  }

  const staff = await getStaff(params.id);
  if (!staff) return NextResponse.json({ error: 'Staff introuvable.' }, { status: 404 });

  await setStaffGrades(params.id, grades);
  await syncSiteAccess(staff.site_username, grades);
  // Félicitations seulement si le grade le plus haut MONTE (promotion)
  const topLevel = (gs: string[]) => Math.max(0, ...gs.map((x) => getGrade(x).level));
  const isPromotion = topLevel(grades) > topLevel(staff.grades);
  await queueAction({
    type: 'staff.apply',
    discordTag: staff.discord_tag,
    minecraftPseudo: staff.pseudo,
    grades,
    actor: g.account.username,
    actorGrade: g.account.site_grade,
    announce: isPromotion,
  });
  return NextResponse.json({ ok: true });
}

/** Retirer du staff → repasse joueur partout — responsable+ */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await requireLevel(RESP_LEVEL);
  if (g instanceof NextResponse) return g;

  const removed = await removeStaff(params.id);
  if (!removed) return NextResponse.json({ error: 'Staff introuvable.' }, { status: 404 });

  await syncSiteAccess(removed.site_username, []); // accès site -> joueur
  await queueAction({
    type: 'staff.remove',
    discordTag: removed.discord_tag,
    minecraftPseudo: removed.pseudo,
    grades: [],
    actor: g.account.username,
    actorGrade: g.account.site_grade,
  });
  return NextResponse.json({ ok: true });
}
