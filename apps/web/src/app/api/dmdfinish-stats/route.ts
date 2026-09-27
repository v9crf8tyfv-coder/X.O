import { NextResponse } from 'next/server';
import { db } from '@xo/db';
import { getGrade, isFounderTier, GRADES } from '@xo/shared';
import { requireLevel, ADMIN_LEVEL } from '@/lib/guard';

export const runtime = 'nodejs';

/** Niveau du grade le plus haut d'un staff. */
function topLevel(grades: string[]): number {
  return Math.max(0, ...grades.map((g) => getGrade(g).level));
}

/** Un viewer (grade) peut-il voir ce staff ? (même règle que le temps de jeu) */
function canSee(viewerGrade: string, staffGrades: string[]): boolean {
  if (isFounderTier(viewerGrade)) return true;
  const vlvl = getGrade(viewerGrade).level;
  const slvl = topLevel(staffGrades);
  if (vlvl >= GRADES.responsable.level) return slvl < GRADES.cofondateur.level;
  if (vlvl >= GRADES.admin.level) return slvl < GRADES.responsable.level;
  return false;
}

/** "YYYY-MM" du mois demandé (ou mois courant), validé. */
function monthKey(raw: string | null): string {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) return raw;
  return new Date().toISOString().slice(0, 7);
}

/**
 * Nombre de /dmdfinish par staff pour un mois donné (défaut : mois courant).
 * Le comptage vient de la table `dmdfinish_log` (remplie par le bot), reliée aux
 * staffs par leur `discord_id`. Admin+ (visibilité identique au temps de jeu).
 */
export async function GET(req: Request) {
  const g = await requireLevel(ADMIN_LEVEL);
  if (g instanceof NextResponse) return g;

  const url = new URL(req.url);
  const month = monthKey(url.searchParams.get('month'));
  const monthStart = `${month}-01`;

  // La table peut ne pas encore exister (aucun /dmdfinish utilisé) -> on la crée au besoin.
  await db()`
    create table if not exists dmdfinish_log (
      id bigserial primary key,
      discord_id text not null,
      pseudo text,
      channel_id text,
      used_at timestamptz not null default now()
    )
  `.catch(() => {});

  // Staffs actifs reliés à un compte Discord (le comptage se fait par discord_id).
  const staff = await db()<
    { id: string; pseudo: string; discord_id: string | null; grades: string[] }[]
  >`select id, pseudo, discord_id, grades from staff where active = true`;

  const visible = staff.filter((s) => canSee(g.account.site_grade, s.grades));
  const ids = visible.map((s) => s.discord_id).filter((d): d is string => !!d);

  // Compte du mois : borne [1er du mois, 1er du mois suivant[.
  const counts = ids.length
    ? await db()<{ discord_id: string; n: number }[]>`
        select discord_id, count(*)::int as n
        from dmdfinish_log
        where discord_id = any(${ids})
          and used_at >= ${monthStart}::date
          and used_at < (${monthStart}::date + interval '1 month')
        group by discord_id
      `.catch(() => [] as { discord_id: string; n: number }[])
    : [];
  const byId = new Map(counts.map((c) => [c.discord_id, c.n]));

  const rows = visible
    .map((s) => ({
      id: s.id,
      pseudo: s.pseudo,
      grades: s.grades,
      count: s.discord_id ? byId.get(s.discord_id) ?? 0 : 0,
    }))
    .sort((a, b) => b.count - a.count || topLevel(b.grades) - topLevel(a.grades));

  return NextResponse.json({ month, staff: rows });
}
