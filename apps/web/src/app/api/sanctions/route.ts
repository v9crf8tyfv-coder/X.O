import { NextResponse } from 'next/server';
import { db, hasDatabase } from '@xo/db';
import { requireLevel, ADMIN_LEVEL } from '@/lib/guard';

export const runtime = 'nodejs';

/**
 * Recherche des sanctions IG d'un joueur (à la demande — aucune donnée gardée en
 * mémoire, aucune écriture : une seule requête SQL par recherche).
 * Les sanctions sont celles envoyées par le mod EmeriaCore (table ig_actions).
 * Admin+.
 */
const SANCTION_ACTIONS = ['Mute', 'Unmute', 'Tempban', 'Jail', 'Unjail', 'Freeze'];

export async function GET(req: Request) {
  const g = await requireLevel(ADMIN_LEVEL);
  if (g instanceof NextResponse) return g;
  if (!hasDatabase()) return NextResponse.json({ error: 'no database' }, { status: 500 });

  const pseudo = (new URL(req.url).searchParams.get('pseudo') ?? '').trim();
  if (pseudo.length < 2) {
    return NextResponse.json({ pseudo, sanctions: [] });
  }

  // Recherche insensible à la casse sur le joueur visé (target).
  const rows = await db()<
    { id: string; actor: string; action: string; target: string; details: string | null; created_at: string }[]
  >`
    select id::text as id, actor, action, target, details,
           to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') as created_at
    from ig_actions
    where target ilike ${pseudo}
      and action = any(${SANCTION_ACTIONS})
    order by created_at desc
    limit 200
  `.catch(() => [] as never[]);

  return NextResponse.json({ pseudo, sanctions: rows });
}
