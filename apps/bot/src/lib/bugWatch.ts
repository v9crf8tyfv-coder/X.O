import { EmbedBuilder, type Client, type Message } from 'discord.js';

/**
 * Détecteur de bug reports (léger, event-driven).
 *
 * À chaque nouveau message dans les 2 salons de bug report, si le message suit
 * le SCHÉMA imposé (**Nom du bug :** ...), le bot :
 *   1. pose l'emoji ORANGE :attente: sur le report (marque "détecté / à corriger"),
 *   2. envoie un DM privé au propriétaire avec un embed résumant le bug (+ image).
 *
 * La CORRECTION du code n'est PAS faite ici (c'est Claude qui corrige en local).
 * Ce module ne fait que détecter + prévenir. Il n'affecte aucun autre flux du bot.
 *
 * Config via variables d'environnement (avec valeurs par défaut) :
 *   BUG_CHANNEL_IG      id du salon "bug report IG"      (défaut : 1548689605073838120)
 *   BUG_CHANNEL_TOOLS   id du salon "bug report outils"  (défaut : 1548689826071445616)
 *   BUG_OWNER_ID        id Discord du propriétaire à DM  (REQUIS pour le DM)
 *   BUG_EMOJI_ATTENTE   nom de l'emoji custom orange     (défaut : attente)
 */

const BUG_CHANNELS = new Set(
  [
    process.env.BUG_CHANNEL_IG?.trim() || '1548689605073838120',
    process.env.BUG_CHANNEL_TOOLS?.trim() || '1548689826071445616',
  ].filter(Boolean),
);
const OWNER_ID = process.env.BUG_OWNER_ID?.trim() || '';
const EMOJI_ATTENTE = process.env.BUG_EMOJI_ATTENTE?.trim() || 'attente';

/** Un vrai report suit le schéma : on ignore tout le reste (discussions, schéma épinglé…). */
function isBugReport(content: string): boolean {
  return /\*\*\s*Nom du bug\s*:\s*\*\*/i.test(content);
}

/** Extrait la valeur d'un champ **Label :** ... jusqu'au prochain **…** ou la fin. */
function field(content: string, label: string): string {
  const re = new RegExp(`\\*\\*\\s*${label}\\s*:\\s*\\*\\*\\s*([\\s\\S]*?)(?=\\n\\s*\\*\\*|$)`, 'i');
  return content.match(re)?.[1]?.trim() || '';
}

export async function onBugReport(client: Client, message: Message): Promise<void> {
  try {
    if (message.author?.bot) return;
    if (!BUG_CHANNELS.has(message.channelId)) return;
    if (!isBugReport(message.content || '')) return;

    // 1) Orange :attente: — le bot marque le report comme "détecté / à corriger".
    let emoji = message.guild?.emojis.cache.find((e) => e.name === EMOJI_ATTENTE);
    if (!emoji && message.guild) {
      const all = await message.guild.emojis.fetch().catch(() => null);
      emoji = all?.find((e) => e.name === EMOJI_ATTENTE) ?? undefined;
    }
    await message.react(emoji ?? '⏳').catch(() => {});

    // 2) DM privé au propriétaire.
    if (!OWNER_ID) return;
    const nom = field(message.content, 'Nom du bug') || '(sans nom)';
    const explication = field(message.content, 'Explication') || "(pas d'explication)";
    const img =
      message.attachments.find((a) => (a.contentType ?? '').startsWith('image/')) ??
      message.attachments.first();

    const embed = new EmbedBuilder()
      .setTitle('Nouveau bug report détecté')
      .setURL(message.url)
      .setColor(0xe67e22)
      .setDescription(`[Aller au report](${message.url})`)
      .addFields(
        { name: 'Nom du bug', value: nom.slice(0, 1024) },
        { name: 'Explication', value: explication.slice(0, 1024) },
        { name: 'Auteur', value: message.author.tag, inline: true },
        { name: 'Salon', value: `<#${message.channelId}>`, inline: true },
      )
      .setTimestamp(message.createdAt);
    if (img?.url) embed.setImage(img.url);

    const owner = await client.users.fetch(OWNER_ID).catch(() => null);
    await owner?.send({ embeds: [embed] }).catch(() => {});
  } catch {
    // silencieux : ne jamais casser le flux de messages du bot.
  }
}
