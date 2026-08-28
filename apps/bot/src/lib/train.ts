/**
 * Entraînement modération — logique de session (100 % en mémoire, aucune DB).
 *
 * Une session par salon. On garde le strict minimum en RAM (le bot tourne sur
 * un petit hébergeur) : le défi courant + un compteur. Pas de cache lourd.
 */
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type TextChannel,
  type Client,
} from 'discord.js';
import { CHANNELS, BRAND_COLOR } from '@xo/shared';
import { TRAIN_LINES, FAKE_PSEUDOS, CATEGORY_LABEL, type TrainCategory } from './trainContent.js';

interface Challenge {
  pseudo: string;
  message: string;
  category: TrainCategory;
  offense: number; // récidive : 1 = 1ère fois, 2, 3, 4 = 4ème et +
  messageId: string | null; // id du message posté (pour le supprimer ensuite)
  postedAt: number;
}

/** Tire un niveau de récidive aléatoire (pondéré vers les premières fois) */
function randomOffense(): number {
  const r = Math.random();
  return r < 0.45 ? 1 : r < 0.72 ? 2 : r < 0.9 ? 3 : 4;
}

/** Libellé de récidive affiché */
function offenseLabel(n: number): string {
  if (n <= 1) return '1ère fois';
  if (n >= 4) return '4ème fois et +';
  return `${n}ème fois`;
}

interface Session {
  channelId: string;
  startedBy: string; // tag du staff qui a lancé
  current: Challenge | null;
  handled: number; // nombre de cas résolus correctement
  startedAt: number;
  deck: number[]; // ordre mélangé des lignes (indices dans TRAIN_LINES)
  deckPos: number; // prochaine ligne à tirer
  lastPseudo: string | null;
}

/** Mélange (Fisher-Yates) les indices de toutes les lignes disponibles */
function shuffledDeck(): number[] {
  // On ignore les lignes vides (placeholders non remplis)
  const d = TRAIN_LINES.map((l, i) => (l.message.trim() ? i : -1)).filter((i) => i >= 0);
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j]!, d[i]!];
  }
  return d;
}

/** Prochaine ligne SANS répétition : on vide le deck avant de re-mélanger,
 *  et on évite d'enchaîner deux fois la même juste après un re-mélange. */
function nextLine(session: Session) {
  if (session.deckPos >= session.deck.length) {
    const last = session.deck[session.deck.length - 1];
    const d = shuffledDeck();
    if (d.length > 1 && d[0] === last) [d[0], d[1]] = [d[1]!, d[0]!];
    session.deck = d;
    session.deckPos = 0;
  }
  return TRAIN_LINES[session.deck[session.deckPos++]!]!;
}

/** Pseudo au hasard, différent du précédent si possible */
function nextPseudo(session: Session): string {
  let p = FAKE_PSEUDOS[Math.floor(Math.random() * FAKE_PSEUDOS.length)]!;
  if (FAKE_PSEUDOS.length > 1 && p === session.lastPseudo) {
    p = FAKE_PSEUDOS[(FAKE_PSEUDOS.indexOf(p) + 1) % FAKE_PSEUDOS.length]!;
  }
  session.lastPseudo = p;
  return p;
}

/** channelId -> session active */
const sessions = new Map<string, Session>();

export function getSession(channelId: string): Session | undefined {
  return sessions.get(channelId);
}

export function isRunning(channelId: string): boolean {
  return sessions.has(channelId);
}

// ---------- rendu ----------

const HINT = 'Réponds ici : `mute pseudo temps raison` — ex : `mute Zephyx_ 10m insulte`';

/** Embed du faux message à modérer (ressemble à un message de joueur) */
function challengeEmbed(c: Challenge): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x2b2d31)
    .setAuthor({ name: `${c.pseudo}  ›  #general` })
    .setDescription(`> ${c.message}`)
    .addFields({ name: 'Récidive', value: `⚠️ **${offenseLabel(c.offense)}**`, inline: true })
    .setFooter({ text: HINT });
}

/** Poste un nouveau défi dans le salon et le mémorise */
async function postChallenge(channel: TextChannel, session: Session): Promise<void> {
  const line = nextLine(session);
  const pseudo = nextPseudo(session);
  const c: Challenge = {
    pseudo,
    message: line.message,
    category: line.category,
    offense: randomOffense(),
    messageId: null,
    postedAt: Date.now(),
  };
  const sent = await channel.send({ embeds: [challengeEmbed(c)] }).catch(() => null);
  c.messageId = sent?.id ?? null;
  session.current = c;
}

// ---------- cycle de vie ----------

