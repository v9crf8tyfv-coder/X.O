import type { Client, Guild, GuildMember, TextChannel } from 'discord.js';
import { db, hasDatabase } from '@xo/db';
import {
  ALL_GRADES,
  GRADE_JOUEUR,
  GRADES,
  STAFF_ROLE_ID,
  RESP_PLUS_ROLE_ID,
  CHANNELS,
  getGrade,
} from '@xo/shared';
import { ENV } from '../env.js';
import { publishEffectif } from '../lib/effectifPublish.js';
import { logSurveillance } from '../lib/surveillance.js';
import { autoArchiveExpired } from '../lib/absenceArchive.js';

interface PendingAction {
  id: string;
  type: string; // 'staff.apply' | 'staff.remove'
  discord_tag: string;
  minecraft_pseudo: string;
  grades: string[];
  actor: string | null; // pseudo site de l'auteur (surveillance)
  actor_grade: string | null; // grade site de l'auteur → salon de surveillance
  announce: boolean; // true = poster les félicitations (promotion/création)
}

let running = false;

/** Démarre le worker : applique les actions du site sur Discord (toutes les 8s) */
export function startPendingActionsWorker(client: Client): void {
  if (!hasDatabase()) {
    console.log('[worker] pas de base → worker désactivé');
    return;
  }
  console.log('[worker] pending_actions démarré (8s)');
  setInterval(() => {
    tick(client).catch((e) => console.error('[worker]', e));
  }, 8000);
  // Rafraîchit l'effectif régulièrement (absences, changements) — auto-actualisation
  setInterval(() => {
    publishEffectif(client).catch((e) => console.error('[effectif]', e));
  }, 60_000);
  // Archivage AUTOMATIQUE des absences expirées (toutes les 5 min + au démarrage)
  const archive = () => autoArchiveExpired(client).catch((e) => console.error('[auto-archive]', e));
  setTimeout(archive, 15_000);
  setInterval(archive, 300_000);
}

async function tick(client: Client): Promise<void> {
  if (running) return;
  running = true;
  try {
    const actions = await db()<PendingAction[]>`
      select id, type, discord_tag, minecraft_pseudo, grades, actor, actor_grade, announce
      from pending_actions where status = 'pending' order by created_at asc limit 10
    `;
    if (actions.length === 0) return;

    const guild = await client.guilds.fetch(ENV.DISCORD_GUILD_ID).catch(() => null);
    if (!guild) return;

    for (const a of actions) {
      try {
        await processAction(guild, a);
        await db()`update pending_actions set status='done', processed_at=now() where id=${a.id}`;
        await logStaffSurveillance(client, a);
        // Messages auto de félicitations/départ désactivés (demande du proprio)
        void announceStaffChange;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await db()`update pending_actions set status='error', error=${msg}, processed_at=now() where id=${a.id}`;
        console.error('[worker] action échouée', a.id, msg);
      }
    }
    // Rafraîchit l'effectif après chaque lot traité (reflète les changements)
    await publishEffectif(client).catch(() => {});
  } finally {
    running = false;
  }
}

const exists = (guild: Guild, id: string | null): id is string =>
  !!id && guild.roles.cache.has(id);

async function findMember(guild: Guild, tag: string): Promise<GuildMember | null> {
  const res = await guild.members.fetch({ query: tag, limit: 10 }).catch(() => null);
  if (!res) return null;
  const low = tag.toLowerCase();
  return res.find((m) => m.user.username.toLowerCase() === low) ?? null;
}

