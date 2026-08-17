import { NextResponse } from 'next/server';
import { db } from '@xo/db';
import { getGrade, isFounderTier, GRADES } from '@xo/shared';
import { requireLevel, ADMIN_LEVEL } from '@/lib/guard';

export const runtime = 'nodejs';

/** Niveau du grade le plus haut d'un staff. */
function topLevel(grades: string[]): number {
  return Math.max(0, ...grades.map((g) => getGrade(g).level));
}

/** Un viewer (grade) peut-il voir ce staff ? (admin: < resp ; resp: < cofonda ; fonda: tout) */
function canSee(viewerGrade: string, staffGrades: string[]): boolean {
  if (isFounderTier(viewerGrade)) return true;
  const vlvl = getGrade(viewerGrade).level;
  const slvl = topLevel(staffGrades);
  if (vlvl >= GRADES.responsable.level) return slvl < GRADES.cofondateur.level; // resp: pas fonda/cofonda
  if (vlvl >= GRADES.admin.level) return slvl < GRADES.responsable.level; // admin: pas resp+
  return false;
}

/** Lundi (YYYY-MM-DD) de la semaine contenant `d` (ou aujourd'hui). */
function mondayOf(d?: string): string {
  const base = d ? new Date(d + 'T12:00:00') : new Date();
  const day = (base.getDay() + 6) % 7; // 0 = lundi
  base.setDate(base.getDate() - day);
  return base.toISOString().slice(0, 10);
}
function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Temps de jeu des staffs visibles, pour une semaine. Admin+ */
export async function GET(req: Request) {
  const g = await requireLevel(ADMIN_LEVEL);
  if (g instanceof NextResponse) return g;

  const url = new URL(req.url);
  const monday = mondayOf(url.searchParams.get('week') ?? undefined);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const sunday = days[6]!;

  const staff = await db()<
    { id: string; pseudo: string; discord_id: string | null; grades: string[] }[]
  >`select id, pseudo, discord_id, grades from staff where active = true`;

  const visible = staff.filter((s) => canSee(g.account.site_grade, s.grades));
  const pseudos = visible.map((s) => s.pseudo);
  const discordIds = visible.map((s) => s.discord_id).filter(Boolean) as string[];

  // Minutes par (pseudo, jour)
  const pt = pseudos.length
    ? await db()<{ pseudo: string; day: string; minutes: number }[]>`
        select pseudo, to_char(day,'YYYY-MM-DD') as day, minutes from playtime
        where day between ${monday} and ${sunday} and pseudo = any(${pseudos})
      `
    : [];

  // Absences chevauchant la semaine
  const abs = discordIds.length
    ? await db()<{ discord_id: string; start_date: string; end_date: string }[]>`
        select discord_id, to_char(start_date,'YYYY-MM-DD') as start_date,
               to_char(end_date,'YYYY-MM-DD') as end_date
        from absences
        where discord_id = any(${discordIds})
          and coalesce(start_date,'0001-01-01') <= ${sunday}
          and coalesce(end_date,'9999-12-31') >= ${monday}
      `.catch(() => [])
    : [];

  const rows = visible
    .map((s) => {
      const perDay: Record<string, number> = {};
      for (const d of days) perDay[d] = 0;
      for (const r of pt) if (r.pseudo === s.pseudo) perDay[r.day] = r.minutes;
      const absentDays = days.filter((d) =>
        abs.some((a) => a.discord_id === s.discord_id && a.start_date <= d && a.end_date >= d),
      );
      const total = Object.values(perDay).reduce((a, b) => a + b, 0);
      return { id: s.id, pseudo: s.pseudo, grades: s.grades, perDay, absentDays, total };
    })
    .sort((a, b) => topLevel(b.grades) - topLevel(a.grades) || b.total - a.total);

  return NextResponse.json({ monday, days, staff: rows });
}
