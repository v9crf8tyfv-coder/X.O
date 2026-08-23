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
import { onVoiceStateUpdate } from './events/voiceStateUpdate.js';
import { onAuditLog } from './events/auditLog.js';
import { startPendingActionsWorker } from './worker/pendingActions.js';
import { resumeServerTimer } from './lib/serverTimer.js';
import { startServerStatusWatcher } from './worker/serverStatusWatcher.js';
import { startPlaytimeTracker } from './worker/playtimeTracker.js';
import { startNewPlayerWatcher } from './worker/newPlayerWatcher.js';
import { startIgActionsWatcher } from './worker/igActionsWatcher.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // requis : surveillance des rôles, join
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildModeration, // bans
    GatewayIntentBits.MessageContent, // requis : mode annonce (lire les messages)
    GatewayIntentBits.GuildVoiceStates, // requis : salon vocal "Créer son Salon"
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
  startIgActionsWatcher(client);
});
client.on('interactionCreate', (i) => handleInteraction(client, i));
client.on('guildMemberAdd', (m) => onGuildMemberAdd(client, m));
client.on('guildMemberUpdate', (oldM, newM) => onGuildMemberUpdate(client, oldM, newM));
client.on('messageCreate', (m) => onMessageCreate(client, m));
client.on('voiceStateUpdate', (o, n) => onVoiceStateUpdate(client, o, n));
client.on('guildAuditLogEntryCreate', (entry, guild) => onAuditLog(client, entry, guild));

// Arrêt propre
process.on('SIGINT', () => client.destroy().then(() => process.exit(0)));
process.on('SIGTERM', () => client.destroy().then(() => process.exit(0)));

client.login(ENV.DISCORD_TOKEN);
