import { NextResponse } from 'next/server';
import { requireLevel, FOUNDER_LEVEL } from '@/lib/guard';
import { getBackup, restoreBackup, saveBackupNow, hasToken } from '@/lib/launcher';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Aperçu de la sauvegarde disponible (nombre de mods, etc.). */
export async function GET() {
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;
  if (!hasToken()) return NextResponse.json({ error: 'token_manquant' }, { status: 503 });
  try {
    const bak = await getBackup();
    if (!bak) return NextResponse.json({ available: false });
    return NextResponse.json({
      available: true,
      counts: { mods: bak.mods.length, resourcepacks: bak.resourcepacks.length, optional: bak.optional.length },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

/** POST {save:true} : force une sauvegarde de l'état COURANT. Sinon : restaure la dernière sauvegarde. */
export async function POST(req: Request) {
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;
  if (!hasToken()) return NextResponse.json({ error: 'token_manquant' }, { status: 503 });
  const body = await req.json().catch(() => ({} as { save?: boolean }));
  try {
    if (body.save) { await saveBackupNow(); return NextResponse.json({ ok: true, saved: true }); }
    const manifest = await restoreBackup();
    return NextResponse.json({ ok: true, manifest });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
