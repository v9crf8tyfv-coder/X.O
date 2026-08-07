import type {
  ButtonInteraction,
  StringSelectMenuInteraction,
  RoleSelectMenuInteraction,
  ModalSubmitInteraction,
} from 'discord.js';
import type { ComponentHandler } from '../types.js';
import { panelAutoRole } from './panel-autorole.js';
import {
  absenceNew,
  absenceCreate,
  absenceArchive,
  absenceDelete,
  absenceEdit,
  absenceEditSubmit,
} from './absence.js';
import { ticketOpen, ticketClose } from './ticket.js';

export const buttons: ComponentHandler<ButtonInteraction>[] = [
  absenceNew,
  absenceArchive,
  absenceDelete,
  absenceEdit,
  ticketClose,
];

export const selectMenus: ComponentHandler<StringSelectMenuInteraction>[] = [ticketOpen];

export const roleSelects: ComponentHandler<RoleSelectMenuInteraction>[] = [panelAutoRole];

export const modals: ComponentHandler<ModalSubmitInteraction>[] = [
  absenceCreate,
  absenceEditSubmit,
];