async function processAction(guild: Guild, a: PendingAction): Promise<void> {
  const member = await findMember(guild, a.discord_tag);
  if (!member) throw new Error(`Membre Discord introuvable: ${a.discord_tag}`);

  // Mémorise le discord_id du staff (sert à lier les absences → effectif)
  await db()`
    update staff set discord_id = ${member.id}
    where lower(discord_tag) = lower(${a.discord_tag}) and active = true
  `.catch(() => {});

  const joueur = GRADE_JOUEUR.roleId;

  if (a.type === 'staff.remove') {
    const toRemove = [
      ...Object.values(ALL_GRADES).map((g) => g.roleId),
      STAFF_ROLE_ID,
      RESP_PLUS_ROLE_ID,
    ].filter((id): id is string => exists(guild, id) && member.roles.cache.has(id));
    if (toRemove.length) await member.roles.remove(toRemove, 'Retrait du staff (site)');
    if (exists(guild, joueur)) await member.roles.add(joueur, 'Retour joueur');
    return;
  }

  // staff.apply — réconcilie : le membre doit avoir EXACTEMENT les rôles voulus
  const gradeRoleIds = a.grades
    .map((g) => getGrade(g).roleId)
    .filter((id): id is string => exists(guild, id));
  const highest = Math.max(0, ...a.grades.map((g) => getGrade(g).level));
  const transverse = highest >= GRADES.responsable.level ? RESP_PLUS_ROLE_ID : STAFF_ROLE_ID;

  const desired = new Set<string>(gradeRoleIds);
  if (exists(guild, transverse)) desired.add(transverse);

  // Rôles gérés par la Gestion Staff (jamais fonda/co-fonda) → on réconcilie
  const managed = [
    ...Object.values(ALL_GRADES)
      .filter((g) => g.key !== 'fondateur' && g.key !== 'cofondateur')
      .map((g) => g.roleId),
    STAFF_ROLE_ID,
    RESP_PLUS_ROLE_ID,
    joueur,
  ].filter((id): id is string => exists(guild, id));

  const toAdd = [...desired].filter((id) => !member.roles.cache.has(id));
  const toRemove = managed.filter((id) => !desired.has(id) && member.roles.cache.has(id));
  if (toAdd.length) await member.roles.add(toAdd, 'Grade staff (site)');
  if (toRemove.length) await member.roles.remove(toRemove, 'MAJ staff (site)');
}

/** Messages automatiques de rank / départ (taverne + général staff) */
async function announceStaffChange(client: Client, a: PendingAction): Promise<void> {
  // Apply : on n'annonce que sur une promotion/création (pas un simple retrait de grade)
  if (a.type === 'staff.apply' && !a.announce) return;
  const pseudo = a.minecraft_pseudo;
  const taverne = await client.channels.fetch(CHANNELS.taverne).catch(() => null);
  const staffCh = await client.channels.fetch(CHANNELS.generalStaff).catch(() => null);

  if (a.type === 'staff.remove') {
    if (taverne?.isTextBased())
      await (taverne as TextChannel).send(`Merci à **${pseudo}** pour son travail dans le staff.`);
    if (staffCh?.isTextBased())
      await (staffCh as TextChannel).send(
        `Un grand merci à **${pseudo}** qui part vers de plus belles aventures !`,
      );
    return;
  }

  if (a.grades.length === 0) return;
  let top = a.grades[0]!;
  for (const g of a.grades) if (getGrade(g).level > getGrade(top).level) top = g;
  const grade = getGrade(top).label;

  if (taverne?.isTextBased())
    await (taverne as TextChannel).send(`Félicitations à **${pseudo}** qui passe **${grade}** !`);
  if (staffCh?.isTextBased())
    await (staffCh as TextChannel).send(
      `Félicitations à **${pseudo}** qui passe **${grade}**, accueillez-le comme il se doit !`,
    );
}

/** Surveillance d'une action staff faite DEPUIS LE SITE (auteur = pseudo site). */
async function logStaffSurveillance(client: Client, a: PendingAction): Promise<void> {
  if (!a.actor || !a.actor_grade) return;
  const cat = getGrade(a.actor_grade).surveillance;
  if (cat === 'none') return; // actions des fonda/co-fonda non surveillées
  await logSurveillance(client, {
    category: cat,
    action: a.type === 'staff.remove' ? 'Retrait du staff' : 'Grade staff mis à jour',
    actor: a.actor,
    target: a.minecraft_pseudo,
    source: 'site',
    fields: a.grades.length
      ? [{ name: 'Grades', value: a.grades.map((g) => getGrade(g).label).join(', ') }]
      : undefined,
  });
}
