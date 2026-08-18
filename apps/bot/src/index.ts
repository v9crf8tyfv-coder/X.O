import { Client, GatewayIntentBits, Collection, Partials } from 'discord.js';
import { ENV } from './env.js';
import type { XOClient } from './types.js';
import { commands } from './commands/index.js';
import { buttons, selectMenus, roleSelects, modals } from './interactions/index.js';
import { handleInteraction } from './events/interactionCreate.js';
import { onReady } from './events/ready.js';
import { onGuildMemberAdd } from './events/guildMemberAdd.js';
import { onGuildMemberUpdate } from './events/guildMemberUpdate.js';
import { onMessageCreate } from './events/messageCreate.js';
import { startPendingActionsWorker } from './worker/pendingActions.js';
import { resumeServerTimer } from './lib/serverTimer.js';
import { startServerStatusWatcher } from './worker/serverStatusWatcher.js';
import { startPlaytimeTracker } from './worker/playtimeTracker.js';
import { startNewPlayerWatcher } from './worker/newPlayerWatcher.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // requis : surveillance des rôles, join
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildModeration, // bans
    GatewayIntentBits.MessageContent, // requis : mode annonce (lire les messages)
  ],
  partials: [Partials.GuildMember],
}) as XOClient;

// Collections
client.commands = new Collection();
for (const cmd of commands) client.commands.set(cmd.data.name, cmd);
client.buttons = buttons;
client.selectMenus = selectMenus;
client.roleSelects = roleSelects;
client.modals = modals;

// Événements
client.once('clientReady', () => {
  onReady(client);
  startPendingActionsWorker(client);
  void resumeServerTimer(client);
  startServerStatusWatcher(client);
  startPlaytimeTracker();
  startNewPlayerWatcher(client);
});
client.on('interactionCreate', (i) => handleInteraction(client, i));
client.on('guildMemberAdd', (m) => onGuildMemberAdd(client, m));
client.on('guildMemberUpdate', (oldM, newM) => onGuildMemberUpdate(client, oldM, newM));
client.on('messageCreate', (m) => onMessageCreate(client, m));

// Arrêt propre
process.on('SIGINT', () => client.destroy().then(() => process.exit(0)));
process.on('SIGTERM', () => client.destroy().then(() => process.exit(0)));

client.login(ENV.DISCORD_TOKEN);
