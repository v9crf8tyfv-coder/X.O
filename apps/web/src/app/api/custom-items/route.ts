import { NextResponse } from 'next/server';
import { db } from '@xo/db';
import { requireLevel, ADMIN_LEVEL } from '@/lib/guard';

export const runtime = 'nodejs';

interface Enchant { id: string; lvl: number }

async function ensure(): Promise<void> {
  await db()`create table if not exists custom_items (
    id serial primary key,
    item text not null,
    name text,
    lore jsonb,
    enchants jsonb,
    target text not null,
    status text not null default 'pending',
    created_at timestamptz not null default now()
  )`.catch(() => {});
}

const idRe = /^[a-z0-9_.-]+:[a-z0-9_./-]+$/;

// Renvoie un tableau, que la valeur soit déjà un tableau jsonb ou une chaîne JSON.
function asArr<T = unknown>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (typeof v === 'string') { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; } }
  return [];
}

// GET ?for=game (mod, public) : items en attente. GET (fonda) : liste récente.
export async function GET(req: Request) {
  await ensure();
  const url = new URL(req.url);
  if (url.searchParams.get('for') === 'game') {
    const rows = await db()<{ id: number; item: string; name: string | null; lore: unknown; enchants: unknown; target: string }[]>`
      select id, item, name, lore, enchants, target from custom_items where status = 'pending' order by id limit 50`;
    const gives = rows.map((r) => ({
      id: r.id,
      item: r.item,
      name: r.name ?? '',
      lore: asArr<string>(r.lore),
      enchants: asArr<{ id: string; lvl: number }>(r.enchants),
      target: r.target,
    }));
    const res = NextResponse.json({ gives });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }
  const g = await requireLevel(ADMIN_LEVEL);
  if (g instanceof NextResponse) return g;
  const rows = await db()<{ id: number; item: string; name: string | null; enchants: unknown; target: string; status: string }[]>`
    select id, item, name, enchants, target, status, created_at
    from custom_items order by created_at desc limit 50`;
  const items = rows.map((r) => ({ ...r, enchants: asArr<{ id: string; lvl: number }>(r.enchants) }));
  return NextResponse.json({ items });
}

// POST : soit le mod marque des items traités ({done:[ids]}), soit un fonda crée un give.
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  await ensure();

  // Marquage "traité" par le mod (pas d'auth : simple changement de statut).
  if (Array.isArray(b.done)) {
    const ids = b.done.map((n: unknown) => Number(n)).filter((n: number) => Number.isInteger(n) && n > 0);
    for (const id of ids) {
      await db()`update custom_items set status = 'done' where id = ${id}`.catch(() => {});
    }
    return NextResponse.json({ ok: true, done: ids.length });
  }

  // Création (fonda uniquement).
  const guard = await requireLevel(ADMIN_LEVEL);
  if (guard instanceof NextResponse) return guard;

  const item = String(b.item || '').trim().toLowerCase();
  const target = String(b.target || '').trim();
  const name = String(b.name || '').trim() || null;
  if (!idRe.test(item)) return NextResponse.json({ error: "ID d'item invalide (ex. minecraft:netherite_pickaxe)." }, { status: 400 });
  if (!target) return NextResponse.json({ error: 'Pseudo cible manquant.' }, { status: 400 });

  const lore: string[] = Array.isArray(b.lore)
    ? b.lore.map((s: unknown) => String(s ?? '')).filter((s: string) => s.length > 0).slice(0, 12)
    : [];
  const enchants: Enchant[] = Array.isArray(b.enchants)
    ? b.enchants
        .map((e: { id?: unknown; lvl?: unknown }) => ({ id: String(e?.id ?? '').trim().toLowerCase(), lvl: Math.floor(Number(e?.lvl) || 1) }))
        .filter((e: Enchant) => idRe.test(e.id) && e.lvl > 0)
        .slice(0, 20)
    : [];

  await db()`
    insert into custom_items (item, name, lore, enchants, target)
    values (${item}, ${name}, ${JSON.stringify(lore)}::jsonb, ${JSON.stringify(enchants)}::jsonb, ${target})`;
  return NextResponse.json({ ok: true });
}

// DELETE ?id= (fonda) : retire un give de la file.
export async function DELETE(req: Request) {
  const g = await requireLevel(ADMIN_LEVEL);
  if (g instanceof NextResponse) return g;
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'id manquant' }, { status: 400 });
  await ensure();
  await db()`delete from custom_items where id = ${id}`;
  return NextResponse.json({ ok: true });
}
