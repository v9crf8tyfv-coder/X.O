import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  type TextChannel,
} from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { GRADES } from '@xo/shared';
import { successEmbed } from '../../lib/embeds.js';
import { publishOrUpdatePanel } from '../../lib/panelMessage.js';

const STATUT_ROLE = '1540339127784968293';
const RESET_MONDE_ROLE = '1549077052089442365';
const RESEAUX_ROLE = '1549452397758124072';
const CHANGELOGS_ROLE = '1566042943574253658';

/** Poste un menu de rôles à cliquer (bouton = on prend/retire le rôle). */
export const setupRoles: SlashCommand = {
  minLevel: GRADES.responsable.level,
  data: new SlashCommandBuilder()
    .setName('setup-roles')
    .setDescription('Poster le menu de rôles (clic = prendre/retirer le rôle)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`rolebtn:${STATUT_ROLE}`)
        .setLabel('Statut')
        .setEmoji('🛠️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`rolebtn:${RESET_MONDE_ROLE}`)
        .setLabel('Reset Monde')
        .setEmoji('🌍')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`rolebtn:${RESEAUX_ROLE}`)
        .setLabel('Réseaux')
        .setEmoji('📢')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`rolebtn:${CHANGELOGS_ROLE}`)
        .setLabel('Changelogs')
        .setEmoji('📝')
        .setStyle(ButtonStyle.Secondary),
    );

    // Container Components V2 : les boutons sont DANS le cadre (comme NG), pas en dessous.
    const container = new ContainerBuilder()
      .setAccentColor(0x2b2d31)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(
        '**Choisis tes rôles**\n\n' +
          'Clique sur un bouton pour **prendre** ou **retirer** un rôle.\n\n' +
          '🛠️ **Statut** — Être notifié quand le serveur ouvre/ferme\n' +
          '🌍 **Reset Monde** — Être notifié quand la Mine / le Nether / l’End sont reset\n' +
          '📢 **Réseaux** — Être notifié des posts sur les réseaux sociaux\n' +
          '📝 **Changelogs** — Être notifié des mises à jour et nouveautés du serveur',
      ))
      .addActionRowComponents(row);
    await publishOrUpdatePanel(interaction.channel as TextChannel, 'panel_roles', { components: [container], flags: MessageFlags.IsComponentsV2 });
    await interaction.reply({
      embeds: [successEmbed('Menu de rôles à jour', 'Le menu de rôles a été mis à jour (ou posté). Les réactions/boutons sont conservés.')],
      flags: MessageFlags.Ephemeral,
    });
  },
};
