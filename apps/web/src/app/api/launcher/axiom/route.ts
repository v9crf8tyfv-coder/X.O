import { NextResponse } from 'next/server';
import { getGrade } from '@xo/shared';
import { requireLevel, FOUNDER_LEVEL } from '@/lib/guard';
import { addAxiom, removeAxiom, addCom, removeCom, addBuild, removeBuild, hasToken } from '@/lib/launcher';
import { listStaff } from '@/lib/staff';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Niveau à partir duquel Axiom est donné automatiquement (Responsable et plus). */
const AXIOM_AUTO_LEVEL = 70;
const MANIFEST_URL =
  'https://github.com/v9crf8tyfv-coder/EmeriaLauncher/releases/download/mods/manifest.json';

/**
 * Liste des pseudos autorisés à Axiom, pour le launcher (public) :
 *  - AUTO : tout staff dont un grade est de niveau >= Responsable (70)
 *  - MANUEL : les pseudos ajoutés à la main dans le manifest (axiomAllowed)
 * Union des deux. Ne nécessite aucun token (lecture du manifest public).
 */
export async function GET() {
  const set = new Set<string>();
  const comSet = new Set<string>();
  const buildSet = new Set<string>();
  // Auto : staff resp+ (Axiom uniquement ; Build/Com n'ont PAS d'auto, seulement les ajouts manuels).
  try {
    for (const s of await listStaff()) {
      const top = Math.max(0, ...(s.grades ?? []).map((k) => getGrade(k).level));
      if (top >= AXIOM_AUTO_LEVEL && s.pseudo) set.add(s.pseudo);
    }
  } catch { /* base indispo -> on garde juste le manuel */ }
  // Manuel : axiomAllowed + buildAllowed + comAllowed du manifest public (même fetch).
  try {
    const r = await fetch(MANIFEST_URL + '?t=' + Date.now(), { cache: 'no-store' });
    if (r.ok) {
      const m = await r.json();
      for (const p of Array.isArray(m.axiomAllowed) ? m.axiomAllowed : []) if (typeof p === 'string' && p) set.add(p);
      for (const p of Array.isArray(m.buildAllowed) ? m.buildAllowed : []) if (typeof p === 'string' && p) buildSet.add(p);
      for (const p of Array.isArray(m.comAllowed) ? m.comAllowed : []) if (typeof p === 'string' && p) comSet.add(p);
    }
  } catch { /* manifest indispo -> on garde juste l'auto */ }
  return NextResponse.json(
    { allowed: [...set], build: [...buildSet], com: [...comSet] },
    { headers: { 'Cache-Control': 'public, max-age=60' } },
  );
}

/** Ajoute un pseudo à la liste Axiom (staff build). Fonda/co-fonda. */
export async function POST(req: Request) {
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;
  if (!hasToken()) return NextResponse.json({ error: 'token_manquant' }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const p = String(body.pseudo || '').trim();
  const type = body.type === 'com' ? 'com' : body.type === 'build' ? 'build' : 'axiom';
  if (!/^[A-Za-z0-9_]{2,16}$/.test(p)) {
    return NextResponse.json({ error: 'Pseudo Minecraft invalide.' }, { status: 400 });
  }
  try {
    const manifest = type === 'com' ? await addCom(p) : type === 'build' ? await addBuild(p) : await addAxiom(p);
    return NextResponse.json({ ok: true, manifest });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

/** Retire un pseudo de la liste Axiom. */
export async function DELETE(req: Request) {
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;
  if (!hasToken()) return NextResponse.json({ error: 'token_manquant' }, { status: 503 });
  const url = new URL(req.url);
  const pseudo = url.searchParams.get('pseudo');
  const t = url.searchParams.get('type');
  const type = t === 'com' ? 'com' : t === 'build' ? 'build' : 'axiom';
  if (!pseudo) return NextResponse.json({ error: 'pseudo requis.' }, { status: 400 });
  try {
    const manifest = type === 'com' ? await removeCom(pseudo) : type === 'build' ? await removeBuild(pseudo) : await removeAxiom(pseudo);
    return NextResponse.json({ ok: true, manifest });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
