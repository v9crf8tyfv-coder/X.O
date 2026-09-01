import type { Message } from 'discord.js';
import { db, hasDatabase } from '@xo/db';

/**
 * Pont de votes : les sites de vote (serveurly, serveur-minecraft-vote, …) postent
 * « X a voté » via un webhook Discord dans un salon dédié. Le bot lit ce salon et
 * enregistre chaque vote dans la table `site_votes` (celle que lit le classement du site).
 *
 * Aucune intent ni coût en plus : le bot lit déjà les messages. Dormant tant qu'aucun
 * salon n'est configuré (rien n'est cassé).
 */

let channelId: string | null = process.env.VOTE_LOG_CHANNEL_ID || null;

export function voteChannelId(): string | null {
  return channelId;
}

/** Recharge l'ID du salon de votes depuis app_config (ou l'env, prioritaire). */
export async function refreshVoteChannel(): Promise<void> {
  if (process.env.VOTE_LOG_CHANNEL_ID) {
    channelId = process.env.VOTE_LOG_CHANNEL_ID;
    return;
  }
  if (!hasDatabase()) return;
  try {
    const r = await db()`select v from app_config where k = 'vote_log_channel' limit 1`;
    const row = r[0] as { v: string } | undefined;
    channelId = row ? String(row.v) : null;
  } catch {
    /* garde la valeur actuelle */
  }
}

const P = '([A-Za-z0-9_]{2,16})';
const PATTERNS: RegExp[] = [
  new RegExp('merci\\s+' + P + "\\s+d[' ]", 'i'), // Merci X d'avoir voté
  new RegExp('joueur\\s+' + P + '\\s+a\\s+(?:vot|donn)', 'i'), // Le joueur X a voté / a donné
  new RegExp(P + '\\s+a\\s+(?:vot|donn)', 'i'), // X a voté / X a donné (une flamme)
  new RegExp(P + '\\s+vien[st]\\s+de\\s+(?:vot|donn)', 'i'), // X vient de voter / de donner (une flamme)
  new RegExp('vote\\s+de\\s+' + P, 'i'), // Vote de X
];

// Nom de champ d'embed qui contient le pseudo du votant (Serveurly, etc.).
const PLAYER_FIELD = /joueur|player|pseudo|votant|voter|utilisateur|^\s*user\s*$/i;

// Pseudos bidon des messages de test (à ne jamais enregistrer).
const FAKE = new Set([
  'joueur', 'player', 'un', 'une', 'le', 'la', 'les', 'serveur', 'server',
  'test', 'pseudo', 'username', 'exemple', 'example', 'someone', 'quelqu',
]);

/** Extrait le pseudo d'un message de vote (enlève le markdown Discord). */
export function parseVotePseudo(text: string): string | null {
  // On enlève le markdown Discord (gras/italique/…) SANS toucher aux "_" des pseudos.
  const t = (text || '').replace(/\*\*|\*|`|~~|~|\|\|/g, ' ');

  // Message de test explicite → on ignore.
  if (/\[\s*test\s*\]/i.test(t)) return null;

  for (const re of PATTERNS) {
    const m = t.match(re);
    if (m && m[1] && !FAKE.has(m[1].toLowerCase())) return m[1];
  }
  return null;
}

/** Enregistre un vote (anti-doublon : 1 par (pseudo, site) et par heure). */
async function recordVote(pseudo: string, site: string): Promise<boolean> {
  if (!hasDatabase()) return false;
  const sql = db();
  const recent = await sql`
    select 1 from site_votes
    where lower(pseudo) = lower(${pseudo}) and site = ${site}
      and voted_at > now() - interval '1 hour'
    limit 1`;
  if (recent.length) return false;
  await sql`insert into site_votes (pseudo, site) values (${pseudo}, ${site})`;
  return true;
}

/**
 * Traite un message du salon de votes. Renvoie true si le message a été consommé
 * (qu'un vote ait été enregistré ou non), pour que messageCreate s'arrête là.
 */
export async function handleVoteLogMessage(message: Message): Promise<boolean> {
  if (!channelId || message.channelId !== channelId) return false;

  // Rassemble tout le texte : contenu + embeds (beaucoup de webhooks utilisent des embeds).
  const parts: string[] = [message.content || ''];
  let fieldPseudo: string | null = null;
  for (const e of message.embeds) {
    if (e.title) parts.push(e.title);
    if (e.description) parts.push(e.description);
    if (e.author?.name) parts.push(e.author.name);
    for (const f of e.fields) {
      parts.push(f.name, f.value);
      // Le pseudo est souvent dans un champ « Joueur » (Serveurly…) → source la plus fiable.
      if (!fieldPseudo && PLAYER_FIELD.test(f.name)) {
        const v = (f.value || '').replace(/[`*_~|<>@]/g, '').trim();
        if (/^[A-Za-z0-9_]{2,16}$/.test(v) && !FAKE.has(v.toLowerCase())) fieldPseudo = v;
      }
    }
  }
  const joined = parts.join('  ');
  // Message de test explicite → on ignore (même si un champ contient un pseudo).
  if (/\[\s*test\s*\]/i.test(joined)) return true;
  const pseudo = fieldPseudo ?? parseVotePseudo(joined);
  if (pseudo) {
    // Le "site" = le nom du webhook (ex. "Serveurly") pour compter chaque site à part.
    const site = (message.author?.username || 'discord').slice(0, 40);
    try {
      await recordVote(pseudo, site);
    } catch {
      /* la DB peut être momentanément indispo : on ignore ce vote */
    }
  }
  return true; // message du salon de votes : consommé dans tous les cas
}
