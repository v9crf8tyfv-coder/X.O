import { NextResponse } from 'next/server';
import { db } from '@xo/db';
import { requireLevel, FOUNDER_LEVEL } from '@/lib/guard';

export const runtime = 'nodejs';

// Migration une seule fois par instance (le mod POST toutes les 10s -> jamais d'ALTER à chaud).
let migrated = false;
async function ensure(): Promise<void> {
  if (migrated) return;
  migrated = true;
  await db()`create table if not exists command_blocks (
    id text primary key,
    world text not null,
    x int not null, y int not null, z int not null,
    cmd text not null default '',
    type text not null default 'impulse',
    updated_at timestamptz not null default now()
  )`.catch(() => {});
  await db()`create table if not exists cmdblock_breaks (
    id text primary key,
    created_at timestamptz not null default now()
  )`.catch(() => {});
}

interface Blk { id: string; world: string; x: number; y: number; z: number; cmd: string; type: string }

// GET ?for=game (mod) : ids des command blocks à casser. GET (fonda) : liste complète.
export async function GET(req: Request) {
  await ensure();
  const url = new URL(req.url);
  if (url.searchParams.get('for') === 'game') {
    const rows = await db()<{ id: string }[]>`select id from cmdblock_breaks`;
    const res = NextResponse.json({ breaks: rows.map((r) => r.id) });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;
  const rows = await db()<(Blk & { breaking: boolean })[]>`
    select b.id, b.world, b.x, b.y, b.z, b.cmd, b.type,
           (k.id is not null) as breaking
    from command_blocks b
    left join cmdblock_breaks k on k.id = b.id
    order by b.world, b.x, b.y, b.z`;
  return NextResponse.json({ blocks: rows });
}

// POST : mod publie la liste ({blocks:[...]}) ou confirme des casses ({done:[ids]}),
//        ou un fonda demande une casse ({break:id}).
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  await ensure();

  // 1) Le mod publie l'état courant des command blocks chargés (pas d'auth : simple sync).
  if (Array.isArray(b.blocks)) {
    const blocks = (b.blocks as Blk[]).filter((x) => x && typeof x.id === 'string').slice(0, 500);
    for (const x of blocks) {
      await db()`
        insert into command_blocks (id, world, x, y, z, cmd, type, updated_at)
        values (${x.id}, ${String(x.world)}, ${x.x | 0}, ${x.y | 0}, ${x.z | 0},
                ${String(x.cmd ?? '')}, ${String(x.type ?? 'impulse')}, now())
        on conflict (id) do update set cmd = excluded.cmd, type = excluded.type,
                world = excluded.world, x = excluded.x, y = excluded.y, z = excluded.z,
                updated_at = now()
      `.catch(() => {});
    }
    // Purge les blocs plus vus depuis 30s (déchargés ou cassés) — on garde les récents.
    await db()`delete from command_blocks where updated_at < now() - interval '30 seconds'`.catch(() => {});
    return NextResponse.json({ ok: true, synced: blocks.length });
  }

  // 2) Le mod confirme des casses -> on les retire des deux tables.
  if (Array.isArray(b.done)) {
    const ids = (b.done as unknown[]).map(String).filter((s) => s.length > 0 && s.length < 200);
    for (const id of ids) {
      await db()`delete from cmdblock_breaks where id = ${id}`.catch(() => {});
      await db()`delete from command_blocks where id = ${id}`.catch(() => {});
    }
    return NextResponse.json({ ok: true, done: ids.length });
  }

  // 3) Un fonda demande la casse d'un command block.
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;
  const id = String(b.break || '').trim();
  if (!id) return NextResponse.json({ error: 'id manquant' }, { status: 400 });
  await db()`insert into cmdblock_breaks (id) values (${id}) on conflict (id) do nothing`;
  return NextResponse.json({ ok: true });
}
