import type { Client } from 'discord.js';
import { publishVoteBoard } from '../lib/voteBoard.js';

/**
 * Rafraîchit l'embed du classement des votes toutes les 5 min (s'il a été posé
 * via /setup-vote). Négligeable : une lecture DB + un edit de message.
 */
export function startVoteBoardWorker(client: Client): void {
  setTimeout(() => void publishVoteBoard(client).catch(() => {}), 45_000);
  setInterval(() => void publishVoteBoard(client).catch(() => {}), 5 * 60_000);
}
