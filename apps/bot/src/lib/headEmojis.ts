import type { Client } from 'discord.js';

/**
 * Têtes des joueurs en ÉMOJIS D'APPLICATION (pas des émojis de serveur).
 *  - jusqu'à 2000 émojis sur l'application, aucun slot serveur utilisé ;
 *  - créés UNE seule fois par pseudo (depuis mc-heads), puis référencés par ID ;
 *  - aucune image stockée par le bot (hébergées par Discord) → zéro RAM en continu.
 */

const cache = new Map<string, string>(); // nom d'émoji -> id
let loaded = false;
let loading: Promise<void> | null = null;

/** Nom d'émoji valide (Tr_<pseudo>) : 2–32 caractères, [A-Za-z0-9_]. (Tr = tête ronde) */
function emojiName(pseudo: string): string {
  const clean = pseudo.replace(/[^A-Za-z0-9_]/g, '');
  return ('Tr_' + clean).slice(0, 32) || 'Tr_x';
}

async function ensureLoaded(client: Client): Promise<void> {
  if (loaded) return;
  if (!loading) {
    loading = (async () => {
      try {
        const emojis = await client.application!.emojis.fetch();
        for (const e of emojis.values()) if (e.name) cache.set(e.name, e.id);
        loaded = true;
      } catch (e) {
        console.error('[heads] fetch', e instanceof Error ? e.message : e);
      } finally {
        loading = null;
      }
    })();
  }
  await loading;
}

/**
 * Renvoie le markup de la tête d'un pseudo (`<:Tete_x:id>`), en créant l'émoji
 * d'application si besoin. Renvoie '' si impossible (sans jamais throw).
 */
export async function headEmoji(client: Client, pseudo: string): Promise<string> {
  if (!client.application || !pseudo) return '';
  await ensureLoaded(client);
  const name = emojiName(pseudo);
  const cached = cache.get(name);
  if (cached) return `<:${name}:${cached}>`;
  try {
    // wsrv.nl arrondit l'image côté serveur (mask=circle) → aucun traitement sur le bot.
    // Timeout 6s : si le service externe traîne, on abandonne cette tête au lieu de BLOQUER
    // tout l'effectif (c'était la cause du "/effectif charge à l'infini").
    const src = `mc-heads.net/avatar/${encodeURIComponent(pseudo)}/64`;
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 6000);
    let res: Response;
    try {
      res = await fetch(`https://wsrv.nl/?url=${encodeURIComponent(src)}&mask=circle&output=png`, { signal: ctrl.signal });
    } finally {
      clearTimeout(to);
    }
    if (!res.ok) return '';
    const buf = Buffer.from(await res.arrayBuffer());
    const emoji = await client.application.emojis.create({ attachment: buf, name });
    cache.set(name, emoji.id);
    return `<:${name}:${emoji.id}>`;
  } catch (e) {
    console.error('[heads] create', pseudo, e instanceof Error ? e.message : e);
    return '';
  }
}
