import {
  ChannelType,
  MessageFlags,
  EmbedBuilder,
  AttachmentBuilder,
  type StringSelectMenuInteraction,
  type ButtonInteraction,
  type TextChannel,
} from 'discord.js';
import type { ComponentHandler } from '../types.js';
import { db, hasDatabase } from '@xo/db';
import { CHANNELS, BRAND_COLOR } from '@xo/shared';
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

/** Bouton Fermer -> archive (récap + transcription) puis supprime le salon */
export const ticketClose: ComponentHandler<ButtonInteraction> = {
  prefix: 'ticket:close',
  async execute(interaction) {
    const channel = interaction.channel as TextChannel | null;
    if (!channel) return;

    await interaction.reply({
      embeds: [
        successEmbed(
          'Fermeture…',
          'Archivage en cours, le ticket sera supprimé dans quelques secondes.',
        ),
      ],
    });

    // Infos du ticket (si base configurée)
    let info: {
      category_id: string;
      space: string;
      opener_tag: string;
    } | null = null;
    if (hasDatabase()) {
      const rows = await db()<
        { category_id: string; space: string; opener_tag: string }[]
      >`
        select category_id, space, opener_tag from tickets where channel_id = ${channel.id}
      `.catch(() => [] as { category_id: string; space: string; opener_tag: string }[]);
      info = rows[0] ?? null;
      await db()`
        update tickets set status = 'closed', closed_by = ${interaction.user.tag}, closed_at = now()
        where channel_id = ${channel.id}
      `.catch(() => {});
    }

    // Transcription + envoi dans le salon archives
    try {
      const transcript = await buildTranscript(channel);
      const archive = await interaction.client.channels.fetch(CHANNELS.archivesTicket);
      if (archive?.isTextBased()) {
        const embed = new EmbedBuilder()
          .setColor(BRAND_COLOR)
          .setTitle('📦 Ticket archivé')
          .setDescription(
            `**Salon :** #${channel.name}\n` +
              (info
                ? `**Ouvert par :** ${info.opener_tag}\n` +
                  `**Catégorie :** ${info.category_id}\n` +
                  `**Espace :** ${info.space}\n`
                : '') +
              `**Fermé par :** ${interaction.user.tag}`,
          )
          .setTimestamp();
        const file = new AttachmentBuilder(Buffer.from(transcript, 'utf8'), {
          name: `transcript-${channel.name}.txt`,
        });
        await (archive as TextChannel).send({ embeds: [embed], files: [file] });
      }
    } catch (err) {
      console.error('[ticket] archivage échoué:', err);
    }

    setTimeout(() => {
      channel.delete('Ticket fermé').catch(() => {});
    }, 5000);
  },
};

/** Construit une transcription texte des messages du ticket */
async function buildTranscript(channel: TextChannel): Promise<string> {
  const lines: string[] = [
    `Transcription du ticket #${channel.name}`,
    `Généré le ${new Date().toLocaleString('fr-FR')}`,
    '='.repeat(50),
  ];
  try {
    const messages = await channel.messages.fetch({ limit: 100 });
    const sorted = [...messages.values()].reverse();
    for (const m of sorted) {
      const time = new Date(m.createdTimestamp).toLocaleString('fr-FR');
      let content = m.content || '';
      if (m.embeds.length) content += ` [${m.embeds.length} embed(s)]`;
      if (m.attachments.size) {
        content +=
          ' ' + [...m.attachments.values()].map((a) => `[fichier: ${a.url}]`).join(' ');
      }
      lines.push(`[${time}] ${m.author.tag}: ${content}`);
    }
  } catch {
    lines.push('(impossible de récupérer les messages)');
  }
  return lines.join('\n');
}
