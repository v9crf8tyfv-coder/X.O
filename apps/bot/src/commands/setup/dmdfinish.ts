import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type GuildMember,
} from 'discord.js';
import { GRADES, BRAND_COLOR, STAFF_GRADE_EMOJI, gradeLogoKey } from '@xo/shared';
import { db } from '@xo/db';
import { highestGrade } from '../../lib/permissions.js';
import type { SlashCommand } from '../../types.js';

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
    // Doit être dans un ticket ouvert. On récupère aussi l'ouvreur pour le mentionner.
    const open = await db()<{ opener_id: string }[]>`
      select opener_id from tickets where channel_id = ${interaction.channelId} and status = 'open' limit 1
    `.catch(() => [] as { opener_id: string }[]);
    if (!open.length) {
      await interaction.reply({ content: 'Commande à utiliser dans un ticket ouvert.', ephemeral: true });
      return;
    }
    const openerId = open[0]!.opener_id;

    // Pseudo Minecraft du staff (carte staff), sinon son pseudo Discord.
    const staff = await db()<{ pseudo: string }[]>`
      select pseudo from staff where discord_id = ${interaction.user.id} limit 1
    `.catch(() => [] as { pseudo: string }[]);
    const pseudo = staff[0]?.pseudo ?? interaction.user.username;

    // Logo Discord du grade du staff : résolu par NOM dans le serveur (pas d'ID en dur).
    const member = interaction.member as GuildMember | null;
    const gradeKey = member ? highestGrade(member)?.key ?? null : null;
    let gradeEmoji = '';
    if (gradeKey && interaction.guild) {
      const wanted = STAFF_GRADE_EMOJI[gradeLogoKey(gradeKey)];
      if (wanted) {
        const target = normName(wanted);
        const found = interaction.guild.emojis.cache.find((e) => e.name && normName(e.name) === target);
        if (found) gradeEmoji = ` ${found.toString()}`;
      }
    }

    const embed = new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setDescription(
        '# Ticket Joueur(s)\n\n' +
          '👉 Nous pensons avoir répondu à l’ensemble de vos **demandes**. Si tel est le cas, nous vous invitons à **fermer votre ticket**. Dans le cas contraire, celui-ci pourra être fermé par un membre du Staff.\n\n' +
          '👉 Si vous avez de nouvelles demandes, merci de nous les communiquer directement ici dans un délai maximum de **48 heures**.\n\n' +
          `Cordialement, ${pseudo}${gradeEmoji}`,
      );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('ticket:close').setLabel('Close le Ticket').setStyle(ButtonStyle.Danger),
    );

    // Mention de l'ouvreur du ticket (le ping se fait via le content).
    await interaction.reply({ content: `<@${openerId}>`, embeds: [embed], components: [row] });

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
