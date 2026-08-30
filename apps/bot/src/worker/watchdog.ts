import { type Client, Status } from 'discord.js';
import { logToDiscord } from '../lib/logWebhook.js';

/**
 * Watchdog "gateway" : détecte un bot EN LIGNE mais MUET (connexion WebSocket zombie
 * qui ne reçoit plus les événements Discord → les commandes ne répondent plus).
 *
 * Si la gateway reste hors READY plus de STALE_MS, on quitte avec un code NON-ZÉRO :
 * l'hébergeur (AUTORESTART) traite ça comme un crash et relance le process — contrairement
 * à un exit 0 qui était vu comme un arrêt propre (l'ancien bug du restart auto).
 */
const STALE_MS = 5 * 60_000; // 5 min sans READY = on redémarre
const GRACE_MS = 2 * 60_000; // grâce au démarrage (le temps de se connecter)
const CHECK_MS = 30_000;

export function startWatchdog(client: Client): void {
  const started = Date.now();
  let lastReady = Date.now();

  const markReady = () => {
    lastReady = Date.now();
  };
  client.on('shardReady', markReady);
  client.on('shardResume', markReady);

  setInterval(() => {
    if (Date.now() - started < GRACE_MS) return; // pas pendant la connexion initiale
    if (client.ws.status === Status.Ready) {
      lastReady = Date.now();
      return;
    }
    if (Date.now() - lastReady > STALE_MS) {
      const mins = Math.round((Date.now() - lastReady) / 60_000);
      console.error(`[watchdog] Gateway bloquée depuis ${mins} min (statut ${client.ws.status}) → redémarrage`);
      void logToDiscord(`🔴 Watchdog : gateway bloquée depuis ${mins} min → redémarrage du bot.`);
      // Laisse une seconde au log de partir, puis exit NON-zéro (= crash = relance par l'hébergeur).
      setTimeout(() => process.exit(1), 1000);
    }
  }, CHECK_MS);

  console.log('[watchdog] surveillance de la gateway activée');
}
