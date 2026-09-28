/**
 * URL de tête de joueur ROBUSTE pour les embeds (surveillances, effectif, votes…).
 *
 * Problème : mc-heads.net devient parfois capricieux (lenteur / 5xx / renvoi vide) et
 * l'icône d'embed reste alors CASSÉE (Discord ne peut pas retenter côté client).
 *
 * Solution : on passe par le proxy image wsrv.nl avec un `default` Steve garanti. Si la
 * source échoue, wsrv sert le Steve -> il y a TOUJOURS une image valide, plus de tête cassée.
 * mc-heads reste la source (meilleur skin par pseudo/UUID Mojang) ; pour un pseudo cracké
 * sans skin Mojang, on obtient un Steve (limite Mojang, pas un bug).
 */
export function headUrl(pseudoOrUuid: string, size = 64): string {
  // crafthead.net = vrai skin fiable (mc-heads servait un Steve en cache pour certains
  // comptes premium). Proxifié via wsrv.nl avec un default Steve : si crafthead renvoie
  // 404 (pseudo inconnu/cracké), wsrv sert le Steve -> jamais d'avatar cassé.
  const src = `crafthead.net/avatar/${encodeURIComponent(pseudoOrUuid)}/${size}`;
  const steve = `https://minotar.net/helm/MHF_Steve/${size}.png`;
  return `https://wsrv.nl/?url=${encodeURIComponent(src)}&w=${size}&h=${size}&default=${encodeURIComponent(steve)}`;
}
