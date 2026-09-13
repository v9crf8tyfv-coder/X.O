import { ActivityType, REST, Routes, type Client } from 'discord.js';
import { ENV } from '../env.js';
import { commands } from '../commands/index.js';
import { STAFF_GUILD_ID } from '@xo/shared';
import { refreshVoteChannel, catchUpMissedVotes } from '../lib/voteLog.js';

/**
 * Enregistre les slash commands (instantané) sur CHAQUE serveur où le bot doit
 * les avoir : le serveur communauté (DISCORD_GUILD_ID) + le serveur staff (STAFF_GUILD_ID).
 * On synchronise guilde par guilde pour qu'un échec sur l'une n'empêche pas l'autre.
 */
async function registerCommands(): Promise<void> {
  const body = commands.map((c) => c.data.toJSON());
  const rest = new REST({ version: '10' }).setToken(ENV.DISCORD_TOKEN);
  // dédoublonne au cas où les deux IDs seraient identiques
  const guildIds = [...new Set([ENV.DISCORD_GUILD_ID, STAFF_GUILD_ID].filter(Boolean))];
  for (const guildId of guildIds) {
    try {
      await rest.put(
        Routes.applicationGuildCommands(ENV.DISCORD_CLIENT_ID, guildId),
        { body },
      );
      console.log(`✅ ${body.length} commandes synchronisées sur ${guildId}.`);
    } catch (err) {
      console.error(`❌ Échec de la synchro des commandes sur ${guildId}:`, err);
    }
  }
}

/** Durée écoulée depuis le démarrage, format court FR (à l'instant / X min / X h / X j). */
function uptime(since: number): string {
  const min = Math.floor((Date.now() - since) / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const j = Math.floor(h / 24);
  return `${j} j`;
}

export function onReady(client: Client): void {
  console.log(`✅ X.O connecté en tant que ${client.user?.tag}`);

  // Salon de votes (pont de votes vers le classement du site) : chargé au démarrage
  // puis rafraîchi toutes les 5 min (négligeable, aucun impact sur l'abonnement).
  void refreshVoteChannel().then(() => catchUpMissedVotes(client)); // rattrape les votes ratés pendant une coupure
  setInterval(() => void refreshVoteChannel(), 300_000);

  // Statut personnalisé "En ligne depuis …", rafraîchi toutes les 60s.
  // Une MAJ de présence toutes les 60s est négligeable (aucun impact sur l'abonnement).
  // NB : un bot ne peut afficher un statut QUE lorsqu'il est en ligne — Discord le montre
  // en gris (hors ligne) sans texte quand il est coupé ; "hors ligne depuis" n'existe pas côté bot.
  const started = Date.now();
  const setStatus = () => {
    client.user?.setPresence({
      activities: [{ name: 'statut', type: ActivityType.Custom, state: `En ligne depuis ${uptime(started)}` }],
      status: 'online',
    });
  };
  setStatus();
  setInterval(setStatus, 60_000);

  void registerCommands();
}
