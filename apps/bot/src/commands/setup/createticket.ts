import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder,
  ChannelType,
  type GuildMember,
  type OverwriteResolvable,
  type Guild,
} from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { GRADES, ALL_GRADES, STAFF_GUILD_ROLE_IDS, BRAND_COLOR, CHANNELS } from '@xo/shared';
import { db, hasDatabase } from '@xo/db';
import { errorEmbed, successEmbed } from '../../lib/embeds.js';
import { highestGrade } from '../../lib/permissions.js';
import { buildCloseButton } from '../../lib/tickets.js';

/**
 * Permissions d'un ticket "escalade" : @everyone bloqué, l'ouvreur + TOUS les grades
 * dont le niveau est >= celui de l'ouvreur (donc son grade et au-dessus).
 * Un fondateur n'a personne d'autre -> il pourra /add des gens manuellement.
 */
function escalationOverwrites(guild: Guild, openerId: string, minLevel: number): OverwriteResolvable[] {
  const allow =
    PermissionFlagsBits.ViewChannel |
    PermissionFlagsBits.SendMessages |
    PermissionFlagsBits.ReadMessageHistory;
  const ows: OverwriteResolvable[] = [
    { id: guild.roles.everyone.id, deny: PermissionFlagsBits.ViewChannel },
    { id: guild.client.user.id, allow: allow | PermissionFlagsBits.ManageChannels },
    { id: openerId, allow },
  ];
  const seen = new Set<string>();
  for (const g of Object.values(ALL_GRADES)) {
    if (g.level < minLevel) continue;
    for (const roleId of [g.roleId, STAFF_GUILD_ROLE_IDS[g.key]]) {
      if (roleId && !seen.has(roleId) && guild.roles.cache.has(roleId)) {
        seen.add(roleId);
        ows.push({ id: roleId, allow });
      }
    }
  }
  return ows;
}

/**
 * /createticket — crée un ticket d'escalade staff visible par ton grade et TOUS les grades
 * au-dessus. Se ferme/archive via le bouton "Fermer" ou /removeticket, et on peut y ajouter/
 * retirer des membres via /add et /remove.
 */
export const createTicket: SlashCommand = {
  minLevel: GRADES.admin.level,
  data: new SlashCommandBuilder()
    .setName('createticket')
    .setDescription('Crée un ticket staff visible par ton grade et les grades au-dessus')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption((o) =>
      o.setName('sujet').setDescription('Sujet du ticket (optionnel)').setRequired(false),
    ),
  async execute(interaction) {
    const guild = interaction.guild;
    const member = interaction.member as GuildMember | null;
    if (!guild || !member) {
      await interaction.reply({
        embeds: [errorEmbed('Erreur', 'À faire sur le serveur.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const myGrade = highestGrade(member);
    const myLevel = myGrade?.level ?? 0;
    const subject = interaction.options.getString('sujet') ?? null;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const parentId =
        guild.channels.cache.get(CHANNELS.ticketStaff)?.parentId ??
        (await guild.channels.fetch(CHANNELS.ticketStaff).catch(() => null))?.parentId ??
        undefined;

      const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
      const channel = await guild.channels.create({
        name: `escalade-${safeName || interaction.user.id.slice(-4)}`,
        type: ChannelType.GuildText,
        parent: parentId ?? undefined,
        permissionOverwrites: escalationOverwrites(guild, interaction.user.id, myLevel),
      });

      const header = new EmbedBuilder()
        .setColor(BRAND_COLOR)
        .setTitle('🎫 Ticket escalade')
        .setDescription(
          `👤 **Ouvert par :** ${interaction.user.tag} (${myGrade?.label ?? 'Staff'})\n` +
            `🔒 **Accès :** ${myGrade?.label ?? 'ton grade'} et au-dessus\n` +
            (subject ? `📌 **Sujet :** ${subject}\n` : '') +
            '\nUtilise le bouton ci-dessous ou `/removeticket` pour fermer. `/add` et `/remove` pour gérer les accès.',
        );
      const msg = await channel.send({
        content: `<@${interaction.user.id}>`,
        embeds: [header],
        components: [buildCloseButton()],
      });
      await msg.pin().catch(() => {});

      if (hasDatabase()) {
        await db()`
          insert into tickets (channel_id, category_id, space, opener_id, opener_tag, status)
          values (${channel.id}, 'escalade', 'staff', ${interaction.user.id}, ${interaction.user.tag}, 'open')
        `.catch((e) => console.error('[createticket] insert échoué:', e));
      }

      await interaction.editReply({
        embeds: [successEmbed('Ticket créé', `Ton ticket escalade : <#${channel.id}>`)],
      });
    } catch (err) {
      console.error('[createticket] échec:', err);
      await interaction
        .editReply({
          embeds: [
            errorEmbed(
              'Impossible de créer le ticket',
              'Vérifie les droits du bot (Gérer les salons) ou la limite de salons.',
            ),
          ],
        })
        .catch(() => {});
    }
  },
};
