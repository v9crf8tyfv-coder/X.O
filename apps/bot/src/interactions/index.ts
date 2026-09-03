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
import { ticketOpen, ticketClose, ticketRecruit } from './ticket.js';
import { launcherSoon } from './game.js';
import { bytenutRenew } from './bytenut.js';
import { roleButton } from './roleButton.js';
import { shopEnterCode, shopAccept, shopClose, shopCodeModal } from './boutique.js';
import { trainToggle } from './train.js';
import { candidatureDone } from './candidature.js';
import { spoilerView, spoilerInvites } from './spoilers.js';
import { trainMark } from './trainMark.js';

export const buttons: ComponentHandler<ButtonInteraction>[] = [
  absenceNew,
  absenceArchive,
  absenceDelete,
  absenceEdit,
  ticketClose,
  ticketRecruit,
  launcherSoon,
  bytenutRenew,
  roleButton,
  shopEnterCode,
  shopAccept,
  shopClose,
  trainToggle,
  candidatureDone,
  spoilerView,
  spoilerInvites,
  trainMark,
];

export const selectMenus: ComponentHandler<StringSelectMenuInteraction>[] = [ticketOpen];

export const roleSelects: ComponentHandler<RoleSelectMenuInteraction>[] = [panelAutoRole];

export const modals: ComponentHandler<ModalSubmitInteraction>[] = [
  absenceCreate,
  absenceEditSubmit,
  shopCodeModal,
];
