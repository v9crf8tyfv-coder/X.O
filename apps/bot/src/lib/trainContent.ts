/**
 * Contenu de l'ENTRAÎNEMENT modération.
 *
 * Le bot X.O simule de faux messages de joueurs qui enfreignent le règlement,
 * pour que les modos s'entraînent à réagir (`mute pseudo temps raison`).
 * Rien n'est envoyé à un vrai joueur : ce sont des messages FICTIFS d'entraînement.
 *
 * Les catégories servent juste à varier les cas. Tu peux librement ajouter,
 * retirer ou adoucir des lignes ci-dessous — c'est une base de départ.
 * (On évite volontairement les insultes les plus crues et les vraies injures
 *  discriminatoires : le but est de reconnaître le TYPE d'infraction, pas de
 *  reproduire des propos haineux réels.)
 */

export type TrainCategory =
  | 'insulte'
  | 'flood'
  | 'pub'
  | 'discrimination'
  | 'provocation'
  | 'spam'
  | 'ok';

export interface TrainLine {
  category: TrainCategory;
  /** Le faux message tel qu'il s'afficherait dans le chat */
  message: string;
}

/** Faux pseudos de joueurs (fictifs) */
export const FAKE_PSEUDOS = [
  'Zephyx_', 'Dark_Kaydo', 'NoobSlayer42', 'xTryHard', 'Miku_Chan',
  'CraftMaster', 'GhostyFR', 'Le_Boss_88', 'Snoopy_', 'ValoGod',
  'ptit_diamant', 'Kyrox', 'ToxicWave', 'BloodMoon_', 'Zeytoun',
  'Fantomas_', 'iShadow', 'RageQuit_', 'Melo_off', 'Wynn',
];

/**
 * Banque de messages fictifs, par catégorie.
 * Certains contiennent des fautes / abréviations exprès (réalisme du chat).
 */
export const TRAIN_LINES: TrainLine[] = [
  // --- insultes / manque de respect ---
  { category: 'insulte', message: 'ferme ta gueule tg' },
  { category: 'insulte', message: 'nique ta mère sale noob' },
  { category: 'insulte', message: 'fils de pute t’as cru quoi' },
  { category: 'insulte', message: 'connard dégage de la map' },
  { category: 'insulte', message: 'vous êtes tous des enculés sur ce serveur' },
  { category: 'insulte', message: 'ta gueule le bâtard personne t’a parlé' },
  { category: 'insulte', message: 'espèce de gros con t’es useless' },
  { category: 'insulte', message: 't’es qu’une merde va crever' },
  { category: 'insulte', message: 'pd va, t’sais même pas jouer' },
  { category: 'insulte', message: 'salope ferme la tu spam' },

  // --- provocation / toxicité ---
  { category: 'provocation', message: 'ce serveur est mort de toute façon, allez tous dodo' },
  { category: 'provocation', message: 'les modos servent à rien ici, aucun n’ose me sanctionner' },
  { category: 'provocation', message: 'jpp vous êtes tous des lows, farmez encore 10 ans' },
  { category: 'provocation', message: 'venez me kill si vous êtes des hommes, bande de peureux' },

  // --- flood ---
  { category: 'flood', message: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
  { category: 'flood', message: 'spam spam spam spam spam spam spam spam' },
  { category: 'flood', message: 'lol lol lol lol lol lol lol lol lol lol lol' },
  { category: 'flood', message: '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!' },

  // --- spam majuscules / mentions ---
  { category: 'spam', message: 'REGARDEZ MOI JE SUIS LE MEILLEUR DU SERVEUR AH AH AH' },
  { category: 'spam', message: '@everyone venez voir ma maison c’est urgent vite vite' },
  { category: 'spam', message: 'ADMIN ADMIN ADMIN ADMIN REPONDEZ MOI MAINTENANT' },

  // --- pub / autres serveurs ---
  { category: 'pub', message: 'venez sur play.autreserveur.fr c’est 1000x mieux qu’ici' },
  { category: 'pub', message: 'rejoins mon discord dm moi pour le lien c’est mieux' },
  { category: 'pub', message: 'ip du vrai bon serveur : mega-craft.net, celui là est nul' },

  // --- discrimination (formulations génériques, sans injures) ---
  { category: 'discrimination', message: 'retourne d’où tu viens on veut pas de toi ici' },
  { category: 'discrimination', message: 'les filles savent pas jouer, casse toi du serveur' },
  { category: 'discrimination', message: 'on se moque de ta religion, va prier ailleurs' },

  // --- messages CORRECTS : la bonne réponse est « rien » (aucune sanction) ---
  { category: 'ok', message: 'gg les gars belle partie, à demain !' },
  { category: 'ok', message: 'quelqu’un peut m’aider à construire ma base svp ?' },
  { category: 'ok', message: 'trop stylé ton build, bravo' },
  { category: 'ok', message: 'je vais manger je reviens dans 20 min' },
  { category: 'ok', message: 'wp l’équipe on a gagné le fight' },
];

/** Libellé lisible d'une catégorie (pour le log résultat) */
export const CATEGORY_LABEL: Record<TrainCategory, string> = {
  insulte: 'Insulte / irrespect',
  flood: 'Flood',
  pub: 'Publicité',
  discrimination: 'Discrimination',
  provocation: 'Provocation / toxicité',
  spam: 'Spam',
  ok: 'Message correct (aucune sanction)',
};

/** Tire une ligne + un pseudo au hasard */
export function pickChallenge(): { pseudo: string; line: TrainLine } {
  const line = TRAIN_LINES[Math.floor(Math.random() * TRAIN_LINES.length)]!;
  const pseudo = FAKE_PSEUDOS[Math.floor(Math.random() * FAKE_PSEUDOS.length)]!;
  return { pseudo, line };
}
