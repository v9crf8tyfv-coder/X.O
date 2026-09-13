import { REST, Routes } from 'discord.js';
import { ENV } from './env.js';
import { commands } from './commands/index.js';
import { STAFF_GUILD_ID } from '@xo/shared';

/**
 * Enregistre les commandes slash sur CHAQUE serveur (guild) — instantané.
 * Serveur communauté (DISCORD_GUILD_ID) + serveur staff (STAFF_GUILD_ID).
 * Lancer avec : npm run bot:deploy
 */
const body = commands.map((c) => c.data.toJSON());
const rest = new REST({ version: '10' }).setToken(ENV.DISCORD_TOKEN);
const guildIds = [...new Set([ENV.DISCORD_GUILD_ID, STAFF_GUILD_ID].filter(Boolean))];

let ok = true;
for (const guildId of guildIds) {
  try {
    console.log(`⏳ Déploiement de ${body.length} commandes sur ${guildId}…`);
    await rest.put(
      Routes.applicationGuildCommands(ENV.DISCORD_CLIENT_ID, guildId),
      { body },
    );
    console.log(`✅ Commandes déployées sur ${guildId}.`);
  } catch (err) {
    ok = false;
    console.error(`❌ Échec du déploiement des commandes sur ${guildId}:`, err);
  }
}
if (!ok) process.exit(1);
