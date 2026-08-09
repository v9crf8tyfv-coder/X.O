import type { Client, Guild, GuildMember } from 'discord.js';
import { db, hasDatabase } from '@xo/db';
import {
  ALL_GRADES,
  GRADE_JOUEUR,
  GRADES,
  STAFF_ROLE_ID,
  RESP_PLUS_ROLE_ID,
  getGrade,
} from '@xo/shared';
import { ENV } from '../env.js';
import { publishEffectif } from '../lib/effectifPublish.js';

interface PendingAction {
  id: string;
  type: string; // 'staff.apply' | 'staff.remove'
  discord_tag: string;
  minecraft_pseudo: string;
  grades: string[];
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
}

async function tick(client: Client): Promise<void> {
  if (running) return;
  running = true;
  try {
    const actions = await db()<PendingAction[]>`
      select id, type, discord_tag, minecraft_pseudo, grades
      from pending_actions where status = 'pending' order by created_at asc limit 10
    `;
    if (actions.length === 0) return;

    const guild = await client.guilds.fetch(ENV.DISCORD_GUILD_ID).catch(() => null);
    if (!guild) return;

    for (const a of actions) {
      try {
        await processAction(guild, a);
        await db()`update pending_actions set status='done', processed_at=now() where id=${a.id}`;
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

  // staff.apply
  const gradeRoleIds = a.grades
    .map((g) => getGrade(g).roleId)
    .filter((id): id is string => exists(guild, id));
  const highest = Math.max(0, ...a.grades.map((g) => getGrade(g).level));
  const transverse = highest >= GRADES.responsable.level ? RESP_PLUS_ROLE_ID : STAFF_ROLE_ID;
  const opposite = highest >= GRADES.responsable.level ? STAFF_ROLE_ID : RESP_PLUS_ROLE_ID;

  const toAdd = [...gradeRoleIds];
  if (exists(guild, transverse)) toAdd.push(transverse);
  if (toAdd.length) await member.roles.add(toAdd, 'Grade staff (site)');

  const toRemove = [opposite, joueur].filter(
    (id): id is string => exists(guild, id) && member.roles.cache.has(id),
  );
  if (toRemove.length) await member.roles.remove(toRemove, 'MAJ staff (site)');
}
