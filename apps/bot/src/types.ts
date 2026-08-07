import type {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  ButtonInteraction,
  StringSelectMenuInteraction,
  RoleSelectMenuInteraction,
  ModalSubmitInteraction,
  Client,
  Collection,
} from 'discord.js';

/** Une commande slash */
export interface SlashCommand {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  /** true = réservée aux fondateurs (vérifié globalement) */
  founderOnly?: boolean;
  execute(interaction: ChatInputCommandInteraction): Promise<void> | void;
}

/**
 * Un gestionnaire de composant (bouton, menu, modal).
 * `prefix` = début du customId. Ex : customId "panel:role:123" → prefix "panel:role".
 */
export interface ComponentHandler<
  I =
    | ButtonInteraction
    | StringSelectMenuInteraction
    | RoleSelectMenuInteraction
    | ModalSubmitInteraction,
> {
  prefix: string;
  execute(interaction: I): Promise<void> | void;
}

/** Client étendu avec les collections de commandes/handlers */
export interface XOClient extends Client {
  commands: Collection<string, SlashCommand>;
  buttons: ComponentHandler<ButtonInteraction>[];
  selectMenus: ComponentHandler<StringSelectMenuInteraction>[];
  roleSelects: ComponentHandler<RoleSelectMenuInteraction>[];
  modals: ComponentHandler<ModalSubmitInteraction>[];
}
