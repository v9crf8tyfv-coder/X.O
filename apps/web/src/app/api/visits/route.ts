import { NextResponse } from 'next/server';
import { db } from '@xo/db';
import { requireLevel, FOUNDER_LEVEL } from '@/lib/guard';

export const runtime = 'nodejs';

/**
 * Trafic du site public (emeria-site) : vues et visiteurs uniques par semaine,
 * + pages les plus vues cette semaine. Alimenté par /api/hit côté site.
 * Réservé aux fondateurs / co-fondateurs.
 */
export async function GET() {
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;

  const sql = db();
  try {
    const weeks = await sql<{ week: string; views: number; visitors: number }[]>`
      select to_char(date_trunc('week', ts), 'YYYY-MM-DD') as week,
             count(*)::int as views,
             count(distinct visitor)::int as visitors
      from site_visits
      where ts >= date_trunc('week', now()) - interval '7 weeks'
      group by 1
      order by 1`;

    const pages = await sql<{ path: string; views: number }[]>`
      select coalesce(nullif(path, ''), '/') as path, count(*)::int as views
      from site_visits
      where ts >= date_trunc('week', now())
      group by 1
      order by views desc
      limit 8`;

    const totals = await sql<{ views: number; visitors: number }[]>`
      select count(*)::int as views, count(distinct visitor)::int as visitors
      from site_visits
      where ts >= date_trunc('week', now())`;

    return NextResponse.json({ weeks, pages, thisWeek: totals[0] ?? { views: 0, visitors: 0 } });
  } catch {
    return NextResponse.json({ weeks: [], pages: [], thisWeek: { views: 0, visitors: 0 } });
  }
}
