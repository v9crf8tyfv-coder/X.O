import { NextResponse } from 'next/server';
import { db, hasDatabase } from '@xo/db';
import { getGrade } from '@xo/shared';
import { requireLevel, ADMIN_LEVEL, RESP_LEVEL } from '@/lib/guard';

export const runtime = 'nodejs';

async function ensureOrdersTable(): Promise<void> {
  await db()`
    create table if not exists ig_delete_orders (
      id bigserial primary key,
      pseudo text not null,
      mode text not null,          -- 'all' | 'one'
      ts bigint,                   -- pour 'one' : horodatage (ms) de la sanction à retirer
      processed boolean not null default false,
      created_at timestamptz not null default now()
    )
  `;
}

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
    select id::text as id, actor, action, target, details, created_at
    from ig_actions
    where target ilike ${pseudo}
      and action = any(${SANCTION_ACTIONS})
    order by created_at desc
    limit 200
  `.catch(() => [] as never[]);

  const canDelete = getGrade(g.account.site_grade).level >= RESP_LEVEL;
  return NextResponse.json({ pseudo, sanctions: rows, canDelete });
}

/**
 * Suppression de sanctions — Responsables et + (fonda inclus).
 * Body : { pseudo, id? }. Avec `id` → supprime cette sanction ; sans → toutes celles du pseudo.
 * Supprime dans `ig_actions` (vue panel) ET crée un ordre pour effacer l'historique IG (ModStore).
 */
export async function DELETE(req: Request) {
  const g = await requireLevel(RESP_LEVEL);
  if (g instanceof NextResponse) return g;
  if (!hasDatabase()) return NextResponse.json({ error: 'no database' }, { status: 500 });

  let body: { pseudo?: string; id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }
  const pseudo = (body.pseudo ?? '').trim();
  if (pseudo.length < 2) return NextResponse.json({ error: 'pseudo manquant' }, { status: 400 });

  await ensureOrdersTable();

  if (body.id) {
    // Une sanction précise : on récupère son horodatage (ms) pour cibler l'historique IG.
    const row = await db()<{ target: string; ts: string }[]>`
      select target, (extract(epoch from created_at) * 1000)::bigint::text as ts
      from ig_actions where id = ${Number(body.id)} limit 1
    `.catch(() => [] as never[]);
    if (!row.length) return NextResponse.json({ error: 'introuvable' }, { status: 404 });
    await db()`delete from ig_actions where id = ${Number(body.id)}`;
    await db()`
      insert into ig_delete_orders (pseudo, mode, ts)
      values (${row[0]!.target}, 'one', ${Number(row[0]!.ts)})
    `;
    return NextResponse.json({ ok: true, deleted: 1 });
  }

  // Toutes les sanctions du joueur.
  const SANCTIONS = ['Mute', 'Unmute', 'Tempban', 'Jail', 'Unjail', 'Freeze'];
  const del = await db()<{ id: string }[]>`
    delete from ig_actions where target ilike ${pseudo} and action = any(${SANCTIONS})
    returning id::text as id
  `.catch(() => [] as never[]);
  await db()`insert into ig_delete_orders (pseudo, mode) values (${pseudo}, 'all')`;
  return NextResponse.json({ ok: true, deleted: del.length });
}
