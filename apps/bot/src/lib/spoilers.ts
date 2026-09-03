import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type Guild,
  type GuildMember,
  type Invite,
} from 'discord.js';
import { db, hasDatabase } from '@xo/db';

/**
 * Système de parrainage / spoilers Emeria — 100% léger, sans dépendance ni service
 * externe. Suivi RÉEL des invitations Discord (qui a invité qui, membre encore présent),
 * paliers d'invitations valides = spoilers débloqués dans l'ordre.
 *
 * Stockage : deux petites tables Postgres (base déjà utilisée par le bot) :
 *   - referrals(invitee_id, inviter_id, active)  → un parrainage par membre invité
 *   - spoiler_unlocks(user_id, unlocked)         → nb de spoilers déjà débloqués (dans l'ordre)
 */

/* ------------------------------------------------------------------ */
/* CONTENU DES SPOILERS — modifie librement (texte / image plus tard). */
/* ------------------------------------------------------------------ */
export interface Spoiler {
  need: number; // invitations valides requises
  title: string;
  description: string;
  image?: string; // URL d'image (optionnel)
}
export const SPOILERS: Spoiler[] = [
  { need: 1, title: 'Spoiler 1 — Le spawn', description: 'Un aperçu du spawn d’Emeria.' },
  { need: 3, title: 'Spoiler 2 — Une zone de la map', description: 'Un aperçu d’une région du monde.' },
  { need: 5, title: 'Spoiler 3 — Une fonctionnalité', description: 'Révélation d’une fonctionnalité exclusive.' },
  { need: 7, title: 'Spoiler 4 — Le market', description: 'Un aperçu du système d’économie / market.' },
  { need: 10, title: 'Spoiler 5 — Les nations', description: 'Un aperçu du système de nations.' },
  { need: 12, title: 'Spoiler 6 — Les events', description: 'Un aperçu des events hebdomadaires.' },
  { need: 15, title: 'Spoiler 7 — Le lore', description: 'Un morceau de l’histoire d’Emeria.' },
  { need: 20, title: 'Spoiler 8 — Le build principal', description: 'Un aperçu d’une construction majeure.' },
  { need: 25, title: 'Spoiler 9 — Une surprise', description: 'Une information réservée aux plus impliqués.' },
  { need: 30, title: 'Spoiler 10 — La révélation finale', description: 'Le dernier secret avant l’ouverture.' },
];

const ACCENT = 0x7c5cff;
export const BTN_VIEW = 'spoiler:view';
export const BTN_INVITES = 'spoiler:invites';

/* ------------------------------------------------------------------ */
/* Suivi des invitations                                              */
/* ------------------------------------------------------------------ */
const inviteUses = new Map<string, number>(); // code -> uses (cache mémoire, léger)

export async function initSpoilers(): Promise<void> {
  if (!hasDatabase()) return;
  await db()`create table if not exists referrals (
    invitee_id text primary key,
    inviter_id text not null,
    active boolean not null default true,
    joined_at timestamptz not null default now()
  )`.catch(() => {});
  await db()`create table if not exists spoiler_unlocks (
    user_id text primary key,
    unlocked int not null default 0
  )`.catch(() => {});
}

/** Met en cache le nombre d'utilisations de chaque invitation du serveur. */
export async function cacheInvites(guild: Guild): Promise<void> {
  try {
    const invites = await guild.invites.fetch();
    inviteUses.clear();
    invites.forEach((i) => inviteUses.set(i.code, i.uses ?? 0));
  } catch {
    /* pas la permission "Gérer le serveur" → le suivi restera limité */
  }
}

export function onInviteCreate(invite: Invite): void {
  inviteUses.set(invite.code, invite.uses ?? 0);
}

/** À l'arrivée d'un membre : trouve l'invitation utilisée → crédite le parrain. */
export async function onMemberJoin(member: GuildMember): Promise<void> {
  if (!hasDatabase() || member.user.bot) return;
  let inviterId: string | null = null;
  try {
    const invites = await member.guild.invites.fetch();
    for (const inv of invites.values()) {
      const prev = inviteUses.get(inv.code) ?? 0;
      const now = inv.uses ?? 0;
      if (now > prev && inv.inviter && !inv.inviter.bot) inviterId = inv.inviter.id;
      inviteUses.set(inv.code, now);
    }
  } catch {
    return;
  }
  if (!inviterId || inviterId === member.id) return;
  // Rejoin : on GARDE le parrain d'origine et on réactive (pas de double comptage).
  await db()`
    insert into referrals (invitee_id, inviter_id, active) values (${member.id}, ${inviterId}, true)
    on conflict (invitee_id) do update set active = true
  `.catch(() => {});
}

