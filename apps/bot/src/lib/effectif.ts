import { GRADES } from '@xo/shared';

/** Seuls ces grades apparaissent dans l'effectif (du plus haut au plus bas) */
const ORDER = ['responsable', 'admin', 'dev', 'buildeur', 'modo'] as const;

/** Noms affichés dans l'effectif */
const LABEL: Record<string, string> = {
  responsable: 'Responsables',
  admin: 'Administrateur',
  dev: 'Développeur',
  buildeur: 'Buildeur',
  modo: 'Modérateur',
};

/** Emojis custom (logos Discord). Responsable & Buildeur : à venir. */
const EMOJI: Record<string, string> = {
  admin: '<:LogoAdmin:1535740524240175114>',
  dev: '<:LogoDev:1535740345684598835>',
};

/** Le grade "effectif" d'un staff = le plus haut parmi ORDER, ou null */
function effectifGrade(grades: string[]): string | null {
  let best: string | null = null;
  let lvl = -1;
  for (const gk of grades) {
    if ((ORDER as readonly string[]).includes(gk)) {
      const l = GRADES[gk as keyof typeof GRADES]?.level ?? -1;
      if (l > lvl) {
        lvl = l;
        best = gk;
      }
    }
  }
  return best;
}

export interface EffectifRow {
  pseudo: string;
  grades: string[];
  is_absent: boolean;
}

/** Construit le texte de l'effectif (pseudos Minecraft, groupés par grade) */
export function buildEffectif(rows: EffectifRow[]): string {
  const lines: string[] = [];
  for (const key of ORDER) {
    const members = rows.filter((r) => effectifGrade(r.grades) === key);
    const actifs = members.filter((m) => !m.is_absent).map((m) => m.pseudo);
    const absents = members.filter((m) => m.is_absent).map((m) => m.pseudo);
    const emoji = EMOJI[key] ? `${EMOJI[key]} ` : '';
    lines.push(`${emoji}**${LABEL[key]} (${members.length}) :**`);
    lines.push(actifs.length ? actifs.join(', ') : '---');
    if (absents.length) lines.push(`⏰ **Absent :** ${absents.join(', ')}`);
    lines.push('');
  }
  return lines.join('\n').trim() || '*Aucun staff.*';
}
