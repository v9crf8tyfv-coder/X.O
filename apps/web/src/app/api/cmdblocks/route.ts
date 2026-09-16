import { NextResponse } from 'next/server';
import { db } from '@xo/db';
import { requireLevel, FOUNDER_LEVEL } from '@/lib/guard';

export const runtime = 'nodejs';

let migrated = false;
async function ensure(): Promise<void> {
  if (migrated) return;
  migrated = true;
  await db()`create table if not exists command_blocks (
    id text primary key, world text not null,
    x int not null, y int not null, z int not null,
    cmd text not null default '', type text not null default 'impulse',
    updated_at timestamptz not null default now()
  )`.catch(() => {});
  await db()`alter table command_blocks add column if not exists facing text not null default 'up'`.catch(() => {});
  await db()`alter table command_blocks add column if not exists conditional boolean not null default false`.catch(() => {});
  await db()`alter table command_blocks add column if not exists auto boolean not null default false`.catch(() => {});
  await db()`create table if not exists command_blocks_backup (
    id text primary key, world text, x int, y int, z int, cmd text, type text,
    facing text default 'up', conditional boolean default false, auto boolean default false,
    saved_at timestamptz not null default now()
  )`.catch(() => {});
  await db()`create table if not exists cmdblock_restores (
    id text primary key, world text, x int, y int, z int, cmd text, type text,
    facing text default 'up', conditional boolean default false, auto boolean default false,
    created_at timestamptz not null default now()
  )`.catch(() => {});
  await db()`create table if not exists cmdblock_breaks (id text primary key, created_at timestamptz not null default now())`.catch(() => {});
}

interface Blk {
  id: string; world: string; x: number; y: number; z: number;
  cmd: string; type: string; facing?: string; conditional?: boolean; auto?: boolean;
}

// GET ?for=game (mod) : casses + restaurations à appliquer. GET (fonda) : liste + état backup.
export async function GET(req: Request) {
  await ensure();
  const url = new URL(req.url);
  if (url.searchParams.get('for') === 'game') {
    const breaks = await db()<{ id: string }[]>`select id from cmdblock_breaks`;
    const restores = await db()<Blk[]>`
      select id, world, x, y, z, cmd, type, facing, conditional, auto from cmdblock_restores`;
    const res = NextResponse.json({ breaks: breaks.map((r) => r.id), restores });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;
  const rows = await db()<(Blk & { breaking: boolean })[]>`
    select b.id, b.world, b.x, b.y, b.z, b.cmd, b.type, b.facing, b.conditional, b.auto,
           (k.id is not null) as breaking
    from command_blocks b left join cmdblock_breaks k on k.id = b.id
    order by b.world, b.x, b.y, b.z`;
  const bk = await db()<{ n: number; saved_at: string | null }[]>`
    select count(*)::int as n, max(saved_at) as saved_at from command_blocks_backup`;
  const restoring = await db()<{ n: number }[]>`select count(*)::int as n from cmdblock_restores`;
  return NextResponse.json({
    blocks: rows,
    backup: { count: bk[0]?.n ?? 0, savedAt: bk[0]?.saved_at ?? null },
    restoring: (restoring[0]?.n ?? 0) > 0,
  });
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  await ensure();

  // 1) Le mod publie l'état courant (upsert + purge des non-vus depuis 30s).
  if (Array.isArray(b.blocks)) {
    const blocks = (b.blocks as Blk[]).filter((x) => x && typeof x.id === 'string').slice(0, 500);
    for (const x of blocks) {
      await db()`
        insert into command_blocks (id, world, x, y, z, cmd, type, facing, conditional, auto, updated_at)
        values (${x.id}, ${String(x.world)}, ${x.x | 0}, ${x.y | 0}, ${x.z | 0},
                ${String(x.cmd ?? '')}, ${String(x.type ?? 'impulse')},
                ${String(x.facing ?? 'up')}, ${!!x.conditional}, ${!!x.auto}, now())
        on conflict (id) do update set cmd = excluded.cmd, type = excluded.type,
                world = excluded.world, x = excluded.x, y = excluded.y, z = excluded.z,
                facing = excluded.facing, conditional = excluded.conditional, auto = excluded.auto,
                updated_at = now()
      `.catch(() => {});
    }
    await db()`delete from command_blocks where updated_at < now() - interval '30 seconds'`.catch(() => {});
    return NextResponse.json({ ok: true, synced: blocks.length });
  }

  // 2) Le mod confirme des casses.
  if (Array.isArray(b.done)) {
    const ids = (b.done as unknown[]).map(String).filter((s) => s.length > 0 && s.length < 200);
    for (const id of ids) {
      await db()`delete from cmdblock_breaks where id = ${id}`.catch(() => {});
      await db()`delete from command_blocks where id = ${id}`.catch(() => {});
    }
    return NextResponse.json({ ok: true, done: ids.length });
  }

  // 3) Le mod confirme des restaurations -> on vide la file.
  if (Array.isArray(b.restoredone)) {
    const ids = (b.restoredone as unknown[]).map(String).filter((s) => s.length > 0 && s.length < 200);
    for (const id of ids) await db()`delete from cmdblock_restores where id = ${id}`.catch(() => {});
    return NextResponse.json({ ok: true, restored: ids.length });
  }

  // ---- Actions FONDA ----
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;

  // Casser un command block.
  if (b.break) {
    const id = String(b.break).trim();
    if (!id) return NextResponse.json({ error: 'id manquant' }, { status: 400 });
    await db()`insert into cmdblock_breaks (id) values (${id}) on conflict (id) do nothing`;
    return NextResponse.json({ ok: true });
  }

  // Sauvegarder : copie l'état courant dans la sauvegarde (remplace).
  if (b.save) {
    await db()`delete from command_blocks_backup`;
    await db()`
      insert into command_blocks_backup (id, world, x, y, z, cmd, type, facing, conditional, auto)
      select id, world, x, y, z, cmd, type, facing, conditional, auto from command_blocks`;
    const n = await db()<{ n: number }[]>`select count(*)::int as n from command_blocks_backup`;
    return NextResponse.json({ ok: true, saved: n[0]?.n ?? 0 });
  }

  // Restaurer : met tous les blocs de la sauvegarde dans la file (le mod les repose en jeu).
  if (b.restore) {
    await db()`
      insert into cmdblock_restores (id, world, x, y, z, cmd, type, facing, conditional, auto)
      select id, world, x, y, z, cmd, type, facing, conditional, auto from command_blocks_backup
      on conflict (id) do update set world=excluded.world, x=excluded.x, y=excluded.y, z=excluded.z,
        cmd=excluded.cmd, type=excluded.type, facing=excluded.facing,
        conditional=excluded.conditional, auto=excluded.auto, created_at=now()`;
    const n = await db()<{ n: number }[]>`select count(*)::int as n from cmdblock_restores`;
    return NextResponse.json({ ok: true, restoring: n[0]?.n ?? 0 });
  }

  return NextResponse.json({ error: 'action inconnue' }, { status: 400 });
}
