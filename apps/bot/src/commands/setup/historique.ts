import {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
  type GuildMember,
  type TextChannel,
  type Message,
} from 'discord.js';
import { STAFF_GRADE_EMOJI, gradeLogoKey, getGrade, gradeColorInt } from '@xo/shared';
import { db, hasDatabase } from '@xo/db';
import { highestGrade } from '../../lib/permissions.js';
import { headEmoji } from '../../lib/headEmojis.js';
import type { SlashCommand } from '../../types.js';

/** Salon où sont postées les demandes de rank/dérank (source de l'historique). */
const RANK_DERANK_CHANNEL = '1548697293002375208';
/** Rôle "staff" : tous les grades l'ont. Accès à la commande (en plus de tout grade). */
const STAFF_ACCESS_ROLE = '1548682889757986846';
/** Nombre max de messages scannés dans le salon (pagination 100/appel). */
const MAX_SCAN = 1500;

/** Normalise un texte (sans accents/espaces/ponctuation, minuscule) pour comparer souplement. */
function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

/**
 * Déduit la clé de grade Emeria à partir du texte libre d'une demande
 * (ex "Modérateur test 🟣", "Super-Modérateur", "Admin"). null si inconnu.
 * L'ordre des tests compte (supermodo avant modo, cofonda avant fonda, variantes avant générique).
 */
function gradeKeyFromText(raw: string): string | null {
  const t = norm(raw);
  if (!t) return null;
  if (t.includes('super') && t.includes('mod')) return 'supermodo';
  if (t.includes('mod') && t.includes('test')) return 'modo_test';
  if (t.includes('mod') && /modox|modateurx|moderateurx/.test(t)) return 'modo_x';
  if (t.includes('mod')) return 'modo'; // modérateur, modo, modérateur réserviste…
  if (t.includes('admin')) return 'admin';
  if (t.includes('respo') || t.includes('responsable')) return 'responsable';
  if (t.includes('cofond') || t.includes('cofonda')) return 'cofondateur';
  if (t.includes('fond')) return 'fondateur';
  if (t.includes('dev') || t.includes('developp')) return 'dev';
  if (t.includes('build')) return 'buildeur';
  if (t.includes('com') || t.includes('graph')) return 'com';
  if (t.includes('beta')) return 'betatesteur';
  if (t.includes('joueur')) return 'joueur';
  return null;
}

/**
 * Markup de l'emoji-logo du grade, résolu par NOM dans TOUS les serveurs du bot
 * (le bot peut utiliser un emoji de n'importe quel serveur où il est présent — donc
 * les logos hébergés sur le Discord communauté marchent aussi dans le salon staff).
 * '' si introuvable.
 */
function logoFor(client: import('discord.js').Client, key: string): string {
  const wanted = STAFF_GRADE_EMOJI[gradeLogoKey(key)];
  if (!wanted) return '';
  const target = norm(wanted);
  const found = client.emojis.cache.find((e) => e.name != null && norm(e.name) === target);
  return found ? found.toString() : '';
}

/** Récupère jusqu'à MAX_SCAN messages du salon (du plus récent au plus ancien). */
async function fetchHistory(channel: TextChannel): Promise<Message[]> {
  const out: Message[] = [];
  let before: string | undefined;
  while (out.length < MAX_SCAN) {
    const batch = await channel.messages.fetch({ limit: 100, before }).catch(() => null);
    if (!batch || batch.size === 0) break;
    out.push(...batch.values());
    before = batch.last()?.id;
    if (batch.size < 100) break;
  }
  return out;
}

/** Concatène le texte exploitable d'un message (contenu + embeds). */
function messageText(m: Message): string {
  const parts: string[] = [m.content];
  for (const e of m.embeds) {
    if (e.title) parts.push(e.title);
    if (e.description) parts.push(e.description);
    for (const f of e.fields) parts.push(`${f.name} ${f.value}`);
  }
  return parts.join('\n');
}

interface GradeEvent {
  ts: number; // ms
  add: string | null; // clé de grade obtenu
  remove: string | null; // clé de grade retiré (dérank seul)
}

