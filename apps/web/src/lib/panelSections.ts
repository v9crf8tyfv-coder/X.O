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
}

export const PANEL_SECTIONS: PanelSectionDef[] = [
  { id: 'profil', label: 'Profil', icon: '', defaultLevel: 0 },
  { id: 'liens', label: 'Liens utiles', icon: '🔗', defaultLevel: 50 },
  { id: 'staff', label: 'Gestion Staff', icon: '🧑‍💼', defaultLevel: 50, soon: true },
  { id: 'serveurs', label: 'Gestion Serveurs', icon: '🖥️', defaultLevel: 90 },
  { id: 'playtime', label: 'Temps de jeu', icon: '⏱️', defaultLevel: 50 },
  { id: 'reseaux', label: 'Gestion Réseaux', icon: '', defaultLevel: 70, soon: true },
  { id: 'sanctions', label: 'Gestion Sanction(s)', icon: '', defaultLevel: 50 },
  { id: 'affiches', label: 'Affiches', icon: '', defaultLevel: 50 },
  { id: 'formation', label: 'Gestion Formation', icon: '', defaultLevel: 50, extraGrade: 'modo_x' },
  { id: 'launcher', label: 'Launcher', icon: '🚀', defaultLevel: 90 },
  { id: 'support', label: 'Support', icon: '🎫', defaultLevel: 90 },
  { id: 'trafic', label: 'Trafic du site', icon: '📈', defaultLevel: 90 },
  { id: 'automsg', label: 'Messages auto', icon: '💬', defaultLevel: 90 },
  { id: 'site', label: 'Gestion Site', icon: '🔐', defaultLevel: 90 },
  { id: 'acces', label: 'Accès (Fonda)', icon: '🔑', defaultLevel: 100, founderOnly: true },
];

/** Paliers proposés dans l'UI de config d'accès (par grade). */
export const ACCESS_LEVELS: { label: string; level: number }[] = [
  { label: 'Tout le monde', level: 0 },
  { label: 'Modérateur et +', level: 30 },
  { label: 'Admin et +', level: 50 },
  { label: 'Responsable et +', level: 70 },
  { label: 'Co-fondateur et +', level: 90 },
  { label: 'Fondateur', level: 100 },
];
