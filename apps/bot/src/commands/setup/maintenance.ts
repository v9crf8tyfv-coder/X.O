import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { status } from 'minecraft-server-util';
import type { SlashCommand } from '../../types.js';
import { GRADES } from '@xo/shared';
import { db, hasDatabase } from '@xo/db';
import { successEmbed, errorEmbed } from '../../lib/embeds.js';
import { postStatus } from '../../lib/serverStatus.js';
import { queueConsole } from '../../lib/igConsole.js';

const HOST = 'emeriamc.mine.gg';
const PORT = 10006;

/** Ping réel du serveur (pour restaurer le bon statut à la sortie de maintenance). */
async function serverOnline(): Promise<boolean> {
  for (let i = 0; i < 3; i++) {
    try {
      await status(HOST, PORT, { timeout: 4000, enableSRV: true });
      return true;
    } catch {
      /* on réessaie */
    }
  }
  return false;
}

async function setState(key: string, value: string): Promise<void> {
  if (!hasDatabase()) return;
  await db()`
    insert into bot_state (key, value) values (${key}, ${value})
    on conflict (key) do update set value = excluded.value
  `;
}

/**
 * /maintenance on|off — mode maintenance MANUEL (à partir du grade Responsable).
 *  ON  : pose le drapeau maintenance -> le site affiche une bulle orange "Maintenance en cours",
 *        active la whitelist en jeu, poste l'image/texte orange dans le salon statut, et gèle
 *        l'auto-statut (le watcher ne réécrase plus tant que c'est ON).
 *  OFF : retire le drapeau, désactive la whitelist, et restaure le vrai statut (OPEN/CLOSE
 *        selon le ping réel) sur le site et dans le salon statut.
 */
export const maintenance: SlashCommand = {
  minLevel: GRADES.responsable.level,
  data: new SlashCommandBuilder()
    .setName('maintenance')
    .setDescription('Activer / désactiver le mode maintenance (site + whitelist + salon statut)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((o) =>
      o
        .setName('etat')
        .setDescription('Activer ou désactiver la maintenance')
        .setRequired(true)
        .addChoices({ name: 'ON', value: 'on' }, { name: 'OFF', value: 'off' }),
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!hasDatabase()) {
      await interaction.editReply({
        embeds: [errorEmbed('Base requise', 'La maintenance a besoin de la base de données.')],
      });
      return;
    }
    const on = interaction.options.getString('etat', true) === 'on';
    const actor = interaction.user.username;

    if (on) {
      // 1) Drapeau partagé lu par le site (bulle orange) et par le watcher (gel de l'auto-statut).
      await setState('maintenance', '1');
      // 2) Whitelist en jeu : seuls les whitelistés (staff) peuvent rejoindre.
      await queueConsole('whitelist on', actor);
      await queueConsole('whitelist reload', actor);
      // 3) Salon statut : image + texte orange.
      await postStatus(interaction.client, 'maintenance');
      await interaction.editReply({
        embeds: [
          successEmbed(
            'Maintenance activée',
            'Site en **orange « Maintenance en cours »**, **whitelist activée** en jeu, salon statut mis à jour.\nL\'auto-statut est gelé jusqu\'à `/maintenance off`.',
          ),
        ],
      });
      return;
    }

    // OFF : on lève le drapeau AVANT de restaurer (sinon le site resterait orange).
    await setState('maintenance', '0');
    await queueConsole('whitelist off', actor);
    // Restaure le vrai statut selon le ping réel du serveur.
    const online = await serverOnline();
    await setState('server_online', online ? '1' : '0');
    await postStatus(interaction.client, online ? 'open' : 'close');
    await interaction.editReply({
      embeds: [
        successEmbed(
          'Maintenance désactivée',
          `Whitelist **désactivée**, statut restauré : serveur **${online ? 'OPEN' : 'CLOSE'}**. Le site est revenu à la normale.`,
        ),
      ],
    });
  },
};
