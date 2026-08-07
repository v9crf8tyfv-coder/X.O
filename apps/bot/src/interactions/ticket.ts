import {
  ChannelType,
  MessageFlags,
  type StringSelectMenuInteraction,
  type ButtonInteraction,
  type TextChannel,
} from 'discord.js';
import type { ComponentHandler } from '../types.js';
import { db, hasDatabase } from '@xo/db';
import { successEmbed, errorEmbed } from '../lib/embeds.js';
import {
  findCategory,
  buildTicketOverwrites,
  buildTicketHeaderEmbed,
  buildCloseButton,
  type TicketSpace,
} from '../lib/tickets.js';

/** Menu de catégorie -> crée le salon de ticket */
export const ticketOpen: ComponentHandler<StringSelectMenuInteraction> = {
  prefix: 'ticket:open',
  async execute(interaction) {
    const space = interaction.customId.split(':')[2] as TicketSpace;
    const categoryId = interaction.values[0]!;
    const category = findCategory(space, categoryId);
    const guild = interaction.guild;
    if (!category || !guild) {
      await interaction.reply({
        embeds: [errorEmbed('Erreur', 'Catégorie invalide.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Un seul ticket ouvert par personne et par espace
    if (hasDatabase()) {
      const existing = await db()<{ channel_id: string }[]>`
        select channel_id from tickets
        where opener_id = ${interaction.user.id} and space = ${space} and status = 'open'
      `;
      if (existing.length > 0) {
        await interaction.editReply({
          embeds: [
            errorEmbed('Ticket déjà ouvert', `Tu as déjà un ticket : <#${existing[0]!.channel_id}>`),
          ],
        });
        return;
      }
    }

    // Salon rangé sous la même catégorie que le panneau
    const panelChannel = interaction.channel as TextChannel | null;
    const parentId = panelChannel?.parentId ?? undefined;

    const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
    const ticketChannel = await guild.channels.create({
      name: `ticket-${safeName || interaction.user.id.slice(-4)}`,
      type: ChannelType.GuildText,
      parent: parentId,
      permissionOverwrites: buildTicketOverwrites(guild, interaction.user.id, category),
    });

    // Embed persistant (épinglé) : pseudo + type + bouton fermer
    const header = await ticketChannel.send({
      content: `<@${interaction.user.id}>`,
      embeds: [buildTicketHeaderEmbed(interaction.user.tag, category)],
      components: [buildCloseButton()],
    });
    await header.pin().catch(() => {});

    if (hasDatabase()) {
      await db()`
        insert into tickets (channel_id, category_id, space, opener_id, opener_tag, status)
        values (${ticketChannel.id}, ${category.id}, ${space}, ${interaction.user.id},
                ${interaction.user.tag}, 'open')
      `;
    }

    await interaction.editReply({
      embeds: [successEmbed('Ticket créé', `Ton ticket : <#${ticketChannel.id}>`)],
    });
  },
};

/** Bouton Fermer -> supprime le salon */
export const ticketClose: ComponentHandler<ButtonInteraction> = {
  prefix: 'ticket:close',
  async execute(interaction) {
    const channel = interaction.channel as TextChannel | null;
    if (!channel) return;

    await interaction.reply({
      embeds: [successEmbed('Fermeture…', 'Ce ticket sera supprimé dans 5 secondes.')],
    });

    if (hasDatabase()) {
      await db()`
        update tickets set status = 'closed', closed_by = ${interaction.user.tag}, closed_at = now()
        where channel_id = ${channel.id}
      `.catch(() => {});
    }

    setTimeout(() => {
      channel.delete('Ticket fermé').catch(() => {});
    }, 5000);
  },
};
