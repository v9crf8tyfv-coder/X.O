import { NextResponse } from 'next/server';
import { db } from '@xo/db';
import { requireLevel, ADMIN_LEVEL } from '@/lib/guard';
import { buildItemsPack } from '@/lib/itemsPack';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Resource pack EmeriaItems.zip (items pixel).
 * GET  : nombre de textures dans la bibliothèque.
 * POST : (re)construit et publie le pack.
 */
export async function GET() {
  const g = await requireLevel(ADMIN_LEVEL);
  if (g instanceof NextResponse) return g;
  const rows = await db()<{ n: string }[]>`select count(*)::text as n from custom_textures`.catch(() => [{ n: '0' }]);
  return NextResponse.json({ count: Number(rows[0]?.n ?? 0) });
}

export async function POST() {
  const g = await requireLevel(ADMIN_LEVEL);
  if (g instanceof NextResponse) return g;
  try {
    const { count } = await buildItemsPack();
    return NextResponse.json({ ok: true, count });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
