import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type GuildMember,
  type TextChannel,
} from 'discord.js';
import { GRADES, STAFF_GRADE_EMOJI, FOUNDER_IG_PSEUDO, gradeLogoKey } from '@xo/shared';
import { db } from '@xo/db';
import { highestGrade } from '../../lib/permissions.js';
import type { SlashCommand } from '../../types.js';

/** Emoji flèche (custom) affiché avant le lien du message de base. */
const ARROW_FALLBACK = '<:arrow:1537496475649703946>';

/** Normalise un nom d'emoji (sans accents/espaces, minuscule) pour comparer souplement. */
function normName(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

/** /dmdfinish : message de clôture de demande dans un ticket + bouton "Close le Ticket".
 *  Accessible à partir de Modo Test. Le bouton réutilise le handler existant (ticket:close). */
export const dmdfinish: SlashCommand = {
  minLevel: GRADES.modo_test.level,
  data: new SlashCommandBuilder()
    .setName('dmdfinish')
    .setDescription('Ticket : invite le joueur à fermer (avec un bouton Close le Ticket)'),

  async execute(interaction) {
    // Doit être dans un ticket ouvert. On récupère l'ouvreur pour le mentionner.
    const open = await db()<{ opener_id: string }[]>`
      select opener_id from tickets where channel_id = ${interaction.channelId} and status = 'open' limit 1
    `.catch(() => [] as { opener_id: string }[]);
    if (!open.length) {
      await interaction.reply({ content: 'Commande à utiliser dans un ticket ouvert.', ephemeral: true });
      return;
    }
    const openerId = open[0]!.opener_id;

    // Pseudo IN-GAME du staff : carte staff (par discord_id ou tag), sinon repli fondateurs
    // sans carte, sinon compte site (par username), sinon en dernier recours le pseudo Discord.
    const username = interaction.user.username;
    const staff = await db()<{ pseudo: string }[]>`
      select pseudo from staff
      where discord_id = ${interaction.user.id} or lower(discord_tag) = lower(${username})
      limit 1
    `.catch(() => [] as { pseudo: string }[]);
    let pseudo = staff[0]?.pseudo ?? '';
    if (!pseudo) pseudo = FOUNDER_IG_PSEUDO[username.toLowerCase()] ?? '';
    if (!pseudo) {
      const acc = await db()<{ pseudo: string }[]>`
        select minecraft_pseudo as pseudo from accounts
        where lower(username) = lower(${username}) and minecraft_pseudo is not null
        limit 1
      `.catch(() => [] as { pseudo: string }[]);
      pseudo = acc[0]?.pseudo ?? username;
    }

    // Résolution d'un emoji custom par NOM dans le serveur (pas d'ID en dur).
    const findEmoji = (name: string): string | null => {
      if (!interaction.guild) return null;
      const target = normName(name);
      const e = interaction.guild.emojis.cache.find((em) => em.name && normName(em.name) === target);
      return e ? e.toString() : null;
    };

    // Logo Discord du grade du staff (mutualisé par gradeLogoKey).
    const member = interaction.member as GuildMember | null;
    const gradeKey = member ? highestGrade(member)?.key ?? null : null;
    let gradeEmoji = '';
    if (gradeKey) {
      const wanted = STAFF_GRADE_EMOJI[gradeLogoKey(gradeKey)];
      const found = wanted ? findEmoji(wanted) : null;
      if (found) gradeEmoji = ` ${found}`;
    }

    // Lien vers le message de BASE (l'en-tête épinglé posté par XO à la création du ticket).
    let baseLink = '';
    const chan = interaction.channel as TextChannel | null;
    if (chan && 'messages' in chan) {
      try {
        const pins = await chan.messages.fetchPinned();
        const botPins = [...pins.values()]
          .filter((m) => m.author.id === interaction.client.user?.id)
          .sort((a, b) => a.createdTimestamp - b.createdTimestamp);
        if (botPins[0]) baseLink = botPins[0].url;
      } catch {
        /* pas de message épinglé -> pas de lien */
      }
    }
    const arrow = findEmoji('arrow') ?? ARROW_FALLBACK;

    const content =
      `Cher <@${openerId}>, \n\n` +
      '1. 👉 Nous pensons avoir répondu à l’ensemble de vos **demandes**. Si tel est le cas, nous vous invitons à **fermer votre ticket.** Dans le cas contraire, celui-ci pourra être fermé par un membre du Staff.\n\n' +
      '2. 👉 Si vous avez de nouvelles demandes, merci de nous les communiquer directement ici dans un délai maximum de **48 heures**.\n\n' +
      (baseLink ? `${arrow}${baseLink}\n` : '') +
      `**Cordialement, ${pseudo}${gradeEmoji}**`;

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('ticket:close').setLabel('Close le Ticket').setStyle(ButtonStyle.Danger),
    );

    await interaction.reply({ content, components: [row], allowedMentions: { users: [openerId] } });

    // Log de l'usage (pour le Suivis Staff : nombre de /dmdfinish par mois et par staff).
    await db()`
      create table if not exists dmdfinish_log (
        id bigserial primary key,
        discord_id text not null,
        pseudo text,
        channel_id text,
        used_at timestamptz not null default now()
      )
    `.catch(() => {});
    await db()`
      insert into dmdfinish_log (discord_id, pseudo, channel_id)
      values (${interaction.user.id}, ${pseudo}, ${interaction.channelId})
    `.catch(() => {});
  },
};
