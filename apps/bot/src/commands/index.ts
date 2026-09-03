import type { SlashCommand } from '../types.js';
import { ban } from './moderation/ban.js';
import { kick } from './moderation/kick.js';
import { mute } from './moderation/mute.js';
import { unmute } from './moderation/unmute.js';
import { warn } from './moderation/warn.js';
import { unban } from './moderation/unban.js';
import { removemess } from './moderation/removemess.js';
import { removeall } from './moderation/removeall.js';
import { panel } from './setup/panel.js';
import { setupAbsence } from './setup/setup-absence.js';
import { setupTicket } from './setup/setup-ticket.js';
import { effectif } from './setup/effectif.js';
import { setupLancerJeu } from './setup/setup-lancer-jeu.js';
import { blockfull, unblockfull } from './setup/blockfull.js';
import { annonceStart, annonceStop } from './setup/annonce.js';
import { statut } from './setup/statut.js';
import { playerlist } from './setup/playerlist.js';
import { setupVoice } from './setup/setup-voice.js';
import { setupRoles } from './setup/setup-roles.js';
import { setupBoutique } from './setup/setup-boutique.js';
import { ticketAdd, ticketRemove } from './setup/ticket-members.js';
import { setupTrain } from './setup/setup-train.js';
import { setupVote } from './setup/setup-vote.js';
import { setupSpoilers } from './setup/setup-spoilers.js';

export const commands: SlashCommand[] = [
  ban,
  kick,
  mute,
  unmute,
  unban,
  warn,
  removemess,
  removeall,
  panel,
  setupAbsence,
  setupTicket,
  effectif,
  setupLancerJeu,
  blockfull,
  unblockfull,
  annonceStart,
  annonceStop,
  statut,
  playerlist,
  setupVoice,
  setupRoles,
  setupBoutique,
  ticketAdd,
  ticketRemove,
  setupTrain,
  setupVote,
  setupSpoilers,
];
