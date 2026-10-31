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

  // IMPORTANT : EmeriaPancarte a AUSSI un paper.json (CMD 4210/4211). Comme un seul paper.json
  // « gagne » (le pack le + haut), on fusionne les overrides Pancarte DANS celui d'EmeriaItems,
  // sinon l'un casse l'autre. Les modèles pancarte_white/black restent fournis par EmeriaPancarte.
  const PANCARTE_OVERRIDES = [
    { predicate: { custom_model_data: 4210 }, model: 'emeria:item/pancarte_white' },
    { predicate: { custom_model_data: 4211 }, model: 'emeria:item/pancarte_black' },
  ];
  // CRITIQUE : Minecraft applique un override de custom_model_data si CMD_item >= seuil, et
  // retient le DERNIER de la liste qui matche. Il FAUT donc trier les overrides par seuil CROISSANT,
  // sinon une pancarte (CMD 4210) matche aussi les items (1..7, tous <= 4210) et prend le dernier
  // listé -> la pancarte affiche un item ! Trié, 4210 prend bien le plus haut seuil <= 4210 = 4210.
  const overrides = [
    ...PANCARTE_OVERRIDES,
    ...items.map((r) => ({ predicate: { custom_model_data: r.cmd }, model: `emeria:item/i${r.cmd}` })),
  ].sort((a, b) => a.predicate.custom_model_data - b.predicate.custom_model_data);
  zip.file('assets/minecraft/models/item/paper.json', JSON.stringify({
    parent: 'minecraft:item/generated',
    textures: { layer0: 'minecraft:item/paper' },
    overrides,
  }, null, 2));

  // On FUSIONNE tout EmeriaPancarte DANS ce pack : EmeriaItems devient un sur-ensemble complet
  // (modèles + textures de pancarte, GUI sanctions, etc.). Ainsi, placé en haut, EmeriaItems
  // résout TOUT seul (items ET pancartes) sans dépendre de la position ni de la présence
  // d'EmeriaPancarte. On n'embarque PAS son paper.json (celui d'EmeriaItems, déjà fusionné ci-dessus,
  // contient les overrides des deux) ni son pack.mcmeta (EmeriaItems a le sien).
  try {
    const url = 'https://github.com/v9crf8tyfv-coder/EmeriaLauncher/releases/download/mods/EmeriaPancarte.zip';
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      const src = await JSZip.loadAsync(Buffer.from(await res.arrayBuffer()));
      const SKIP = new Set(['assets/minecraft/models/item/paper.json', 'pack.mcmeta']);
      const entries = Object.values(src.files).filter((f) => !f.dir && !SKIP.has(f.name));
      for (const f of entries) zip.file(f.name, await f.async('nodebuffer'));
    }
  } catch (e) {
    console.error('[itemsPack] fusion EmeriaPancarte', e instanceof Error ? e.message : e);
  }

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
