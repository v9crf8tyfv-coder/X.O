import type { SlashCommand } from '../types.js';
import { ban } from './moderation/ban.js';
import { kick } from './moderation/kick.js';
import { mute } from './moderation/mute.js';
import { unmute } from './moderation/unmute.js';
import { warn } from './moderation/warn.js';
import { panel } from './setup/panel.js';
import { setupAbsence } from './setup/setup-absence.js';
import { setupTicket } from './setup/setup-ticket.js';

export const commands: SlashCommand[] = [
  ban,
  kick,
  mute,
  unmute,
  warn,
  panel,
  setupAbsence,
  setupTicket,
];
