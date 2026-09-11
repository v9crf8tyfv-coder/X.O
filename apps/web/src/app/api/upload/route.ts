import { NextResponse } from 'next/server';
import { requireLevel, ADMIN_LEVEL } from '@/lib/guard';
import { hasToken, uploadPublicImage } from '@/lib/launcher';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Vercel plafonne le corps d'une requête serverless à ~4,5 Mo : l'upload direct
// d'image depuis le navigateur est donc limité. Largement suffisant pour une image.
const MAX = 4 * 1024 * 1024;
const OK_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif']);

/** Upload d'une image depuis l'ordinateur -> hébergée (release GitHub) -> renvoie l'URL publique. */
export async function POST(req: Request) {
  const g = await requireLevel(ADMIN_LEVEL);
  if (g instanceof NextResponse) return g;
  if (!hasToken()) return NextResponse.json({ error: 'Hébergement indisponible (token manquant).' }, { status: 503 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Requête invalide (fichier trop lourd ? max 4 Mo).' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Fichier manquant.' }, { status: 400 });
  }
  if (!OK_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Image uniquement (png, jpg, gif, webp, avif).' }, { status: 400 });
  }
  if (file.size > MAX) {
    return NextResponse.json(
      { error: `Image trop lourde (${(file.size / 1048576).toFixed(1)} Mo). Limite ${MAX / 1048576} Mo.` },
      { status: 413 },
    );
  }
  try {
    const data = Buffer.from(await file.arrayBuffer());
    if (data.length === 0) return NextResponse.json({ error: 'Fichier vide.' }, { status: 400 });
    const url = await uploadPublicImage(file.name || 'image', data, file.type);
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