/** Démarre une session dans le salon. Retourne false si déjà en cours. */
export async function startSession(
  channel: TextChannel,
  startedByTag: string,
): Promise<boolean> {
  if (sessions.has(channel.id)) return false;
  const session: Session = {
    channelId: channel.id,
    startedBy: startedByTag,
    current: null,
    handled: 0,
    startedAt: Date.now(),
    deck: shuffledDeck(),
    deckPos: 0,
    lastPseudo: null,
  };
  sessions.set(channel.id, session);
  await logSession(channel.client, 'start', { by: startedByTag });
  await postChallenge(channel, session);
  return true;
}

/** Arrête la session. Retourne le nombre de cas traités, ou null si aucune. */
export async function stopSession(channel: TextChannel, byTag: string): Promise<number | null> {
  const session = sessions.get(channel.id);
  if (!session) return null;
  // Supprime le défi encore affiché
  if (session.current?.messageId) {
    await channel.messages.delete(session.current.messageId).catch(() => {});
  }
  sessions.delete(channel.id);
  await logSession(channel.client, 'end', { by: byTag, handled: session.handled });
  return session.handled;
}

/** Loggue le début / la fin d'une session dans le salon résultat */
async function logSession(
  client: Client,
  kind: 'start' | 'end',
  data: { by: string; handled?: number },
): Promise<void> {
  const ch = await client.channels.fetch(CHANNELS.trainResultat).catch(() => null);
  if (!ch?.isTextBased()) return;
  const embed =
    kind === 'start'
      ? new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle('🟢 Session d’entraînement lancée')
          .setDescription(`Lancée par **${data.by}**`)
          .setTimestamp()
      : new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle('🔴 Session d’entraînement terminée')
          .setDescription(`Arrêtée par **${data.by}**\nCas correctement modérés : **${data.handled ?? 0}**`)
          .setTimestamp();
  await (ch as TextChannel).send({ embeds: [embed] }).catch(() => {});
}

// ---------- réponse d'un staff ----------

/**
 * Un staff a répondu par une sanction (mute, warn, kick, ban…). Aucune
 * validation : on loggue la réponse telle quelle dans le salon résultat, on
 * supprime l'ancien message et on enchaîne. Retourne true si une session tournait.
 */
export async function handleAnswer(
  client: Client,
  channel: TextChannel,
  staffTag: string,
  response: string,
): Promise<boolean> {
  const session = sessions.get(channel.id);
  if (!session || !session.current) return false;
  const c = session.current;

  session.handled += 1;
  await logResult(client, { c, staffTag, response });
  if (c.messageId) await channel.messages.delete(c.messageId).catch(() => {});
  await postChallenge(channel, session);
  return true;
}

/** Écrit la réponse du staff dans le salon résultat (les admins y voient tout) */
async function logResult(
  client: Client,
  data: { c: Challenge; staffTag: string; response: string },
): Promise<void> {
  const ch = await client.channels.fetch(CHANNELS.trainResultat).catch(() => null);
  if (!ch?.isTextBased()) return;
  const { c, staffTag, response } = data;
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle('📩 Réponse d’entraînement')
    .addFields(
      { name: 'Message fictif', value: `**${c.pseudo}** : ${c.message}` },
      { name: 'Type', value: CATEGORY_LABEL[c.category], inline: true },
      { name: 'Récidive', value: offenseLabel(c.offense), inline: true },
      { name: 'Réponse du staff', value: `\`${response}\`` },
      { name: 'Par', value: staffTag, inline: true },
    )
    .setTimestamp();
  await (ch as TextChannel).send({ embeds: [embed] }).catch(() => {});
}

// ---------- panneau de contrôle ----------

/** Embed + bouton unique On/Off posté en haut du salon */
export function controlPanel(running: boolean): {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
} {
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle('🎓 Entraînement Modération')
    .setDescription(
      "X.O va poster de **faux messages** de joueurs qui enfreignent le règlement.\n" +
        'À toi de réagir vite avec une sanction :\n\n' +
        '```sanction pseudo temps raison```\n' +
        'Exemple : `mute Zephyx_ 10m insulte` — sanctions dispo : `mute`, `warn`, `kick`, `ban`…\n' +
        'Si le message est **correct**, réponds simplement `rien` (aucune sanction).\n\n' +
        'Dès que tu réponds, le message disparaît et un nouveau cas arrive.\n' +
        'Début, fin et réponses sont enregistrés dans le salon résultat.',
    )
    .setFooter({ text: 'Réservé aux modérateurs et grades supérieurs.' });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(toggleButton(running));
  return { embeds: [embed], components: [row] };
}

/** Le bouton On/Off, dont l'apparence dépend de l'état courant */
export function toggleButton(running: boolean): ButtonBuilder {
  return running
    ? new ButtonBuilder().setCustomId('train:toggle').setLabel('Entraînement : ON').setStyle(ButtonStyle.Danger).setEmoji('⏹️')
    : new ButtonBuilder().setCustomId('train:toggle').setLabel('Entraînement : OFF').setStyle(ButtonStyle.Success).setEmoji('▶️');
}
