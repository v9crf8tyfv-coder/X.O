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
 * Plusieurs grades sur une même ligne (ex "Modérateur, Super-Modérateur" ou "Modo + Dev").
 * Découpe sur , / + & et "et", mappe chaque morceau, sans doublon.
 */
function gradeKeysFromText(raw: string): string[] {
  const parts = raw.split(/[,/+&]|\bet\b|\bpuis\b/i);
  const keys: string[] = [];
  for (const p of parts) {
    const k = gradeKeyFromText(p);
    if (k && !keys.includes(k)) keys.push(k);
  }
  // Repli : si le découpage n'a rien donné, tenter la ligne entière.
  if (keys.length === 0) {
    const k = gradeKeyFromText(raw);
    if (k) keys.push(k);
  }
  return keys;
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

const MONTHS_FR: Record<string, number> = {
  janvier: 0, fevrier: 1, mars: 2, avril: 3, mai: 4, juin: 5, juillet: 6,
  aout: 7, septembre: 8, octobre: 9, novembre: 10, decembre: 11,
};

/**
 * Cherche une date ÉCRITE dans le texte du message (ex "22 octobre 2017", "21/01/2018").
 * Les vieux ranks réimportés ont tous la même date Discord → on préfère la date du texte.
 * Renvoie le timestamp (ms) ou null si rien trouvé.
 */
function parseDateFromText(text: string): number | null {
  // "22 octobre 2017" (mois en toutes lettres)
  const m1 = text.match(
    /\b(\d{1,2})\s+(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)\s+(\d{4})\b/i,
  );
  if (m1) {
    const mon = MONTHS_FR[norm(m1[2]!)];
    if (mon != null) return new Date(Number(m1[3]), mon, Number(m1[1])).getTime();
  }
  // "21/01/2018" ou "21-01-2018" ou "21.01.2018"
  const m2 = text.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/);
  if (m2) {
    let y = Number(m2[3]);
    if (y < 100) y += 2000;
    return new Date(y, Number(m2[2]) - 1, Number(m2[1])).getTime();
  }
  return null;
}

interface GradeEvent {
  ts: number; // ms
  adds: string[]; // grades obtenus (plusieurs possibles sur une ligne)
  removes: string[]; // grades retirés (dérank seul)
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
      const adds = mAdd ? gradeKeysFromText(mAdd[1]!) : [];
      const removes = mRem ? gradeKeysFromText(mRem[1]!) : [];
      if (!adds.length && !removes.length) continue;
      // Date écrite dans le message en priorité, sinon la date Discord du message.
      const ts = parseDateFromText(text) ?? m.createdTimestamp;
      events.push({ ts, adds, removes });
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
      // Un rank = on montre le(s) grade(s) OBTENU(S) avec un +. Un dérank seul = grade retiré avec -.
      if (ev.adds.length) {
        for (const key of ev.adds) {
          const g = getGrade(key);
          const logo = logoFor(interaction.client, key);
          lines.push(`➕ ${logo ? logo + ' ' : ''}**${g.label}** — <t:${sec}:D>`);
        }
      } else {
        for (const key of ev.removes) {
          const g = getGrade(key);
          const logo = logoFor(interaction.client, key);
          lines.push(`➖ ${logo ? logo + ' ' : ''}**${g.label}** (retiré) — <t:${sec}:D>`);
        }
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

    const latestAdd = [...events].reverse().find((e) => e.adds.length)?.adds[0] ?? null;
    const embed = new EmbedBuilder()
      .setDescription(`${titleLine}\n\n${body}`)
      .setColor(latestAdd ? gradeColorInt(latestAdd) : 0x3b82f6);

    await interaction.editReply({ embeds: [embed] });
  },
};
