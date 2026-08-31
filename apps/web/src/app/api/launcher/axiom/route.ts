import { NextResponse } from 'next/server';
import { requireLevel, FOUNDER_LEVEL } from '@/lib/guard';
import { addAxiom, removeAxiom, hasToken } from '@/lib/launcher';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Ajoute un pseudo à la liste Axiom (staff build). Fonda/co-fonda. */
export async function POST(req: Request) {
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;
  if (!hasToken()) return NextResponse.json({ error: 'token_manquant' }, { status: 503 });
  const { pseudo } = await req.json().catch(() => ({}));
  const p = String(pseudo || '').trim();
  if (!/^[A-Za-z0-9_]{2,16}$/.test(p)) {
    return NextResponse.json({ error: 'Pseudo Minecraft invalide.' }, { status: 400 });
  }
  try {
    return NextResponse.json({ ok: true, manifest: await addAxiom(p) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

/** Retire un pseudo de la liste Axiom. */
export async function DELETE(req: Request) {
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;
  if (!hasToken()) return NextResponse.json({ error: 'token_manquant' }, { status: 503 });
  const pseudo = new URL(req.url).searchParams.get('pseudo');
  if (!pseudo) return NextResponse.json({ error: 'pseudo requis.' }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, manifest: await removeAxiom(pseudo) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
