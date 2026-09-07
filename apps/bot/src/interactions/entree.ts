import { MessageFlags, type StringSelectMenuInteraction, type GuildMember } from 'discord.js';
import type { ComponentHandler } from '../types.js';
import { db, hasDatabase } from '@xo/db';
import { ROLE_INCONNU, GRADE_JOUEUR, ENTRY_SOURCES } from '@xo/shared';
import { ENTRY_SELECT_ID } from '../lib/entree.js';

/**
 * Le membre choisit comment il a connu EmeriaMC :
 *  - on enregistre sa réponse (stats d'entrée) ;
 *  - on retire le rôle Inconnu et on donne le rôle Joueur → accès complet.
 */
export const entreeSelect: ComponentHandler<StringSelectMenuInteraction> = {
  prefix: ENTRY_SELECT_ID,
  async execute(interaction) {
    const value = interaction.values[0];
    const src = ENTRY_SOURCES.find((s) => s.value === value);
    const member = interaction.member as GuildMember | null;

    if (hasDatabase() && value) {
      try {
        await db()`create table if not exists entry_sources (
          user_id text primary key,
          source text not null,
          created_at timestamptz not null default now()
        )`;
        await db()`
          insert into entry_sources (user_id, source) values (${interaction.user.id}, ${value})
          on conflict (user_id) do update set source = ${value}, created_at = now()
        `;
      } catch (e) {
        console.error('[entree] enregistrement source échoué:', e);
      }
    }

    try {
      if (member) {
        if (member.roles.cache.has(ROLE_INCONNU)) {
          await member.roles.remove(ROLE_INCONNU, 'Source d\'entrée choisie').catch(() => {});
        }
        if (GRADE_JOUEUR.roleId && !member.roles.cache.has(GRADE_JOUEUR.roleId)) {
          await member.roles.add(GRADE_JOUEUR.roleId, 'Accès débloqué (source choisie)').catch(() => {});
        }
      }
    } catch (e) {
      console.error('[entree] changement de rôles échoué:', e);
    }

    await interaction.reply({
      content:
        'Merci ! Tu as maintenant accès à tout le serveur. Bienvenue sur **EmeriaMC** !' +
        (src ? `\n> Réponse enregistrée : **${src.label}**` : ''),
      flags: MessageFlags.Ephemeral,
    });
  },
};
