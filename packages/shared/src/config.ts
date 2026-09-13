/**
 * Configuration du serveur Discord : IDs de salons, catégories de tickets, etc.
 * Tout ce qui est propre à TON serveur est centralisé ici.
 */

/** IDs des salons Discord (fournis) */
export const CHANNELS = {
  // --- Salons STAFF : sur le NOUVEAU Discord staff (le bot doit y être invité) ---
  absences: '1548684777941372948',
  archivesAbsence: '1548691590321668137',
  ticketStaff: '1548691307600412783',
  archivesTicketStaff: '1548691693816119487', // transcripts des tickets STAFF
  trainModo: '1548688291941978112', // salon "train modo" : panneau + faux messages à modérer
  trainResultat: '1548688419121799238', // salon "résultats" : log des sanctions d'entraînement
  // Surveillance : sur le NOUVEAU Discord staff.
  surveillanceRespo: '1548689103149732013',
  surveillanceAdmin: '1548688857099145216',
  surveillanceStaff: '1548688673430708315',
  // --- Salons du serveur COMMUNAUTÉ (principal) ---
  accueil: '1535380217257005148',
  ticketNormal: '1535383613263183883',
  archivesTicketNormal: '1535421887121985566', // transcripts des tickets JOUEURS
  taverne: '1535347207195328652', // annonces de rank (public)
  generalStaff: '1535333104733003896', // annonces de rank (staff)
  lancerJeu: '1535350366382719037', // embed "lancer le jeu"
} as const;

/**
 * Rôles "présents partout" dans les tickets : peuvent répondre à TOUTES
 * les catégories même sans être explicitement listés.
 * (Fondateurs, Co-fondateurs, Responsables)
 */
export const TICKET_OMNIPRESENT_GRADES = ['fondateur', 'cofondateur', 'responsable'] as const;

/**
 * Rôles du NOUVEAU Discord staff (grade -> roleId sur le serveur staff).
 * Utilisés EN PLUS des rôles du serveur principal (getGrade().roleId) : le bot n'applique
 * que les rôles réellement présents sur le serveur où il agit -> aucun conflit entre les 2.
 * (Admin : à compléter quand l'ID sera fourni.)
 */
export const STAFF_GUILD_ROLE_IDS: Record<string, string> = {
  responsable: '1548681983050121477',
  admin: '1548694010388811836',
  modo_x: '1548682473150619648',
  modo: '1548682543161810995',
  modo_test: '1548682651983028355',
  betatesteur: '1548682710724116530',
  buildeur: '1548682782027550780',
};

/** ID du NOUVEAU serveur Discord staff (pour y déployer aussi les commandes slash). */
export const STAFF_GUILD_ID = '1548681178771623948';

/**
 * Rôles "TAG" du Discord staff, donnés EN PLUS du rôle de grade, selon le grade :
 *  - modo  : si le membre a Modo / Modo Test / Modo X
 *  - op    : si le membre est Admin
 *  - staff : pour tous les autres grades staff
 * (Super modo : à ajouter plus tard.) Réconciliés : le tag suit le grade et part
 * automatiquement quand le membre n'a plus de grade de la catégorie.
 */
export const STAFF_TAG_ROLE_IDS = {
  modo: '1548682937560600737',
  op: '1548682958225809408',
  staff: '1548682889757986846',
} as const;

/**
 * Catégories de tickets STAFF (salon ticketStaff).
 * `allowedGrades` = grades autorisés à voir/répondre (EN PLUS des omniprésents).
 */
export const TICKET_CATEGORIES_STAFF = [
  {
    id: 'divers_staff',
    label: 'Divers',
    description: 'Ticket général (bug, question, erreur…)',
    emoji: '📩',
    allowedGrades: ['modo', 'admin'],
  },
  {
    id: 'besoin_responsable_staff',
    label: 'Besoin Responsable',
    description: 'Réservé aux responsables',
    emoji: '🗣️',
    allowedGrades: [], // uniquement responsables (via omniprésents)
    onlyOmnipresent: true,
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
  // Tickets de candidature retirés : les candidatures passent désormais par le
  // forum du site (emeria-site.com/forum → embed Discord + bouton "Traité").
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
  {
    id: 'probleme_launcher',
    label: 'Problème launcher',
    description: 'Souci avec le launcher EmeriaMC',
    emoji: '🖥️',
    allowedGrades: ['dev', 'admin'], // + omniprésents (fonda, cofonda, resp)
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

/** Rôle donné à l'arrivée (accès à un seul salon, tant que la source n'est pas choisie). */
export const ROLE_INCONNU = '1538983147473993778';

/** "Comment as-tu connu EmeriaMC ?" — options du menu d'entrée + libellés des stats. */
export const ENTRY_SOURCES: { value: string; label: string; emoji: string }[] = [
  { value: 'bouche', label: 'Bouche à oreille', emoji: '🗣️' },
  { value: 'staff', label: "Demande d'un staff", emoji: '🛡️' },
  { value: 'invite', label: 'Invitation Discord', emoji: '💌' },
  { value: 'tag', label: 'Tags Discord', emoji: '🏷️' },
  { value: 'site', label: 'Site internet', emoji: '🌐' },
  { value: 'event', label: 'Un event', emoji: '🎉' },
  { value: 'forum', label: 'Un forum', emoji: '💬' },
  { value: 'vote', label: 'Un site de vote', emoji: '🗳️' },
  { value: 'video', label: 'Une vidéo', emoji: '🎬' },
  { value: 'tiktok', label: 'TikTok / Shorts', emoji: '📱' },
  { value: 'reseau', label: 'Un autre réseau', emoji: '🔗' },
  { value: 'autre', label: 'Autre', emoji: '✨' },
];
