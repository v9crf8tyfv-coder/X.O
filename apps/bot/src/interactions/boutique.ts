import {
  ChannelType,
  MessageFlags,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type GuildMember,
  type TextChannel,
  type OverwriteResolvable,
} from 'discord.js';
import type { ComponentHandler } from '../types.js';
import { db, hasDatabase } from '@xo/db';
import { GRADES, BRAND_COLOR } from '@xo/shared';
import { successEmbed, errorEmbed } from '../lib/embeds.js';

const BOUTIQUE_CHANNEL = '1538507381825077299';
const LOGS_CHANNEL = '1542266023590502582';
const FONDATEUR = GRADES.fondateur.roleId;
const COFONDATEUR = GRADES.cofondateur.roleId;

const CONDITIONS =
  "***Conditions d'achat !***\n" +
  '**`Une fois accepté, vous vous engagez à respecter ces règles.`**\n\n' +
  '**1. __*Une fois que vous procédez au paiement, voici des explications / règles importantes à suivre.*__**\n' +
  "1.1 :__ Le grade sera rajouté une fois l'argent reçu par nous, nous vous conseillons donc un virement instantané__.\n\n" +
  '1.2 :__Dans la communication de votre virement, rien ne doit y être marqué, ou Don pour Emeria, si ce point n\'est pas respecté,__\n' +
  '       __un remboursement sera effectué ainsi qu\'un retrait du grade.__';

function isFounder(member: GuildMember | null): boolean {
  if (!member) return false;
  return (
    (!!FONDATEUR && member.roles.cache.has(FONDATEUR)) ||
    (!!COFONDATEUR && member.roles.cache.has(COFONDATEUR))
  );
}

/** Poste (ou reposte) l'embed Boutique avec le bouton "Entrer mon code". */
export async function postBoutiquePanel(channel: TextChannel): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle('🛒 Boutique EmeriaMC')
    .setDescription(
      "Tu as passé une commande sur le site ? Clique sur **Entrer mon code**, colle ton code de panier, " +
        'et un ticket privé s\'ouvrira avec les fondateurs pour finaliser.',
    );
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('shop:entercode').setLabel('Entrer mon code').setStyle(ButtonStyle.Primary).setEmoji('🎟️'),
  );
  await channel.send({ embeds: [embed], components: [row] });
}

/** Bouton "Entrer mon code" -> ouvre un modal. */
export const shopEnterCode: ComponentHandler<ButtonInteraction> = {
  prefix: 'shop:entercode',
  async execute(interaction) {
    const modal = new ModalBuilder().setCustomId('shop:code').setTitle('Code de panier');
    const input = new TextInputBuilder()
      .setCustomId('code')
      .setLabel('Colle ton code (ex : EMERIA-XXXX)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(40);
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    await interaction.showModal(modal);
  },
};

/** Modal soumis -> valide le code, crée le ticket privé + conditions. */
export const shopCodeModal: ComponentHandler<ModalSubmitInteraction> = {
  prefix: 'shop:code',
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const code = interaction.fields.getTextInputValue('code').trim().toUpperCase();
    const guild = interaction.guild;
    if (!guild) return;
    if (!hasDatabase()) {
      await interaction.editReply({ embeds: [errorEmbed('Indisponible', 'Base non configurée.')] });
      return;
    }

    // Valide le code (doit exister et être "pending")
    const rows = await db()<
      { code: string; pseudo: string; items: unknown; total: number; status: string }[]
    >`select code, pseudo, items, total, status from shop_orders where code = ${code}`;
    const order = rows[0];
    if (!order) {
      await interaction.editReply({ embeds: [errorEmbed('Code invalide', 'Ce code n\'existe pas. Vérifie sur le site.')] });
      return;
    }
    if (order.status !== 'pending') {
      await interaction.editReply({ embeds: [errorEmbed('Code déjà utilisé', 'Ce code a déjà servi à ouvrir un ticket.')] });
      return;
    }

    // Crée le salon privé : acheteur (lecture seule au début) + fondateurs
    const safe = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 18);
    const parentId = (interaction.channel as TextChannel | null)?.parentId ?? undefined;
    const overwrites: OverwriteResolvable[] = [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] },
    ];
    if (FONDATEUR) overwrites.push({ id: FONDATEUR, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
    if (COFONDATEUR) overwrites.push({ id: COFONDATEUR, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });

    const ch = await guild.channels.create({
      name: `boutique-${safe || interaction.user.id.slice(-4)}`,
      type: ChannelType.GuildText,
      parent: parentId,
      permissionOverwrites: overwrites,
    });

    // Récap de la commande
    const items = Array.isArray(order.items) ? (order.items as { name: string; qty: number }[]) : [];
    const recap = items.length ? items.map((it) => `• ${it.name} × ${it.qty}`).join('\n') : '—';

    // colonne ajoutée à la volée si absente (la table est créée par le site)
    await db()`alter table shop_orders add column if not exists ticket_channel text`.catch(() => {});
    await db()`update shop_orders set status = 'ticket', ticket_channel = ${ch.id} where code = ${code}`.catch(() => {});

    const recapEmbed = new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle('🧾 Récapitulatif de ta commande')
      .setDescription(recap)
      .addFields({ name: 'Compte Minecraft', value: order.pseudo, inline: true }, { name: 'Code', value: '`' + code + '`', inline: true });

    const acceptRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('shop:accept:' + interaction.user.id).setLabel('Accepter les conditions').setStyle(ButtonStyle.Success).setEmoji('✅'),
    );

    await ch.send({ content: `<@${interaction.user.id}>`, embeds: [recapEmbed] });
    await ch.send({ content: CONDITIONS, components: [acceptRow] });

    await interaction.editReply({ embeds: [successEmbed('Ticket ouvert', `Ton ticket : <#${ch.id}>`)] });
  },
};

