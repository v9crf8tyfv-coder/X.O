import { NextResponse } from 'next/server';
import { db } from '@xo/db';
import { requireLevel, FOUNDER_LEVEL } from '@/lib/guard';
import { getCurrentAccount } from '@/lib/auth';

export const runtime = 'nodejs';

/** Config d'accès : { sectionId: niveau minimum requis }. Stockée dans app_config (k/v). */
async function readAccess(): Promise<Record<string, number>> {
  try {
    const r = await db()<{ v: string }[]>`select v from app_config where k = 'panel_access' limit 1`;
    return r[0]?.v ? (JSON.parse(r[0].v) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

/** Lecture : accessible à tout compte connecté (sert à masquer/afficher les sections). */
export async function GET() {
  const account = await getCurrentAccount();
  if (!account) return NextResponse.json({ error: 'auth' }, { status: 401 });
  return NextResponse.json({ access: await readAccess() });
}

/** Écriture : Fondateurs uniquement. */
export async function POST(req: Request) {
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;

  const b = await req.json().catch(() => ({}));
  const access = b?.access;
  if (!access || typeof access !== 'object') {
    return NextResponse.json({ error: 'Config invalide.' }, { status: 400 });
  }
  // Ne garde que des paires id -> niveau entier 0..100.
  const clean: Record<string, number> = {};
  for (const [k, v] of Object.entries(access)) {
    const n = Number(v);
    if (typeof k === 'string' && Number.isFinite(n) && n >= 0 && n <= 100) clean[k] = Math.round(n);
  }
  const json = JSON.stringify(clean);
  await db()`insert into app_config (k, v) values ('panel_access', ${json})
    on conflict (k) do update set v = ${json}`;
  return NextResponse.json({ ok: true });
}
