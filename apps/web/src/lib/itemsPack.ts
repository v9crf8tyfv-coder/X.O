import JSZip from 'jszip';
import { db } from '@xo/db';
import { addFile, hasToken } from './launcher';

// Format resource pack Minecraft 1.21 / 1.21.1.
const PACK_FORMAT = 34;

/**
 * (Re)construit le resource pack EmeriaItems.zip depuis la bibliothèque de textures pixel
 * (custom_textures) et le publie dans le launcher (resourcepacks). Chaque texture = un
 * custom_model_data posé en override sur le modèle du papier (item de base des items pixel).
 * Renvoie le nombre d'items. Lance une erreur si le token launcher manque.
 */
export async function buildItemsPack(): Promise<{ count: number }> {
  if (!hasToken()) throw new Error('Token launcher manquant (GH_LAUNCHER_TOKEN).');

  const rows = await db()<{ cmd: number; texture: string }[]>`select cmd, texture from custom_textures order by cmd`.catch(() => [] as { cmd: number; texture: string }[]);
  const items = rows.filter((r) => /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(r.texture));

  const zip = new JSZip();
  zip.file('pack.mcmeta', JSON.stringify({ pack: { pack_format: PACK_FORMAT, description: 'Emeria Items (pixel)' } }, null, 2));

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

  const buf = (await zip.generateAsync({ type: 'nodebuffer' })) as Buffer;
  await addFile('resourcepacks', 'EmeriaItems.zip', buf);
  return { count: items.length };
}
