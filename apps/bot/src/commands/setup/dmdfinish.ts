import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { GRADES, BRAND_COLOR } from '@xo/shared';
import { db } from '@xo/db';
import type { SlashCommand } from '../../types.js';

/** /dmdfinish : message de clôture de demande dans un ticket + bouton "Close le Ticket".
 *  Accessible à partir de Modo Test. Le bouton réutilise le handler existant (ticket:close). */
export const dmdfinish: SlashCommand = {
  minLevel: GRADES.modo_test.level,
  data: new SlashCommandBuilder()
    .setName('dmdfinish')
    .setDescription('Ticket : invite le joueur à fermer (avec un bouton Close le Ticket)'),

  async execute(interaction) {
    // Doit être dans un ticket ouvert.
    const open = await db()<{ x: number }[]>`
      select 1 as x from tickets where channel_id = ${interaction.channelId} and status = 'open' limit 1
    `.catch(() => [] as { x: number }[]);
    if (!open.length) {
      await interaction.reply({ content: 'Commande à utiliser dans un ticket ouvert.', ephemeral: true });
      return;
    }

    // Pseudo Minecraft du staff (carte staff), sinon son pseudo Discord.
    const staff = await db()<{ pseudo: string }[]>`
      select pseudo from staff where discord_id = ${interaction.user.id} limit 1
    `.catch(() => [] as { pseudo: string }[]);
    const pseudo = staff[0]?.pseudo ?? interaction.user.username;

    const embed = new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setDescription(
        '👉 Nous pensons avoir répondu à l’ensemble de vos demandes. Si tel est le cas, nous vous invitons à fermer votre ticket. Dans le cas contraire, celui-ci pourra être fermé par un membre du Staff.\n\n' +
          '👉 Si vous avez de nouvelles demandes, merci de nous les communiquer directement ici dans un délai maximum de **48 heures**.',
      )
      .setFooter({ text: `Cordialement ${pseudo}` });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('ticket:close').setLabel('Close le Ticket').setStyle(ButtonStyle.Danger),
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  },
};
