import { EmbedBuilder, AttachmentBuilder, type Client, type TextChannel } from 'discord.js';

/** Salon Annonce où sont postés les resets. */
export const ANNONCE_CHANNEL = '1535346601231388752';
/** Rôle "Reset Monde" (statut) — pingé à chaque annonce. */
export const RESET_ROLE = '1549077052089442365';
/** Emoji EmeriaMC. */
const EMERIA = '<:EmeriaMC:1541095551511298139>';
/** Violet EmeriaMC. */
const VIOLET = 0x8b6cff;

/** Fine image transparente 600×4 : force l'embed à s'élargir (plus de "petit carré"). */
const WIDE_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAlgAAAAECAYAAABStUF5AAAAIElEQVR42u3BMQEAAADCoPVPbQdvoAAAAAAAAAAAAHgNJYQAAbKy78IAAAAASUVORK5CYII=';

/** Petit embed d'annonce de reset (large, violet, avec markdown dans la description). */
export function resetEmbed(title: string, body: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(VIOLET)
    .setDescription(
      `# ${title}\n` +
        `-# ➜ <@&${RESET_ROLE}>\n\n` +
        `${body}\n` +
        `N'hésitez pas à y faire un tour !\n` +
        `Bon jeu !\n\n` +
        `> ${EMERIA}  **L'équipe d'EmeriaMC.**`,
    )
    .setImage('attachment://wide.png');
}

/** Poste l'annonce dans le salon Annonce : PING du rôle (dans le content) + embed large. */
export async function postReset(client: Client, embed: EmbedBuilder): Promise<void> {
  const ch = await client.channels.fetch(ANNONCE_CHANNEL).catch(() => null);
  if (!ch?.isTextBased()) return;
  const file = new AttachmentBuilder(Buffer.from(WIDE_PNG, 'base64'), { name: 'wide.png' });
  await (ch as TextChannel).send({
    content: `<@&${RESET_ROLE}>`,
    embeds: [embed],
    files: [file],
    allowedMentions: { roles: [RESET_ROLE] },
  });
}