/** Bouton "Accepter les conditions" -> débloque l'écriture + bouton fermer (fondateurs). */
export const shopAccept: ComponentHandler<ButtonInteraction> = {
  prefix: 'shop:accept',
  async execute(interaction) {
    const buyerId = interaction.customId.split(':')[2];
    if (interaction.user.id !== buyerId) {
      await interaction.reply({ embeds: [errorEmbed('Non', 'Seul l\'acheteur peut accepter.')], flags: MessageFlags.Ephemeral });
      return;
    }
    const channel = interaction.channel as TextChannel | null;
    if (!channel) return;

    // Débloque l'écriture pour l'acheteur
    await channel.permissionOverwrites.edit(buyerId, { SendMessages: true }).catch(() => {});
    if (hasDatabase()) {
      await db()`update shop_orders set status = 'accepted' where ticket_channel = ${channel.id}`.catch(() => {});
    }

    // Retire le bouton accepter (édite le message)
    await interaction.update({ components: [] }).catch(() => {});

    const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('shop:close').setLabel('Fermer le ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
    );
    await channel.send({
      embeds: [successEmbed('Conditions acceptées ✅', `<@${buyerId}> a accepté les conditions. Vous pouvez maintenant discuter en privé.`)],
      components: [closeRow],
    });
  },
};

/** Bouton "Fermer le ticket" -> fondateurs uniquement -> log + suppression. */
export const shopClose: ComponentHandler<ButtonInteraction> = {
  prefix: 'shop:close',
  async execute(interaction) {
    if (!isFounder(interaction.member as GuildMember | null)) {
      await interaction.reply({ embeds: [errorEmbed('Réservé', 'Seuls les fondateurs peuvent fermer ce ticket.')], flags: MessageFlags.Ephemeral });
      return;
    }
    const channel = interaction.channel as TextChannel | null;
    if (!channel) return;
    await interaction.reply({ embeds: [successEmbed('Fermeture…', 'Le ticket sera supprimé dans quelques secondes.')] });

    let order: { code: string; pseudo: string; status: string } | null = null;
    if (hasDatabase()) {
      const rows = await db()<{ code: string; pseudo: string; status: string }[]>`
        select code, pseudo, status from shop_orders where ticket_channel = ${channel.id}
      `.catch(() => [] as { code: string; pseudo: string; status: string }[]);
      order = rows[0] ?? null;
      await db()`update shop_orders set status = 'closed' where ticket_channel = ${channel.id}`.catch(() => {});
    }

    try {
      const logs = await interaction.client.channels.fetch(LOGS_CHANNEL);
      if (logs?.isTextBased()) {
        const embed = new EmbedBuilder()
          .setColor(BRAND_COLOR)
          .setTitle('🧾 Commande boutique — ticket fermé')
          .setDescription(
            (order
              ? `**Compte MC :** ${order.pseudo}\n**Code :** \`${order.code}\`\n**Conditions :** acceptées ✅\n`
              : '') + `**Fermé par :** ${interaction.user.tag}`,
          )
          .setTimestamp();
        await (logs as TextChannel).send({ embeds: [embed] });
      }
    } catch (err) {
      console.error('[boutique] log échoué:', err);
    }

    setTimeout(() => channel.delete('Ticket boutique fermé').catch(() => {}), 5000);
  },
};
