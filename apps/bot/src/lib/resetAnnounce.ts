import { EmbedBuilder, type Client, type TextChannel } from 'discord.js';

/** Salon Annonce où sont postés les resets. */
export const ANNONCE_CHANNEL = '1535346601231388752';
/** Rôle "Reset Monde" (statut) — mentionné dans l'annonce. */
export const RESET_ROLE = '1549077052089442365';
/** Emoji EmeriaMC. */
const EMERIA = '<:EmeriaMC:1541095551511298139>';

/**
 * Petit embed d'annonce de reset (mise en forme markdown dans la description :
 * titre `#`, sous-texte `-#`, citation `>`).
 */
export function resetEmbed(title: string, body: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x57f287)
    .setDescription(
      `# ${title}\n` +
        `-# ➜ <@&${RESET_ROLE}>\n\n` +
        `${body}\n` +
        `N'hésitez pas à y faire un tour !\n` +
        `Bon jeu !\n` +
        `> ${EMERIA}  **L'équipe d'EmeriaMC.**`,
    );
}

/** Poste l'annonce dans le salon Annonce (ping du rôle Reset Monde autorisé). */
export async function postReset(client: Client, embed: EmbedBuilder): Promise<void> {
  const ch = await client.channels.fetch(ANNONCE_CHANNEL).catch(() => null);
  if (ch?.isTextBased()) {
    await (ch as TextChannel).send({
      embeds: [embed],
      allowedMentions: { roles: [RESET_ROLE] },
    });
  }
}
