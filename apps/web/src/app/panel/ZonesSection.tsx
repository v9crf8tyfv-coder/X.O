'use client';

import type { CSSProperties } from 'react';

/**
 * Zones (WorldEdit-like) — référence des commandes en jeu.
 * Les zones vivent DANS le jeu (EmeriaCore). La gestion visuelle depuis le panel
 * (voir/éditer/supprimer) nécessite un pont jeu <-> panel : à brancher ensuite.
 */
export default function ZonesSection() {
  const card: CSSProperties = {
    background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.10)',
    borderRadius: 12, padding: '14px 16px', margin: '0 0 12px',
  };
  const code: CSSProperties = {
    display: 'inline-block', background: 'rgba(0,0,0,.35)', border: '1px solid rgba(255,255,255,.12)',
    borderRadius: 6, padding: '2px 8px', margin: '2px 0', fontFamily: 'monospace', fontSize: 13, color: '#cbd5ff',
  };
  const muted: CSSProperties = { color: 'var(--muted,#8a8a94)', fontSize: 13, margin: '2px 0 0' };
  const Row = ({ cmd, desc }: { cmd: string; desc: string }) => (
    <div style={{ margin: '8px 0' }}>
      <span style={code}>{cmd}</span>
      <p style={muted}>{desc}</p>
    </div>
  );

  return (
    <div className="site-section">
      <div className="site-head">
        <div>
          <h2>Zones</h2>
          <p className="site-sub">Zones type WorldEdit + commande de zone. Accès Super-Modérateur et au-dessus.</p>
        </div>
      </div>

      <div style={card}>
        <h3 style={{ margin: '0 0 6px' }}>Créer / gérer (en jeu)</h3>
        <Row cmd="/eZone" desc="Donne l'outil (pelle). Clic gauche = point 1, clic droit = point 2. Le contour est visible." />
        <Row cmd="/eZone <nom> <commande>" desc="Ajoute une commande à la zone (plusieurs possibles). Ex : givemoney {player} 100 (chaque joueur dans la zone gagne 100), ou tp @e ~ ~5 ~ (les entités de la zone)." />
        <Row cmd="/eZone <nom>" desc="Exécute toutes les commandes de la zone." />
        <Row cmd="/eZone <nom> info" desc="Liste les commandes de la zone." />
        <Row cmd="/eZone <nom> clear" desc="Vide les commandes (garde la zone)." />
        <Row cmd="/erZone <nom>" desc="Supprime la zone." />
        <Row cmd="/esel" desc="Annule la sélection en cours." />
      </div>

      <div style={card}>
        <h3 style={{ margin: '0 0 6px' }}>Sur un panneau</h3>
        <p style={muted}>Mets <span style={{ ...code, margin: 0 }}>/eZone &lt;nom&gt;</span> sur un panneau : au clic, la zone se déclenche pour tout le monde à l'intérieur (autorité serveur, aucune perm de commande requise pour les joueurs).</p>
      </div>

      <div style={card}>
        <h3 style={{ margin: '0 0 6px' }}>Permission</h3>
        <p style={muted}>Gardé par <span style={{ ...code, margin: 0 }}>emeria.zone</span>. À donner aux groupes voulus (supermodo, admin…) via LuckPerms. Le nœud parapluie <span style={{ ...code, margin: 0 }}>emeria</span> le couvre déjà.</p>
      </div>

      <p style={{ ...muted, marginTop: 10 }}>
        La gestion visuelle des zones depuis le panel (voir / éditer / supprimer à distance) arrive ensuite — elle demande un pont jeu ↔ panel via la base du jeu.
      </p>
    </div>
  );
}
