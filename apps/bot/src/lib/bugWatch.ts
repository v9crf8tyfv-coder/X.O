import { EmbedBuilder, type Client, type Message, type TextChannel } from 'discord.js';

/**
 * Détecteur de bug reports (léger, event-driven + scan au démarrage).
 *
 * - À chaque NOUVEAU message dans les 2 salons suivant le SCHÉMA (**Nom du bug :**),
 *   et au DÉMARRAGE pour rattraper les reports existants non traités, le bot :
 *     1. pose l'emoji ORANGE :attente: sur le report,
 *     2. DM le propriétaire (BUG_OWNER_ID) un embed résumant le bug (+ image).
 * - Ne re-traite jamais un report déjà pris en charge (réaction du bot, ou emoji
 *   :Good:/:white_check_mark: = validé, ou :plus_tard_noir: = remis à plus tard).
 *
 * La CORRECTION du code n'est PAS faite ici (c'est Claude, en local). Détection seule.
 */

const BUG_CHANNEL_IDS = [
  process.env.BUG_CHANNEL_IG?.trim() || '1548689605073838120',
  process.env.BUG_CHANNEL_TOOLS?.trim() || '1548689826071445616',
].filter(Boolean);
const BUG_CHANNELS = new Set(BUG_CHANNEL_IDS);
const OWNER_ID = process.env.BUG_OWNER_ID?.trim() || '';
const EMOJI_ATTENTE = process.env.BUG_EMOJI_ATTENTE?.trim() || 'attente';
// :attente: vit dans la guild EmeriaMC (emoji externe pour la guild Staff) -> on réagit par name:id.
const EMOJI_ATTENTE_ID = process.env.BUG_EMOJI_ATTENTE_ID?.trim() || '1553471955967942826';
// Emojis signifiant "déjà réglé / à ignorer".
const SKIP_EMOJI_NAMES = new Set(['Good', 'white_check_mark', '✅', 'plus_tard_noir']);

function isBugReport(content: string): boolean {
  return /\*\*\s*Nom du bug\s*:\s*\*\*/i.test(content);
}

function field(content: string, label: string): string {
  const re = new RegExp(`\\*\\*\\s*${label}\\s*:\\s*\\*\\*\\s*([\\s\\S]*?)(?=\\n\\s*\\*\\*|$)`, 'i');
  return content.match(re)?.[1]?.trim() || '';
}

/** true si le report est déjà pris en charge (bot a réagi, ou emoji validé / plus tard). */
function alreadyHandled(message: Message): boolean {
  for (const r of message.reactions.cache.values()) {
    if (r.me) return true;
    if (r.emoji.name && SKIP_EMOJI_NAMES.has(r.emoji.name)) return true;
  }
  return false;
}

async function reactAttente(client: Client, message: Message): Promise<void> {
  let ok = false;
  if (EMOJI_ATTENTE_ID) {
    ok = await message.react(`${EMOJI_ATTENTE}:${EMOJI_ATTENTE_ID}`).then(() => true).catch(() => false);
  }
  if (!ok) {
    const e = client.emojis.cache.find((x) => x.name === EMOJI_ATTENTE);
    if (e) ok = await message.react(e).then(() => true).catch(() => false);
  }
  if (!ok) await message.react('⏳').catch(() => {});
}

async function dmOwner(client: Client, message: Message): Promise<void> {
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
}

/** Traite un report : réagit + DM, sauf s'il est déjà pris en charge. */
async function processReport(client: Client, message: Message): Promise<void> {
  try {
    if (message.author?.bot) return;
    if (!isBugReport(message.content || '')) return;
    if (alreadyHandled(message)) return;
    await reactAttente(client, message);
    await dmOwner(client, message);
  } catch {
    // silencieux : ne jamais casser le flux du bot.
  }
}

/** Écoute des NOUVEAUX messages (branché sur messageCreate). */
export async function onBugReport(client: Client, message: Message): Promise<void> {
  if (!BUG_CHANNELS.has(message.channelId)) return;
  await processReport(client, message);
}

/** Au démarrage : rattrape les reports existants non traités dans les 2 salons. */
export async function scanBugChannels(client: Client): Promise<void> {
  for (const id of BUG_CHANNEL_IDS) {
    try {
      const ch = await client.channels.fetch(id).catch(() => null);
      if (!ch || !ch.isTextBased()) continue;
      const msgs = await (ch as TextChannel).messages.fetch({ limit: 50 }).catch(() => null);
      if (!msgs) continue;
      const sorted = [...msgs.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
      for (const m of sorted) await processReport(client, m);
    } catch {
      // silencieux
    }
  }
}
