import { EmbedBuilder, type Client, type Guild, type TextChannel } from 'discord.js';
import { CHANNELS } from '@xo/shared';
import { db, hasDatabase } from '@xo/db';
import { EFFECTIF_SECTIONS, sectionForGrades, type EffectifRow } from './effectif.js';
import { headEmoji } from './headEmojis.js';

const EMERIA_EMOJI = 'EmeriaMC';

/** URL de l'image d'un emoji du serveur, résolu par son nom. */
function emojiUrl(guild: Guild | null, name: string): string | undefined {
  const e = guild?.emojis.cache.find((em) => em.name === name);
  return e ? e.imageURL({ size: 128 }) : undefined;
}

/** Markup d'un emoji du serveur (ex "<:LogoResp:123>"), utilisable dans un texte. */
function emojiTag(guild: Guild | null, name: string): string {
  const e = guild?.emojis.cache.find((em) => em.name === name);
  return e ? e.toString() : '';
}

/** Neutralise le markdown dans un pseudo (ex "_Roi_tortue_" ne devient pas italique). */
function escMd(s: string): string {
  return s.replace(/([\\_*~`|])/g, '\\$1');
}

/** Retrouve l'ID Discord d'un membre par son nom d'utilisateur (pour les mentions fondateur). */
async function memberIdByUsername(guild: Guild | null, username: string): Promise<string | null> {
  if (!guild) return null;
  const uname = username.toLowerCase();
  const cached = guild.members.cache.find((m) => m.user.username.toLowerCase() === uname);
  if (cached) return cached.id;
  try {
    const found = await guild.members.fetch({ query: username, limit: 5 });
    const m = found.find((x) => x.user.username.toLowerCase() === uname);
    return m ? m.id : null;
  } catch {
    return null;
  }
}

/**
 * Publie l'effectif dans le salon accueil : UN seul embed (liens utiles + hiérarchie).
 * Édite le message existant.
 */
export async function publishEffectif(client: Client): Promise<void> {
  if (!hasDatabase()) return;

  const rows = await db()<EffectifRow[]>`
    select pseudo, grades, discord_id, is_absent from staff where active = true
  `;

  const channel = await client.channels.fetch(CHANNELS.accueil).catch(() => null);
  if (!channel?.isTextBased()) return;
  const text = channel as TextChannel;
  const guild = text.guild;

  // Un seul embed, propre et aéré : liens utiles en haut, puis la hiérarchie en liste.
  const sections = await Promise.all(
    EFFECTIF_SECTIONS.map(async (sec) => {
      const members = rows.filter((r) => sectionForGrades(r.grades) === sec.key);
      const tag = emojiTag(guild, sec.emoji);
      const header = `${tag ? tag + ' ' : ''}**${sec.label}** — ${members.length}`;
      const body = members.length
        ? (
            await Promise.all(
              members.map(async (m) => {
                const dc = m.discord_id ? ` — <@${m.discord_id}>` : '';
                const th = await headEmoji(client, m.pseudo);
                return `> ${th ? th + ' ' : ''}${m.is_absent ? '⏰ ' : ''}**${escMd(m.pseudo)}**${dc}`;
              }),
            )
          ).join('\n')
        : '> *—*';
      return `${header}\n${body}`;
    }),
  );

  // Fondateurs (pas des cartes staff en base) — affichés en tête de la hiérarchie.
  const fondaTag = emojiTag(guild, 'LogoFondateur');
  const xtazzId = await memberIdByUsername(guild, 'ilian0800');
  const orionId = await memberIdByUsername(guild, 'orionyx84');
  const xtazzMention = xtazzId ? `<@${xtazzId}>` : 'ilian0800';
  const orionMention = orionId ? `<@${orionId}>` : 'orionyx84';
  const xtazzHead = await headEmoji(client, 'Xtazzking');
  const orionHead = await headEmoji(client, 'Orionyx84');
  const fondateurBlock =
    `${fondaTag ? fondaTag + ' ' : ''}**Fondateur** — 2\n` +
    `> ${xtazzHead ? xtazzHead + ' ' : ''}**Xtazzking** — ${xtazzMention}\n` +
    `> ${orionHead ? orionHead + ' ' : ''}**Orionyx84** — ${orionMention}`;

  const description =
    '__**Liens utiles**__\n' +
    '> [Site officiel](https://emeria-site.com)\n' +
    '> [TikTok](https://www.tiktok.com/@emeriamc)\n' +
    '> [Twitch](https://www.twitch.tv/emeriamc)\n' +
    '> [YouTube](https://youtube.com/@emeriamc)\n' +
    '> [Instagram](https://www.instagram.com/emeriamc)\n\n' +
    '__**Vote**__\n' +
    '> [Serveur Minecraft Vote](https://serveur-minecraft-vote.fr/serveur/2803/voter)\n' +
    '> [Liste Serveurs Minecraft](https://www.liste-serveurs-minecraft.org/serveur-minecraft/emeriamc/)\n' +
    '> [Serveur Privé](https://serveur-prive.net/minecraft/emeriamc/vote)\n' +
    '> [Top Serveurs](https://top-serveurs.net/minecraft/vote/emeriamc/success)\n\n' +
    '__**Hiérarchie du staff**__\n\n' +
    fondateurBlock + '\n\n' +
    sections.join('\n\n');

  const embed = new EmbedBuilder()
    .setColor(0x4c1d95) // violet foncé
    .setAuthor({ name: 'Effectif du Staff — EmeriaMC', iconURL: emojiUrl(guild, EMERIA_EMOJI) })
    .setDescription(description);

  const embeds: EmbedBuilder[] = [embed];

  const stored = await db()<{ value: string }[]>`
    select value from bot_state where key = 'effectif_message_id'
  `;
  const id = stored[0]?.value;
  if (id) {
    const msg = await text.messages.fetch(id).catch(() => null);
    if (msg) {
      await msg.edit({ embeds });
      return;
    }
  }
  const msg = await text.send({ embeds });
  await db()`
    insert into bot_state (key, value) values ('effectif_message_id', ${msg.id})
    on conflict (key) do update set value = ${msg.id}, updated_at = now()
  `;
}
