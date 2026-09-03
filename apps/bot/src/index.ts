import { Client, GatewayIntentBits, Collection, Partials, Options } from 'discord.js';
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
// Redémarrage auto désactivé : il faisait process.exit(0) à 00h/12h et l'hébergeur
// ne relançait pas toujours le process → bot mort. Un bot discord.js n'a pas besoin
// de restart quotidien. (Fichier worker/autoRestart.ts conservé mais plus appelé.)
// import { startAutoRestart } from './worker/autoRestart.js';
import { startWatchdog } from './worker/watchdog.js';
import { startVoteBoardWorker } from './worker/voteBoardWorker.js';
import { startAutoMessages } from './worker/autoMessages.js';
import { startCandidatureWatcher } from './worker/candidatureWatcher.js';
import { logToDiscord, fmtError } from './lib/logWebhook.js';
import { acquireLock, startHeartbeat } from './lib/singleton.js';

// Log tout de suite : on saura que le process a bien démarré (avant login).
void logToDiscord(`🟡 Démarrage du bot… (${new Date().toISOString()})`);

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
  // Allège la mémoire : on ne garde quasi rien en cache (évite la saturation).
  makeCache: Options.cacheWithLimits({
    ...Options.DefaultMakeCacheSettings,
    MessageManager: 10, // très peu de messages en cache
    PresenceManager: 0,
    ReactionManager: 0,
    ReactionUserManager: 0,
    GuildBanManager: 0,
    ThreadManager: 0,
    // Caches jamais utilisés par le bot → 0 (gain de RAM, aucun impact fonctionnel)
    GuildStickerManager: 0,
    GuildScheduledEventManager: 0,
    StageInstanceManager: 0,
    AutoModerationRuleManager: 0,
  }),
  sweepers: {
    ...Options.DefaultSweeperSettings,
    messages: { interval: 300, lifetime: 300 }, // vire les messages en cache > 5 min
  },
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
  void logToDiscord(`🟢 Bot **connecté** et prêt : ${client.user?.tag ?? '?'} (${new Date().toISOString()})`);
  onReady(client);
  startPendingActionsWorker(client);
  void resumeServerTimer(client);
  startServerStatusWatcher(client);
  startPlaytimeTracker();
  startNewPlayerWatcher(client);
  startIgActionsWatcher(client);
  // startAutoRestart(); // désactivé : provoquait la mort du bot à 00h/12h (voir import ci-dessus)
  startWatchdog(client); // détecte une gateway zombie (bot en ligne mais muet) → relance
  startVoteBoardWorker(client); // rafraîchit l'embed du classement des votes (/setup-vote)
  startAutoMessages(client); // messages automatiques configurés dans le panel
  startCandidatureWatcher(client); // candidatures du forum → embed Discord + bouton "Traité"
});

// Le bot s'est déconnecté du gateway (coupure réseau / kill hébergeur)
client.on('shardDisconnect', (event) =>
  void logToDiscord(`🟠 Déconnexion du gateway (code ${event.code}) — ${new Date().toISOString()}`));
client.on('error', (err) => void logToDiscord(fmtError('client.error', err)));
client.on('interactionCreate', (i) => handleInteraction(client, i));
client.on('guildMemberAdd', (m) => onGuildMemberAdd(client, m));
client.on('guildMemberUpdate', (oldM, newM) => onGuildMemberUpdate(client, oldM, newM));
client.on('messageCreate', (m) => onMessageCreate(client, m));
client.on('voiceStateUpdate', (o, n) => onVoiceStateUpdate(client, o, n));
client.on('guildAuditLogEntryCreate', (entry, guild) => onAuditLog(client, entry, guild));

// Anti-crash : une erreur non gérée est loguée (console + Discord) mais NE tue PAS le bot.
process.on('unhandledRejection', (err) => {
  console.error('[unhandledRejection]', err);
  void logToDiscord(fmtError('unhandledRejection', err));
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
  void logToDiscord(fmtError('uncaughtException', err));
});

// Arrêt propre
process.on('SIGINT', () => client.destroy().then(() => process.exit(0)));
process.on('SIGTERM', () => client.destroy().then(() => process.exit(0)));

// Verrou instance unique PUIS connexion. Si une autre instance tourne déjà, on s'arrête
// AVANT de toucher au gateway (sinon les deux se battent = commandes mortes + doublons).
(async () => {
  const alone = await acquireLock();
  if (!alone) {
    console.log('[singleton] une autre instance du bot tourne déjà → arrêt de ce process.');
    void logToDiscord('🟠 Instance en double détectée → arrêt (une seule instance doit tourner).');
    setTimeout(() => process.exit(0), 1000);
    return;
  }
  startHeartbeat();
  client.login(ENV.DISCORD_TOKEN).catch((err) => {
    console.error('[login] échec de connexion:', err);
    void logToDiscord(fmtError('Échec de connexion (login)', err));
  });
})();
