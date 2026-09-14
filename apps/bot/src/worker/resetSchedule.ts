import type { Client } from 'discord.js';
import { resetEmbed, postReset } from '../lib/resetAnnounce.js';

/** Date du dernier post (YYYY-MM-DD, Europe/Paris) — anti-doublon. */
let lastPosted = '';

function parisNow(): { wd: string; h: number; m: number; date: string } {
  const tz = 'Europe/Paris';
  const now = new Date();
  const wd = now.toLocaleDateString('en-US', { timeZone: tz, weekday: 'long' });
  const hm = now.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
  const date = now.toLocaleDateString('en-CA', { timeZone: tz });
  const [h, m] = hm.split(':').map((x) => parseInt(x, 10));
  return { wd, h: h ?? 0, m: m ?? 0, date };
}

/** Annonce automatique de reset : chaque JEUDI à 08h30 (Europe/Paris) dans le salon Annonce. */
export function startResetSchedule(client: Client): void {
  console.log('[reset] annonce hebdo programmée : jeudi 08h00 (Europe/Paris)');
  setInterval(() => {
    const { wd, h, m, date } = parisNow();
    if (wd === 'Thursday' && h === 8 && m === 0 && lastPosted !== date) {
      lastPosted = date;
      postReset(
        client,
        resetEmbed('Reset Semestriel, Nether et Mine !', "Le monde **Mine** et le **Nether** viennent d'être reset !"),
      'monde',
      ).catch((e) => console.error('[reset]', e));
    }
  }, 30_000);
}
