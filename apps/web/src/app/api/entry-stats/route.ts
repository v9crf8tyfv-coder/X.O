import { NextResponse } from 'next/server';
import { db, hasDatabase } from '@xo/db';
import { ENTRY_SOURCES } from '@xo/shared';
import { requireLevel, RESP_LEVEL } from '@/lib/guard';

export const runtime = 'nodejs';

/**
 * Statistiques d'entrée : combien de membres ont choisi chaque source (« Comment as-tu connu
 * EmeriaMC ? »). Réservé aux Responsables et Fondateurs.
 */
export async function GET() {
  const g = await requireLevel(RESP_LEVEL);
  if (g instanceof NextResponse) return g;
  if (!hasDatabase()) return NextResponse.json({ total: 0, stats: [] });

  await db()`create table if not exists entry_sources (
    user_id text primary key, source text not null, created_at timestamptz not null default now()
  )`.catch(() => {});

  const rows = await db()<{ source: string; n: string }[]>`
    select source, count(*)::text as n from entry_sources group by source
  `.catch(() => [] as never[]);

  const counts = new Map(rows.map((r) => [r.source, Number(r.n)]));
  const stats = ENTRY_SOURCES.map((s) => ({ value: s.value, label: s.label, count: counts.get(s.value) ?? 0 }));
  // Sources éventuelles absentes de la liste (au cas où).
  for (const r of rows) {
    if (!ENTRY_SOURCES.some((s) => s.value === r.source)) {
      stats.push({ value: r.source, label: r.source, count: Number(r.n) });
    }
  }
  const total = stats.reduce((a, b) => a + b.count, 0);
  stats.sort((a, b) => b.count - a.count);
  return NextResponse.json({ total, stats });
}