export const historique: SlashCommand = {
  // Accès géré finement dans execute (tout grade staff, pas joueur/everyone).
  minLevel: 0,
  data: new SlashCommandBuilder()
    .setName('historique')
    .setDescription("Historique des rank/dérank d'un staff (scanne le salon rank/dérank)")
    .addStringOption((o) =>
      o
        .setName('staff')
        .setDescription('Pseudo Minecraft du staff')
        .setRequired(true)
        .setAutocomplete(true),
    ),

  async autocomplete(interaction) {
    const focused = norm(interaction.options.getFocused().toString());
    let rows: { pseudo: string }[] = [];
    if (hasDatabase()) {
      rows = await db()<{ pseudo: string }[]>`
        select pseudo from staff where active = true order by pseudo
      `.catch(() => [] as { pseudo: string }[]);
    }
    const choices = rows
      .filter((r) => !focused || norm(r.pseudo).includes(focused))
      .slice(0, 25)
      .map((r) => ({ name: r.pseudo, value: r.pseudo }));
    await interaction.respond(choices).catch(() => {});
  },

  async execute(interaction) {
    // --- Accès : n'importe quel grade staff OU le rôle staff, mais jamais joueur/everyone. ---
    const member = interaction.member as GuildMember | null;
    const grade = member ? highestGrade(member) : null;
    const hasStaffRole = member?.roles.cache.has(STAFF_ACCESS_ROLE) ?? false;
    const allowed = hasStaffRole || (grade != null && grade.level > 0 && grade.key !== 'joueur');
    if (!allowed) {
      await interaction.reply({
        content: 'Accès refusé : réservé au staff.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const pseudo = interaction.options.getString('staff', true).trim();
    await interaction.deferReply();

    const channel = await interaction.client.channels
      .fetch(RANK_DERANK_CHANNEL)
      .catch(() => null);
    if (!channel?.isTextBased()) {
      await interaction.editReply('Salon rank/dérank introuvable ou inaccessible.');
      return;
    }

    const msgs = await fetchHistory(channel as TextChannel);
    const target = norm(pseudo);
    const events: GradeEvent[] = [];
    for (const m of msgs) {
      const text = messageText(m);
      const mPseudo = text.match(/pseudo\s*ig\s*:?\s*([^\n]+)/i);
      if (!mPseudo) continue;
      if (norm(mPseudo[1]!) !== target && !norm(mPseudo[1]!).startsWith(target)) continue;
      const mAdd = text.match(/grade\s*[àa]\s*mettre\s*:?\s*([^\n]+)/i);
      const mRem = text.match(/grade\s*[àa]\s*retirer\s*:?\s*([^\n]+)/i);
      const add = mAdd ? gradeKeyFromText(mAdd[1]!) : null;
      const remove = mRem ? gradeKeyFromText(mRem[1]!) : null;
      if (!add && !remove) continue;
      events.push({ ts: m.createdTimestamp, add, remove });
    }

    events.sort((a, b) => a.ts - b.ts);

    const head = await headEmoji(interaction.client, pseudo);
    const titleLine = `${head ? head + ' ' : ''}**Historique de ${pseudo}**`;

    if (events.length === 0) {
      await interaction.editReply(
        `${titleLine}\n\nAucun rank/dérank trouvé pour ce pseudo dans le salon.`,
      );
      return;
    }

    const lines: string[] = [];
    let prevTs = 0;
    for (const ev of events) {
      // Séparateur entre deux "périodes" éloignées (> 120 jours), comme sur l'exemple.
      if (prevTs && ev.ts - prevTs > 120 * 86400_000) lines.push('▬▬▬▬▬▬▬▬▬▬▬▬');
      prevTs = ev.ts;
      const sec = Math.floor(ev.ts / 1000);
      if (ev.add) {
        const g = getGrade(ev.add);
        const logo = logoFor(interaction.client, ev.add);
        lines.push(`➕ ${logo ? logo + ' ' : ''}**${g.label}** — <t:${sec}:f>`);
      } else if (ev.remove) {
        const g = getGrade(ev.remove);
        const logo = logoFor(interaction.client, ev.remove);
        lines.push(`➖ ${logo ? logo + ' ' : ''}**${g.label}** (retiré) — <t:${sec}:f>`);
      }
    }

    // Garde-fou longueur (embed description max 4096) : on garde les plus récents.
    let body = lines.join('\n');
    if (body.length > 3800) {
      const kept: string[] = [];
      let len = 0;
      for (let i = lines.length - 1; i >= 0; i--) {
        if (len + lines[i]!.length + 1 > 3600) break;
        kept.unshift(lines[i]!);
        len += lines[i]!.length + 1;
      }
      body = '…(plus anciens masqués)\n' + kept.join('\n');
    }

    const latestAdd = [...events].reverse().find((e) => e.add)?.add ?? null;
    const embed = new EmbedBuilder()
      .setDescription(`${titleLine}\n\n${body}`)
      .setColor(latestAdd ? gradeColorInt(latestAdd) : 0x3b82f6);

    await interaction.editReply({ embeds: [embed] });
  },
};
