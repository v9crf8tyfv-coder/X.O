import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Client,
  type TextChannel,
} from 'discord.js';
import { db, hasDatabase } from '@xo/db';

// Salon + rôle fondateurs (rappel de renouvellement du serveur Bytenut)
const FONDA_CHANNEL_ID = '1535343470435115119';
const FONDA_ROLE_ID = '1535320390908387479';
const STATE_KEY = 'bytenut_timer';
export const RENEW_BUTTON_ID = 'bytenut:renew';

// Durée fixe ajoutée par un renouvellement Bytenut (utilisée après chaque clic).
export const RENEWAL_SEC = (2 * 60 + 50) * 60; // 2h50

let timer: NodeJS.Timeout | null = null;
let armedAt: number | null = null; // cible ms pour laquelle le timer mémoire est armé

interface TimerState {
  at: number | null; // cible ms du prochain ping (null = en attente du clic bouton)
  activeSec: number; // durée du timer en cours (libellé du ping)
  renewalSec: number; // durée relancée à chaque clic
}

/** Formate une durée en secondes -> « 1 heure 50 », « 2 heures », « 45 minutes ». */
export function fmtDuration(totalSec: number): string {
  const min = Math.round(totalSec / 60);
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h} heure${h > 1 ? 's' : ''} ${m}`;
  if (h) return `${h} heure${h > 1 ? 's' : ''}`;
  return `${m} minute${m > 1 ? 's' : ''}`;
}

function renewRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(RENEW_BUTTON_ID)
      .setLabel('Je l’ai fais')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success),
  );
}

async function firePing(client: Client, activeSec: number) {
  const channel = await client.channels.fetch(FONDA_CHANNEL_ID).catch(() => null);
  if (!channel?.isTextBased()) return;
  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle(`⚠️ ${fmtDuration(activeSec)} écoulé`)
    .setDescription(
      'Le serveur va expirer — **renouvelez-le maintenant** sur Bytenut !\n\n' +
        'Une fois fait, cliquez sur **« Je l’ai fais »** pour relancer le compte à rebours.',
    );
  await (channel as TextChannel).send({
    content: `<@&${FONDA_ROLE_ID}>`,
    embeds: [embed],
    components: [renewRow()],
    allowedMentions: { roles: [FONDA_ROLE_ID] },
  });
}

async function readState(): Promise<TimerState | null> {
  if (!hasDatabase()) return null;
  const rows = await db()<{ value: string }[]>`select value from bot_state where key = ${STATE_KEY}`;
  if (!rows.length) return null;
  try {
    return JSON.parse(rows[0]!.value) as TimerState;
  } catch {
    return null;
  }
}

async function persist(state: TimerState) {
  if (!hasDatabase()) return;
  await db()`
    insert into bot_state (key, value) values (${STATE_KEY}, ${JSON.stringify(state)})
    on conflict (key) do update set value = excluded.value
  `;
}

function disarm() {
  if (timer) clearTimeout(timer);
  timer = null;
  armedAt = null;
}

function arm(client: Client, state: TimerState) {
  disarm();
  if (state.at == null) return;
  armedAt = state.at;
  timer = setTimeout(
    () => {
      void firePing(client, state.activeSec);
      // On attend le clic : cible à null, on garde la durée de renouvellement.
      armedAt = null;
      timer = null;
      void persist({ ...state, at: null });
    },
    Math.max(0, state.at - Date.now()),
  );
}

/** Lance un timer de `activeSec`, avec `renewalSec` pour les relances. Renvoie la cible ms. */
export async function setServerTimer(
  client: Client,
  activeSec: number,
  renewalSec: number,
): Promise<number> {
  const state: TimerState = { at: Date.now() + activeSec * 1000, activeSec, renewalSec };
  arm(client, state);
  await persist(state);
  return state.at!;
}

/** Clic sur « Je l'ai fais » : relance avec la durée de renouvellement. Renvoie la cible, ou null. */
export async function restartServerTimer(client: Client): Promise<number | null> {
  const state = await readState();
  const renewalSec = state?.renewalSec ?? RENEWAL_SEC;
  return setServerTimer(client, renewalSec, renewalSec);
}

/** Reset complet : coupe le timer et efface l'état (test/erreur). */
export async function clearServerTimer(): Promise<void> {
  disarm();
  if (hasDatabase()) await db()`delete from bot_state where key = ${STATE_KEY}`;
}

/** Statut courant : { at, activeSec, renewalSec, remainingSec } ou null si aucun timer. */
export async function getServerTimer(): Promise<
  (TimerState & { remainingSec: number }) | null
> {
  const state = await readState();
  if (!state || state.at == null) return null;
  return { ...state, remainingSec: Math.max(0, Math.round((state.at - Date.now()) / 1000)) };
}

/**
 * Réconcilie le timer mémoire avec la base (appelé périodiquement par le worker).
 * Permet au SITE de couper/modifier le timer : le bot suit ce qu'il y a en base.
 */
export async function reconcileServerTimer(client: Client): Promise<void> {
  if (!hasDatabase()) return;
  const state = await readState();
  // Plus d'état, ou en attente du clic bouton → aucun timer ne doit tourner.
  if (!state || state.at == null) {
    if (armedAt !== null) disarm();
    return;
  }
  // Cible passée alors qu'on n'était pas armé (ex. reset raté) : on ping puis on attend.
  if (state.at - Date.now() <= 0) {
    if (armedAt !== state.at) {
      await firePing(client, state.activeSec);
      await persist({ ...state, at: null });
      disarm();
    }
    return;
  }
  // Cible future : (re)armer si ce n'est pas déjà fait pour cette cible.
  if (armedAt !== state.at) arm(client, state);
}

/** Au démarrage : reprend le timer stocké (survit à un restart du bot). */
export async function resumeServerTimer(client: Client): Promise<void> {
  await reconcileServerTimer(client);
}
