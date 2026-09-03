import { NextResponse } from 'next/server';
import { getGrade } from '@xo/shared';
import { requireLevel, ADMIN_LEVEL, RESP_LEVEL, canAssignGrade } from '@/lib/guard';
import {
  listStaff,
  createStaff,
  syncSiteAccess,
  queueAction,
  isProtected,
  findActiveStaff,
  setStaffGrades,
} from '@/lib/staff';
import { ensureFormationFor } from '@/lib/formations';

export const runtime = 'nodejs';

/** Liste des staffs — accessible admin+ (lecture + ajout de warns/blames) */
export async function GET() {
  const g = await requireLevel(ADMIN_LEVEL);
  if (g instanceof NextResponse) return g;
  return NextResponse.json(await listStaff());
}

/** Ajouter un staff — responsable+ uniquement (le "+" est bloqué pour les admins) */
export async function POST(req: Request) {
  const g = await requireLevel(RESP_LEVEL);
  if (g instanceof NextResponse) return g;

  const { minecraftPseudo, discordTag, siteUsername, grades } = await req
    .json()
    .catch(() => ({}));

  if (!minecraftPseudo || !discordTag) {
    return NextResponse.json(
      { error: 'Pseudo Minecraft et tag Discord sont requis.' },
      { status: 400 },
    );
  }
  if (!Array.isArray(grades) || grades.length === 0) {
    return NextResponse.json({ error: 'Choisis au moins un grade.' }, { status: 400 });
  }
  if (isProtected(minecraftPseudo) || isProtected(discordTag) || isProtected(siteUsername)) {
    return NextResponse.json(
      { error: 'Ce compte est protégé et ne peut pas être ajouté au staff.' },
      { status: 403 },
    );
  }

  const myLevel = getGrade(g.account.site_grade).level;
  if (!grades.every((x) => typeof x === 'string' && canAssignGrade(x, myLevel))) {
    return NextResponse.json(
      { error: 'Un des grades dépasse tes droits (ou est interdit ici).' },
      { status: 403 },
    );
  }

  // Déjà staff ? → on complète la fiche existante au lieu d'en créer une 2ᵉ
  const existing = await findActiveStaff(discordTag, minecraftPseudo);
  if (existing) {
    const merged = [...new Set([...existing.grades, ...grades])];
    await setStaffGrades(existing.id, merged);
    await ensureFormationFor(merged, existing.pseudo); // formation auto si Modérateur Test
    await syncSiteAccess(existing.site_username ?? (siteUsername || null), merged);
    await queueAction({
      type: 'staff.apply',
      discordTag: existing.discord_tag,
      minecraftPseudo: existing.pseudo,
      grades: merged,
      actor: g.account.username,
      actorGrade: g.account.site_grade,
      announce: false,
    });
    return NextResponse.json({ ...existing, grades: merged });
  }

  const staff = await createStaff({
    minecraftPseudo,
    discordTag,
    siteUsername: siteUsername || null,
    grades,
  });
  await ensureFormationFor(grades, minecraftPseudo); // formation auto si Modérateur Test

  // Sync accès site (par pseudo site) + file d'attente Discord/IG (bot)
  await syncSiteAccess(siteUsername || null, grades);
  await queueAction({
    type: 'staff.apply',
    discordTag,
    minecraftPseudo,
    grades,
    actor: g.account.username,
    actorGrade: g.account.site_grade,
    announce: true, // nouveau staff → félicitations
  });

  return NextResponse.json(staff);
}
