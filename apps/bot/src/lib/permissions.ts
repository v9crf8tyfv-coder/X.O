import type { GuildMember } from 'discord.js';
import { ALL_GRADES, GRADES, getGrade, type GradeDef } from '@xo/shared';

/** Map inverse : roleId Discord -> clé de grade */
const ROLE_TO_GRADE = new Map<string, string>();
for (const g of Object.values(ALL_GRADES)) {
  if (g.roleId) ROLE_TO_GRADE.set(g.roleId, g.key);
}

/** Grades (clés) que possède un membre, d'après ses rôles Discord */
export function memberGradeKeys(member: GuildMember): string[] {
  const keys: string[] = [];
  for (const roleId of member.roles.cache.keys()) {
    const key = ROLE_TO_GRADE.get(roleId);
    if (key) keys.push(key);
  }
  return keys;
}

/** Grade le plus élevé d'un membre (par level), ou null si aucun */
export function highestGrade(member: GuildMember): GradeDef | null {
  let best: GradeDef | null = null;
  for (const key of memberGradeKeys(member)) {
    const g = getGrade(key);
    if (!best || g.level > best.level) best = g;
  }
  return best;
}

/** Le membre est-il fondateur ? */
export function isFounder(member: GuildMember): boolean {
  return GRADES.fondateur.roleId
    ? member.roles.cache.has(GRADES.fondateur.roleId)
    : false;
}

/** Le membre est-il fondateur OU co-fondateur ? */
export function isFounderTierMember(member: GuildMember): boolean {
  const co = GRADES.cofondateur.roleId;
  return isFounder(member) || (co ? member.roles.cache.has(co) : false);
}
