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

/** Section d'effectif correspondant à UN grade (ou null si non affiché). */
function sectionOf(gk: string): string | null {
  if (gk === 'responsable' || gk.startsWith('resp_')) return 'responsable';
  if (gk === 'modo' || gk.startsWith('modo')) return 'modo'; // modo_test / modo_x = Modérateur
  if (gk === 'admin' || gk === 'buildeur' || gk === 'com' || gk === 'betatesteur') return gk;
  return null; // fonda / co-fonda / dev / joueur = pas d'effectif
}

/**
 * Section d'effectif d'un staff : celle de son PLUS GROS rôle, selon l'ORDRE
 * de la hiérarchie EFFECTIF_SECTIONS (Responsable > Admin > Modérateur > Buildeur
 * > Communication > Bêta-testeur) — pas selon le level brut. Ainsi un membre
 * Modérateur + Communication est classé Modérateur (le rôle le plus haut).
 */
export function sectionForGrades(grades: string[]): string | null {
  const sections = new Set(grades.map(sectionOf).filter(Boolean) as string[]);
  for (const sec of EFFECTIF_SECTIONS) if (sections.has(sec.key)) return sec.key;
  return null;
}
