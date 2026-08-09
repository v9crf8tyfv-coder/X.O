/**
 * Configuration du serveur Discord : IDs de salons, catégories de tickets, etc.
 * Tout ce qui est propre à TON serveur est centralisé ici.
 */

/** IDs des salons Discord (fournis) */
export const CHANNELS = {
  absences: '1535379206899376199',
  archivesAbsence: '1535379371718610984',
  surveillanceRespo: '1535344008287756328',
  surveillanceAdmin: '1535344050729652364',
  surveillanceStaff: '1535344092534276096',
  accueil: '1535380217257005148',
  ticketStaff: '1535383806452965376',
  ticketNormal: '1535383613263183883',
  archivesTicket: '1535421887121985566',
  taverne: '1535347207195328652', // annonces de rank (public)
  generalStaff: '1535333104733003896', // annonces de rank (staff)
} as const;

/**
 * Rôles "présents partout" dans les tickets : peuvent répondre à TOUTES
 * les catégories même sans être explicitement listés.
 * (Fondateurs, Co-fondateurs, Responsables)
 */
export const TICKET_OMNIPRESENT_GRADES = ['fondateur', 'cofondateur', 'responsable'] as const;

/**
 * Catégories de tickets STAFF (salon ticketStaff).
 * `allowedGrades` = grades autorisés à voir/répondre (EN PLUS des omniprésents).
 */
export const TICKET_CATEGORIES_STAFF = [
  {
    id: 'bug_report_staff',
    label: 'Bug Report',
    description: 'Signaler un bug (modo, admin)',
    emoji: '🐛',
    allowedGrades: ['modo', 'admin'],
  },
  {
    id: 'besoin_parler_admins',
    label: 'Besoin de Parler (Admins)',
    description: 'Discussion admin/responsable',
    emoji: '💬',
    allowedGrades: ['admin', 'responsable'],
  },
  {
    id: 'besoin_parler_respo',
    label: 'Besoin de Parler (Respo)',
    description: 'Réservé aux responsables',
    emoji: '🗣️',
    allowedGrades: [], // only responsables (via omniprésents)
    onlyOmnipresent: true,
  },
  {
    id: 'erreur_sanctions',
    label: 'Erreur de Sanctions',
    description: 'Signaler une erreur de sanction (admin, respo)',
    emoji: '⚠️',
    allowedGrades: ['admin', 'responsable'],
  },
] as const;

/**
 * Catégories de tickets JOUEURS (salon ticketNormal).
 */
export const TICKET_CATEGORIES_NORMAL = [
  {
    id: 'question_gameplay',
    label: 'Question Gameplay',
    description: 'Une question sur le jeu (modo)',
    emoji: '🎮',
    allowedGrades: ['modo'],
  },
  {
    id: 'besoin_responsable',
    label: 'Besoin Responsable',
    description: 'Parler à un responsable',
    emoji: '📞',
    allowedGrades: [],
    onlyOmnipresent: true, // only responsables
  },
  {
    id: 'recrutement_com',
    label: 'Recrutement COM',
    description: 'Candidature communication',
    emoji: '📢',
    allowedGrades: ['com', 'admin'],
  },
  {
    id: 'recrutement_staff',
    label: 'Recrutement Staff',
    description: 'Candidature staff (admin, resp, fonda)',
    emoji: '📝',
    allowedGrades: ['admin'],
  },
  {
    id: 'bug_report_normal',
    label: 'Bug Report',
    description: 'Signaler un bug (modo, admin)',
    emoji: '🐛',
    allowedGrades: ['modo', 'admin'],
  },
  {
    id: 'report_staff',
    label: "Report d'un Staff",
    description: 'Erreur ou abus de staff (responsable)',
    emoji: '🚨',
    allowedGrades: [],
    onlyOmnipresent: true, // only responsables
  },
] as const;

export type TicketCategory =
  | (typeof TICKET_CATEGORIES_STAFF)[number]
  | (typeof TICKET_CATEGORIES_NORMAL)[number];

// Rôle "transverse" du staff, en plus du grade. C'est l'UN OU l'AUTRE :
/** Staff SOUS responsable (modo/dev/build/com/admin/beta) → ce rôle */
export const STAFF_ROLE_ID = '1535321928477446196';
/** Staff À PARTIR de responsable → ce rôle (à la place de STAFF_ROLE_ID) */
export const RESP_PLUS_ROLE_ID = '1535324397768806500';

/** ID Discord du propriétaire (ixtazzking) — seul autorisé pour /blockfull */
export const OWNER_DISCORD_ID = '1098211189059756115';

/** Couleur de marque du bot X.O (embeds génériques) */
export const BRAND_COLOR = 0x5865f2; // violet Discord — TODO: couleur finale du serveur
