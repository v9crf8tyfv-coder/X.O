/**
 * Définition centrale des GRADES.
 *
 * Un "grade" = un rang staff. Chaque grade est lié à :
 *   - une couleur (celle du rôle Discord, en hex sans #)
 *   - un ID de rôle Discord (à attribuer/retirer par le bot)
 *   - un niveau hiérarchique (level) — sert pour l'accès site et la surveillance
 *   - la catégorie de surveillance (dans quel salon les changements sont loggés)
 *
 * ⚠️ Certaines couleurs / IDs restent à compléter (marqués TODO).
 */

export type SurveillanceCategory = 'respo' | 'admin' | 'staff' | 'none';

export interface GradeDef {
  /** Clé stable utilisée en base et dans le code */
  key: string;
  /** Nom affiché (bulle de couleur sur le site, embeds) */
  label: string;
  /** Couleur du rôle Discord, hex SANS le # (ex "7cabca") */
  color: string;
  /** ID du rôle Discord correspondant */
  roleId: string | null;
  /** Niveau hiérarchique : plus grand = plus haut placé */
  level: number;
  /** Dans quel salon de surveillance les changements de ce grade sont loggés */
  surveillance: SurveillanceCategory;
  /** true = grade "responsable spécialisé" (Resp.X), sous-catégorie de Responsable */
  isRespoSpecialise?: boolean;
}

/**
 * Grades principaux.
 * Couleurs fournies : Responsable 811010, Dev a84300, admin dc1a1a,
 * fonda 7cabca, co-fonda 1a6594.
 */
export const GRADES = {
  fondateur: {
    key: 'fondateur',
    label: 'Fondateur',
    color: '7cabca',
    roleId: '1535320390908387479',
    level: 100,
    surveillance: 'none', // les actions des fonda ne sont PAS loggées
  },
  cofondateur: {
    key: 'cofondateur',
    label: 'Co-fondateur',
    color: '1a6594',
    roleId: '1535322549242699826',
    level: 90,
    surveillance: 'none',
  },
  responsable: {
    key: 'responsable',
    label: 'Responsable',
    color: '811010',
    roleId: '1535321330075828306',
    level: 70,
    surveillance: 'respo', // surveillés par les fonda
  },
  admin: {
    key: 'admin',
    label: 'Admin',
    color: 'dc1a1a',
    roleId: '1535321559252606986',
    level: 50,
    surveillance: 'admin', // surveillés par les respo
  },
  dev: {
    key: 'dev',
    label: 'Dev',
    color: 'e0a82b',
    roleId: '1535321787783446628',
    level: 40,
    surveillance: 'staff', // surveillés par les admin
  },
  buildeur: {
    key: 'buildeur',
    label: 'Buildeur',
    color: '3ba55d', // TODO: couleur exacte du rôle Discord à confirmer
    roleId: '1535321714731261972',
    level: 40,
    surveillance: 'staff',
  },
  com: {
    key: 'com',
    label: 'Communication / Graphiste',
    color: 'd98e2b', // TODO: couleur exacte du rôle Discord à confirmer
    roleId: '1535322033771118623',
    level: 40,
    surveillance: 'staff',
  },
  // Modo mentionné dans les catégories de tickets, mais aucun ID de rôle fourni.
  // TODO: ajouter roleId + couleur quand tu me les donnes.
  modo: {
    key: 'modo',
    label: 'Modérateur',
    color: '9b59b6', // violet
    roleId: '1535321625614880849',
    level: 30,
    surveillance: 'staff',
  },
  // Variantes Modérateur : distinctes UNIQUEMENT sur Discord (rôle + couleur).
  // IG et effectif = toujours "Modérateur" (voir sectionForGrades / normKey).
  modo_test: {
    key: 'modo_test',
    label: 'Modérateur test',
    color: 'a78bfa', // mauve plus clair
    roleId: '1544819766546407496',
    level: 30,
    surveillance: 'staff',
  },
  modo_x: {
    key: 'modo_x',
    label: 'Modérateur X',
    color: '6d28d9', // mauve plus foncé
    roleId: '1544819950542262332',
    level: 30,
    surveillance: 'staff',
  },
  // Bêta-testeur : grade bas (accès panel minimal = profil). Pas du staff.
  betatesteur: {
    key: 'betatesteur',
    label: 'Bêta-testeur',
    color: '7e8c9c',
    roleId: '1535332321635344494',
    level: 10,
    surveillance: 'staff',
  },
} as const satisfies Record<string, GradeDef>;

/**
 * Grades "Responsable spécialisé" (Resp.X).
 * Aucun ID de rôle Discord fourni pour l'instant → à compléter.
 */
export const GRADES_RESPO_SPECIALISE = {
  resp_admin: mkRespo('resp_admin', 'Resp. Admin'),
  resp_com: mkRespo('resp_com', 'Resp. Com'),
  resp_dev: mkRespo('resp_dev', 'Resp. Dev'),
  resp_build: mkRespo('resp_build', 'Resp. Build'),
  resp_infra: mkRespo('resp_infra', 'Resp. Infra'),
  resp_systeme: mkRespo('resp_systeme', 'Resp. Système'),
} as const satisfies Record<string, GradeDef>;

function mkRespo(key: string, label: string): GradeDef {
  return {
    key,
    label,
    color: '811010', // même famille que Responsable — TODO à ajuster
    roleId: null, // TODO: ID du rôle Discord
    level: 75, // au-dessus d'un responsable simple
    surveillance: 'respo',
    isRespoSpecialise: true,
  };
}

/** Tous les grades confondus, clé → définition */
export const ALL_GRADES: Record<string, GradeDef> = {
  ...GRADES,
  ...GRADES_RESPO_SPECIALISE,
};

export type GradeKey = keyof typeof GRADES | keyof typeof GRADES_RESPO_SPECIALISE;

/** Grade "joueur" par défaut (pas de staff) — bulle blanche, aucun rôle staff */
export const GRADE_JOUEUR = {
  key: 'joueur',
  label: 'Joueur',
  color: 'ffffff',
  roleId: '1535320757301936138',
  level: 0,
  surveillance: 'none' as SurveillanceCategory,
};

/** Retourne la def d'un grade par sa clé, ou le grade joueur si inconnu */
export function getGrade(key: string | null | undefined): GradeDef {
  if (!key) return GRADE_JOUEUR;
  return ALL_GRADES[key] ?? GRADE_JOUEUR;
}

/** Couleur d'un grade en entier (pour les EmbedBuilder discord.js) */
export function gradeColorInt(key: string | null | undefined): number {
  return parseInt(getGrade(key).color, 16);
}

/**
 * Clé de LOGO à utiliser pour un grade : les variantes partagent le même logo.
 * modo_test / modo_x → "modo", resp spécialisés → "responsable".
 * (Le rôle Discord et sa couleur restent distincts ; seul le logo est mutualisé.)
 */
export function gradeLogoKey(key: string | null | undefined): string {
  const k = String(key || '');
  if (k.startsWith('modo')) return 'modo';
  if (k === 'responsable' || k.startsWith('resp_')) return 'responsable';
  return k || 'joueur';
}

/** Est-ce un fondateur (ou co-fondateur) ? — non surveillé, accès max */
export function isFounderTier(key: string | null | undefined): boolean {
  return key === 'fondateur' || key === 'cofondateur';
}
