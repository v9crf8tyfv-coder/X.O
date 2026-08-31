import { getGrade } from '@xo/shared';

export interface EffectifRow {
  pseudo: string;
  grades: string[];
  discord_id: string | null;
  is_absent: boolean;
}

export interface EffectifSection {
  key: string;
  label: string;
  emoji: string; // nom de l'emoji Discord (résolu au runtime via le serveur)
  color: number;
}

/**
 * Sections de l'effectif (du plus haut au plus bas).
 * Exclut fondateur, co-fondateur, dev, com (et joueur).
 */
export const EFFECTIF_SECTIONS: EffectifSection[] = [
  { key: 'responsable', label: 'Responsable', emoji: 'LogoResp', color: 0x8b1a1a },
  { key: 'admin', label: 'Administrateur', emoji: 'LogoAdmin', color: 0xdc2626 },
  { key: 'modo', label: 'Modérateur', emoji: 'LogoModo', color: 0x9333ea },
  { key: 'buildeur', label: 'Buildeur', emoji: 'LogoBuildeur', color: 0x65a30d },
  { key: 'com', label: 'Communication', emoji: 'LogoCom', color: 0xb14fd6 },
  { key: 'betatesteur', label: 'Bêta-testeur', emoji: 'LogoBetaTest', color: 0x9ca3af },
];

/** Clé du grade le plus haut (par niveau) d'un membre. */
function highestGradeKey(grades: string[]): string | null {
  let best: string | null = null;
  let lvl = -1;
  for (const gk of grades) {
    const g = getGrade(gk);
    if (g.level > lvl) {
      lvl = g.level;
      best = gk;
    }
  }
  return best;
}

/**
 * Section d'effectif d'un staff, ou null s'il n'apparaît pas.
 * (fonda/co-fonda/dev/com/joueur = pas affichés)
 */
export function sectionForGrades(grades: string[]): string | null {
  const top = highestGradeKey(grades);
  if (!top) return null;
  if (top === 'responsable' || top.startsWith('resp_')) return 'responsable';
  if (top === 'admin' || top === 'buildeur' || top === 'modo' || top === 'com' || top === 'betatesteur') return top;
  return null;
}
