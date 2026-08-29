import { EmbedBuilder, type Client, type Guild, type TextChannel } from 'discord.js';
import { CHANNELS } from '@xo/shared';
import { db, hasDatabase } from '@xo/db';
import { EFFECTIF_SECTIONS, sectionForGrades, type EffectifRow } from './effectif.js';

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

/**
 * Publie l'effectif dans le salon accueil : un embed d'en-tête (logo Emeria) +
 * un embed par grade (logo + "Pseudo — @mention — ID"). Édite le message existant.
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
  const sections = EFFECTIF_SECTIONS.map((sec) => {
    const members = rows.filter((r) => sectionForGrades(r.grades) === sec.key);
    const tag = emojiTag(guild, sec.emoji);
    const head = `${tag ? tag + ' ' : ''}**${sec.label}** — ${members.length}`;
    const body = members.length
      ? members
          .map((m) => {
            const dc = m.discord_id ? ` — <@${m.discord_id}>` : '';
            return `> ${m.is_absent ? '⏰ ' : ''}**${escMd(m.pseudo)}**${dc}`;
          })
          .join('\n')
      : '> *—*';
    return `${head}\n${body}`;
  });

  const description =
    '**Liens utiles**\n' +
    '> [Site officiel](https://emeria-site.com)\n\n' +
    '**Hiérarchie du staff**\n\n' +
    sections.join('\n\n');

  const embed = new EmbedBuilder()
    .setColor(0x8b5cf6)
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