/** Au départ d'un membre : son invitation ne compte plus. */
export async function onMemberLeave(userId: string): Promise<void> {
  if (!hasDatabase()) return;
  await db()`update referrals set active = false where invitee_id = ${userId}`.catch(() => {});
}

/** Nombre d'invitations VALIDES d'un utilisateur (membres invités toujours présents). */
export async function validInvites(userId: string): Promise<number> {
  if (!hasDatabase()) return 0;
  try {
    const r = await db()<{ n: number }[]>`
      select count(*)::int n from referrals where inviter_id = ${userId} and active = true
    `;
    return r[0]?.n ?? 0;
  } catch {
    return 0;
  }
}

async function getUnlocked(userId: string): Promise<number> {
  if (!hasDatabase()) return 0;
  const r = await db()<{ unlocked: number }[]>`select unlocked from spoiler_unlocks where user_id = ${userId}`;
  return r[0]?.unlocked ?? 0;
}
async function setUnlocked(userId: string, n: number): Promise<void> {
  await db()`
    insert into spoiler_unlocks (user_id, unlocked) values (${userId}, ${n})
    on conflict (user_id) do update set unlocked = ${n}
  `.catch(() => {});
}

/* ------------------------------------------------------------------ */
/* Embeds                                                             */
/* ------------------------------------------------------------------ */
export function spoilerPanelEmbed(): EmbedBuilder {
  const paliers = SPOILERS.map((s, i) => `**${s.need} invitation${s.need > 1 ? 's' : ''} valides** — Spoiler ${i + 1}`).join('\n');
  return new EmbedBuilder()
    .setColor(ACCENT)
    .setTitle('Centre des spoilers — Emeria')
    .setDescription(
      'Faites découvrir Emeria à vos amis et débloquez progressivement des informations exclusives sur le serveur. ' +
        'Chaque palier d’invitations valides permet d’accéder à un nouveau spoiler.\n\n' +
        'Les invitations sont comptabilisées uniquement lorsqu’une personne rejoint réellement le serveur. ' +
        'Les invitations annulées, les départs et les faux comptes ne débloquent rien.\n\n' +
        '__**Paliers**__\n' + paliers,
    );
}

export function spoilerButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(BTN_VIEW).setLabel('Voir un spoiler').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(BTN_INVITES).setLabel('Mes invitations').setStyle(ButtonStyle.Secondary),
  );
}

/** Prochain palier non atteint (pour l'affichage). null si tout est débloqué. */
function nextTier(unlocked: number): Spoiler | null {
  return unlocked < SPOILERS.length ? SPOILERS[unlocked]! : null;
}

/** Résultat d'un clic "Voir un spoiler". */
export async function viewNextSpoiler(userId: string): Promise<EmbedBuilder> {
  const invites = await validInvites(userId);
  const unlocked = await getUnlocked(userId);
  const tier = nextTier(unlocked);

  if (!tier) {
    return new EmbedBuilder().setColor(ACCENT).setTitle('Spoilers').setDescription(
      'Vous avez débloqué **tous les spoilers**. Merci pour vos invitations.',
    );
  }
  if (invites < tier.need) {
    return new EmbedBuilder().setColor(0xe08b2f).setTitle('Spoilers').setDescription(
      `Vous avez déjà débloqué tous les spoilers accessibles avec vos invitations.\n\n` +
        `**Prochain spoiler :** ${tier.need} invitations valides.\n` +
        `Il vous manque **${tier.need - invites}** invitation${tier.need - invites > 1 ? 's' : ''} valide${tier.need - invites > 1 ? 's' : ''}.`,
    );
  }
  // Débloque CE spoiler (dans l'ordre) et l'affiche.
  await setUnlocked(userId, unlocked + 1);
  const n = unlocked + 1;
  const e = new EmbedBuilder().setColor(ACCENT).setTitle(`Spoiler #${n} débloqué`).setDescription(`**${tier.title}**\n\n${tier.description}`);
  if (tier.image) e.setImage(tier.image);
  return e;
}

/** Résultat d'un clic "Mes invitations". */
export async function myInvitesEmbed(userId: string): Promise<EmbedBuilder> {
  const invites = await validInvites(userId);
  const unlocked = await getUnlocked(userId);
  const tier = nextTier(unlocked);
  const lines = [
    `**Invitations valides :** ${invites}`,
    `**Spoilers débloqués :** ${unlocked} / ${SPOILERS.length}`,
  ];
  if (tier) {
    lines.push(`**Prochain spoiler :** ${tier.need} invitations`);
    lines.push(`**Il vous manque :** ${Math.max(0, tier.need - invites)} invitation${Math.max(0, tier.need - invites) > 1 ? 's' : ''}`);
  } else {
    lines.push('Tous les spoilers sont débloqués.');
  }
  return new EmbedBuilder().setColor(ACCENT).setTitle('Mes invitations — Emeria').setDescription(lines.join('\n'));
}
