import { ActivityType, REST, Routes, type Client } from 'discord.js';
import { ENV } from '../env.js';
import { commands } from '../commands/index.js';

/** Enregistre les slash commands sur la guilde (instantané) à chaque démarrage. */
async function registerCommands(): Promise<void> {
  try {
    const body = commands.map((c) => c.data.toJSON());
    const rest = new REST({ version: '10' }).setToken(ENV.DISCORD_TOKEN);
    await rest.put(
      Routes.applicationGuildCommands(ENV.DISCORD_CLIENT_ID, ENV.DISCORD_GUILD_ID),
      { body },
    );
    console.log(`✅ ${body.length} commandes synchronisées sur le serveur.`);
  } catch (err) {
    console.error('❌ Échec de la synchro des commandes:', err);
  }
}

export function onReady(client: Client): void {
  console.log(`✅ X.O connecté en tant que ${client.user?.tag}`);
  client.user?.setActivity('le staff 👀', { type: ActivityType.Watching });
  void registerCommands();
}
