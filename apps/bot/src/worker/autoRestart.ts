/**
 * Redémarrage automatique du bot à 00h00 et 12h00 (heure de Paris).
 * Le bot s'ARRÊTE (exit 0) à ces heures ; c'est l'hébergeur qui le relance.
 * ⚠️ Nécessite que ton hébergeur relance le process quand il s'arrête
 *    (option "auto-restart" activée). Sinon, utilise le planificateur du panel.
 */
const STARTED = Date.now();
const GUARD_MS = 5 * 60_000; // pas de restart dans les 5 premières minutes (évite toute boucle)

/** Heure/minute actuelles à Paris. */
function parisHM(): { h: number; m: number } {
  const s = new Date().toLocaleTimeString('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const [h, m] = s.split(':').map((x) => parseInt(x, 10));
  return { h: h ?? 0, m: m ?? 0 };
}

export function startAutoRestart(): void {
  console.log('[auto-restart] programmé à 00h et 12h (Europe/Paris)');
  setInterval(() => {
    if (Date.now() - STARTED < GUARD_MS) return; // évite un redémarrage en boucle juste après un restart
    const { h, m } = parisHM();
    if (m === 0 && (h === 0 || h === 12)) {
      console.log(`[auto-restart] redémarrage programmé (${h}h00 Paris)`);
      process.exit(0);
    }
  }, 60_000);
}
