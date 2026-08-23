import { ALL_GRADES, getGrade, type SurveillanceCategory } from '@xo/shared';
import type { GuildMember } from 'discord.js';

/** roleId -> clé de grade (uniquement les rôles-grades). */
const ROLE_TO_GRADE = new Map<string, string>();
for (const g of Object.values(ALL_GRADES)) {
  if (g.roleId) ROLE_TO_GRADE.set(g.roleId, g.key);
}

/** Catégorie de surveillance d'un membre = celle de son grade le plus élevé ('none' = pas surveillé). */
export function memberSurveillanceCategory(member: GuildMember): SurveillanceCategory {
  let best: SurveillanceCategory = 'none';
  let lvl = -1;
  for (const roleId of member.roles.cache.keys()) {
    const gk = ROLE_TO_GRADE.get(roleId);
    if (!gk) continue;
    const g = getGrade(gk);
    if (g.level > lvl) {
      lvl = g.level;
      best = g.surveillance;
    }
  }
  return best;
}
