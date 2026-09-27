/** Registre central des sections du panel + leur niveau d'accès par défaut. */
export interface PanelSectionDef {
  id: string;
  label: string;
  icon: string;
  /** Niveau (grade) minimum par défaut pour voir la section. */
  defaultLevel: number;
  soon?: boolean;
  /** Réservé aux fondateurs, non configurable (ex : la config d'accès elle-même). */
  founderOnly?: boolean;
  /** Grade qui a accès EN PLUS du niveau (ex : modo_x pour la formation). */
  extraGrade?: string;
  /** Numéro de groupe : un séparateur s'affiche quand il change (organisation visuelle). */
  group: number;
}

// Ordre + regroupement de la sidebar. `group` sert UNIQUEMENT à l'affichage
// (un trait de séparation apparaît quand le numéro change). Aucune permission
// n'est modifiée ici : defaultLevel / founderOnly / extraGrade sont inchangés.
export const PANEL_SECTIONS: PanelSectionDef[] = [
  // — Groupe 1 : perso —
  { id: 'profil', label: 'Profil', icon: '👤', defaultLevel: 0, group: 1 },
  { id: 'liens', label: 'Liens utiles', icon: '🔗', defaultLevel: 50, group: 1 },
  // — Groupe 2 : staff —
  { id: 'staff', label: 'Gestion Staff', icon: '🧑‍💼', defaultLevel: 50, soon: true, group: 2 },
  { id: 'rp', label: 'Gestion RP', icon: '🎭', defaultLevel: 70, extraGrade: 'opresp_rp', group: 2 },
  { id: 'suivis', label: 'Suivis Staff', icon: '📋', defaultLevel: 50, group: 2 },
  // — Groupe 3 : gestion —
  { id: 'formation', label: 'Gestion Formation', icon: '🎓', defaultLevel: 50, extraGrade: 'modo_x', group: 3 },
  { id: 'sanctions', label: 'Gestion Sanction(s)', icon: '⚖️', defaultLevel: 50, group: 3 },
  { id: 'serveurs', label: 'Gestion Serveurs', icon: '🖥️', defaultLevel: 90, group: 3 },
  { id: 'reseaux', label: 'Gestion Réseaux', icon: '📡', defaultLevel: 70, soon: true, group: 3 },
  { id: 'site', label: 'Gestion Site', icon: '🔐', defaultLevel: 90, group: 3 },
  // — Groupe 4 : visuel —
  { id: 'da', label: 'DA', icon: '🎨', defaultLevel: 40, group: 4 },
  { id: 'affiches', label: 'Affiches', icon: '🪧', defaultLevel: 50, group: 4 },
  { id: 'skins3d', label: 'Skins 3D', icon: '🧍', defaultLevel: 90, group: 4 },
  { id: 'fond', label: 'Arrière-plan site', icon: '🖼️', defaultLevel: 70, group: 4 },
  // — Groupe 5 : outils / jeu —
  { id: 'launcher', label: 'Launcher', icon: '🚀', defaultLevel: 90, group: 5 },
  { id: 'customitems', label: 'Items custom', icon: '🛠️', defaultLevel: 50, group: 5 },
  { id: 'cmdblocks', label: 'Command blocks', icon: '🧱', defaultLevel: 90, group: 5 },
  { id: 'automsg', label: 'Messages auto', icon: '💬', defaultLevel: 50, group: 5 },
  { id: 'linkemeria', label: 'Link Emeria', icon: '🔗', defaultLevel: 50, group: 5 },
  { id: 'zones', label: 'Zones', icon: '🗺️', defaultLevel: 45, group: 5 },
  { id: 'support', label: 'Support', icon: '🎫', defaultLevel: 90, group: 5 },
  // — Groupe 6 : stats —
  { id: 'trafic', label: 'Trafic du site', icon: '📈', defaultLevel: 90, group: 6 },
  { id: 'entree', label: "Statistiques d'entrée", icon: '📊', defaultLevel: 70, group: 6 },
  // — Groupe 7 : Fonda (toujours en bas) —
  { id: 'acces', label: 'Accès (Fonda)', icon: '🔑', defaultLevel: 100, founderOnly: true, group: 7 },
];

/**
 * Grades sélectionnables dans l'UI de config d'accès.
 * On coche 1 ou plusieurs grades par catégorie. Aucun coché = accès par défaut (niveau).
 */
export const ACCESS_GRADES: { key: string; label: string }[] = [
  { key: 'joueur', label: 'Joueur' },
  { key: 'betatesteur', label: 'Bêta-testeur' },
  { key: 'com', label: 'Com / Graphiste' },
  { key: 'buildeur', label: 'Buildeur' },
  { key: 'dev', label: 'Dev' },
  { key: 'modo', label: 'Modérateur' },
  { key: 'modo_test', label: 'Modérateur Test' },
  { key: 'modo_x', label: 'Modérateur X' },
  { key: 'admin', label: 'Admin' },
  { key: 'responsable', label: 'Responsable' },
  { key: 'cofondateur', label: 'Co-fondateur' },
  { key: 'fondateur', label: 'Fondateur' },
];
