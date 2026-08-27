import { ENV } from '../env.js';

/**
 * Envoie un message dans le salon Discord via un webhook (LOG_WEBHOOK_URL).
 * Passe par HTTPS direct : marche MÊME si le bot n'est pas connecté au gateway
 * (utile pour diagnostiquer un bot qui ne démarre pas / plante).
 * Ne throw jamais : en cas de souci on retombe sur la console.
 */
export async function logToDiscord(content: string): Promise<void> {
  const url = ENV.LOG_WEBHOOK_URL;
  if (!url) return; // pas configuré → silencieux (la console reste)
  // Discord limite à 2000 caractères par message.
  const body = content.length > 1900 ? content.slice(0, 1900) + '…(coupé)' : content;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'X.O — Logs',
        content: body,
        allowed_mentions: { parse: [] }, // n'notifie personne
      }),
    });
  } catch (e) {
    console.error('[logWebhook] échec envoi log:', e);
  }
}

/** Formatte une erreur (message + stack) proprement pour Discord. */
export function fmtError(tag: string, err: unknown): string {
  const e = err as { message?: string; stack?: string };
  const msg = e?.stack || e?.message || String(err);
  const time = new Date().toISOString();
  return `🔴 **${tag}** — ${time}\n\`\`\`\n${msg}\n\`\`\``;
}
