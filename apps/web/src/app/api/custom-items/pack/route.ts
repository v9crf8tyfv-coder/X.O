import { NextResponse } from 'next/server';
import JSZip from 'jszip';
import { db } from '@xo/db';
import { requireLevel, ADMIN_LEVEL } from '@/lib/guard';
import { addFile, hasToken } from '@/lib/launcher';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Format resource pack Minecraft 1.21 / 1.21.1.
const PACK_FORMAT = 34;

/**
 * Génère le resource pack EmeriaItems.zip à partir de la bibliothèque de textures pixel
 * (custom_textures) et le publie dans le launcher (resourcepacks). Chaque texture = un
 * custom_model_data, posé en override sur le modèle du papier (item de base des items pixel).
 *
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
  if (!hasToken()) return NextResponse.json({ error: 'Token launcher manquant (GH_LAUNCHER_TOKEN).' }, { status: 503 });

  const rows = await db()<{ cmd: number; texture: string }[]>`select cmd, texture from custom_textures order by cmd`.catch(() => [] as { cmd: number; texture: string }[]);
  const items = rows.filter((r) => /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(r.texture));

  const zip = new JSZip();
  zip.file('pack.mcmeta', JSON.stringify({ pack: { pack_format: PACK_FORMAT, description: 'Emeria Items (pixel)' } }, null, 2));

  // Override sur le papier : chaque custom_model_data -> un modèle emeria dédié.
  const overrides = items.map((r) => ({ predicate: { custom_model_data: r.cmd }, model: `emeria:item/i${r.cmd}` }));
  zip.file('assets/minecraft/models/item/paper.json', JSON.stringify({
    parent: 'minecraft:item/generated',
    textures: { layer0: 'minecraft:item/paper' },
    overrides,
  }, null, 2));

  for (const r of items) {
    zip.file(`assets/emeria/models/item/i${r.cmd}.json`, JSON.stringify({
      parent: 'minecraft:item/generated',
      textures: { layer0: `emeria:item/i${r.cmd}` },
    }));
    const b64 = r.texture.slice(r.texture.indexOf(',') + 1);
    zip.file(`assets/emeria/textures/item/i${r.cmd}.png`, Buffer.from(b64, 'base64'));
  }

  try {
    const buf = (await zip.generateAsync({ type: 'nodebuffer' })) as Buffer;
    const manifest = await addFile('resourcepacks', 'EmeriaItems.zip', buf);
    return NextResponse.json({ ok: true, count: items.length, manifest });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
