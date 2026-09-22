import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type GuildMember,
} from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { GRADES, getGrade } from '@xo/shared';
import { db, hasDatabase } from '@xo/db';
import { successEmbed, errorEmbed } from '../../lib/embeds.js';
import { highestGrade } from '../../lib/permissions.js';
import { ensureTrackTable } from '../../worker/trackWatcher.js';

/** Niveau de grade d'un pseudo IG d'après sa carte staff (0 = pas staff / joueur normal). */
async function targetLevel(pseudo: string): Promise<number> {
  if (!hasDatabase()) return 0;
  const rows = await db()<{ grades: string[] }[]>`
    select grades from staff where lower(pseudo) = lower(${pseudo}) and active = true limit 1
  `.catch(() => [] as { grades: string[] }[]);
  let lvl = 0;
  for (const g of rows[0]?.grades ?? []) lvl = Math.max(lvl, getGrade(g).level);
  return lvl;
}

/**
 * /track <pseudo> <on|off>
 * Poste un embed dans CE salon à chaque connexion/déconnexion du pseudo (sauf en off).
 *
 * Règle de cible :
 *  - Fondateur / Co-fondateur : peuvent tout surveiller.
 *  - Sinon (admin, resp…) : uniquement des cibles STRICTEMENT en dessous de son grade
 *    (donc pas ses collègues de même grade ni au-dessus). Un joueur normal = niveau 0.
 */
export const track: SlashCommand = {
  minLevel: GRADES.admin.level,
  data: new SlashCommandBuilder()
    .setName('track')
    .setDescription("Surveille les connexions/déconnexions d'un joueur dans ce salon")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((o) =>
      o.setName('pseudo').setDescription('Pseudo Minecraft (IG)').setRequired(true),
    )
    .addStringOption((o) =>
      o
        .setName('etat')
        .setDescription('Activer (on) ou désactiver (off) la surveillance')
        .setRequired(true)
        .addChoices({ name: 'on', value: 'on' }, { name: 'off', value: 'off' }),
    ),
  async execute(interaction) {
    if (!hasDatabase()) {
      await interaction.reply({
        embeds: [errorEmbed('Indisponible', 'Base de données non configurée.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const pseudo = interaction.options.getString('pseudo', true).trim();
    const enabled = interaction.options.getString('etat', true) === 'on';

    const member = interaction.member as GuildMember | null;
    const myLevel = (member ? highestGrade(member) : null)?.level ?? 0;
    const isFoundersTier = myLevel >= GRADES.cofondateur.level; // fonda + cofonda -> tout

    if (!isFoundersTier) {
      const tLvl = await targetLevel(pseudo);
      if (tLvl >= myLevel) {
        await interaction.reply({
          embeds: [
            errorEmbed(
              'Non autorisé',
              `Tu ne peux pas surveiller **${pseudo}** : son grade est égal ou supérieur au tien.`,
            ),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    await ensureTrackTable().catch(() => {});
    await db()`
      insert into tracked_players (pseudo, channel_id, guild_id, enabled)
      values (${pseudo}, ${interaction.channelId}, ${interaction.guildId}, ${enabled})
      on conflict (pseudo, channel_id)
        do update set enabled = ${enabled}, guild_id = ${interaction.guildId}
    `;

    await interaction.reply({
      embeds: [
        enabled
          ? successEmbed(
              '👁️ Surveillance activée',
              `Les connexions/déconnexions de **${pseudo}** seront postées ici.`,
            )
          : successEmbed(
              'Surveillance désactivée',
              `**${pseudo}** n'est plus surveillé dans ce salon.`,
            ),
      ],
    });
  },
};
