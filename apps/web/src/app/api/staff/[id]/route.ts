import { NextResponse } from 'next/server';
import { getGrade } from '@xo/shared';
import { requireLevel, RESP_LEVEL, canAssignGrade } from '@/lib/guard';
import { setStaffGrades, getStaff, removeStaff, syncSiteAccess, queueAction, updateStaffInfo } from '@/lib/staff';
import { ensureFormationFor } from '@/lib/formations';
import { igSurveil } from '@/lib/igSurveil';

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
  await ensureFormationFor(grades, staff.pseudo); // formation auto si Modérateur Test
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
  await igSurveil(g.account.minecraft_pseudo ?? g.account.username,
    isPromotion ? 'Carte staff — promotion' : 'Carte staff — modification des grades',
    staff.pseudo, `Avant : ${staff.grades.join(', ') || '—'}\nAprès : ${grades.join(', ')}`);
  return NextResponse.json({ ok: true });
}

/** Modifier les INFOS d'une carte staff (pseudo IG, tag Discord, compte site) — responsable+ */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await requireLevel(RESP_LEVEL);
  if (g instanceof NextResponse) return g;

  const body = await req.json().catch(() => ({}));
  const pseudo = typeof body.pseudo === 'string' ? body.pseudo.trim() : '';
  const discordTag = typeof body.discordTag === 'string' ? body.discordTag.trim() : '';
  const siteUsernameRaw = typeof body.siteUsername === 'string' ? body.siteUsername.trim() : '';
  const siteUsername = siteUsernameRaw || null;
  if (!pseudo || !discordTag) {
    return NextResponse.json({ error: 'Pseudo IG et tag Discord sont requis.' }, { status: 400 });
  }

  const staff = await getStaff(params.id);
  if (!staff) return NextResponse.json({ error: 'Staff introuvable.' }, { status: 404 });

  await updateStaffInfo(params.id, { pseudo, discordTag, siteUsername });
  // Si le compte site a changé, on reporte les grades sur le nouveau compte.
  if ((siteUsername ?? '') !== (staff.site_username ?? '')) {
    await syncSiteAccess(siteUsername, staff.grades);
  }
  await igSurveil(
    g.account.minecraft_pseudo ?? g.account.username,
    'Carte staff — modification des infos',
    staff.pseudo,
    `IG : ${staff.pseudo} → ${pseudo}\nDiscord : ${staff.discord_tag} → ${discordTag}\n` +
      `Site : ${staff.site_username ?? '—'} → ${siteUsername ?? '—'}`,
  );
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
  await igSurveil(g.account.minecraft_pseudo ?? g.account.username,
    'Carte staff — retrait du staff', removed.pseudo, `Grades retirés : ${removed.grades.join(', ') || '—'}`);
  return NextResponse.json({ ok: true });
}
