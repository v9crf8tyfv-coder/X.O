import { REST, Routes } from 'discord.js';
import { ENV } from './env.js';
import { commands } from './commands/index.js';

/**
 * Enregistre les commandes slash sur le serveur (guild) — instantané.
 * Lancer avec : npm run bot:deploy
 */
const body = commands.map((c) => c.data.toJSON());
const rest = new REST({ version: '10' }).setToken(ENV.DISCORD_TOKEN);

try {
  console.log(`⏳ Déploiement de ${body.length} commandes…`);
  await rest.put(
    Routes.applicationGuildCommands(ENV.DISCORD_CLIENT_ID, ENV.DISCORD_GUILD_ID),
    { body },
  );
  console.log('✅ Commandes déployées sur le serveur.');
} catch (err) {
  console.error('❌ Échec du déploiement des commandes:', err);
  process.exit(1);
}
