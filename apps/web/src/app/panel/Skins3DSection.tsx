'use client';

import { useState } from 'react';

const NMSR = 'https://nmsr.nickac.dev';

// Modes de rendu NMSR (haute qualité 3D : ombres, relief, épaisseur).
const MODES: { id: string; label: string }[] = [
  { id: 'fullbody', label: 'Corps entier' },
  { id: 'fullbodyiso', label: 'Isométrique' },
  { id: 'frontfull', label: 'De face' },
  { id: 'bust', label: 'Buste' },
  { id: 'face', label: 'Visage' },
  { id: 'head', label: 'Tête' },
];

export default function Skins3DSection() {
  const [pseudo, setPseudo] = useState('');
  const [target, setTarget] = useState(''); // pseudo réellement rendu
  const [mode, setMode] = useState('fullbody');
  const [arms, setArms] = useState(0); // écartement/levée des bras
  const [yaw, setYaw] = useState(0); // rotation horizontale
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [bust, setBust] = useState(0); // pour forcer le rechargement de l'image

  // Résolution max acceptée par NMSR (~1024 px ; un peu moins pour les vues en pied très hautes).
  const width = mode === 'fullbody' || mode === 'frontfull' ? 1000 : 1024;
  const showPose = mode === 'fullbody' || mode === 'frontfull' || mode === 'fullbodyiso';
  const url = (() => {
    if (!target) return '';
    const p = new URLSearchParams({ width: String(width) });
    if (showPose && arms) p.set('arms', String(arms));
    if (showPose && yaw) p.set('yaw', String(yaw));
    if (bust) p.set('_', String(bust));
    return `${NMSR}/${mode}/${encodeURIComponent(target)}?${p.toString()}`;
  })();

  function generate() {
    const p = pseudo.trim();
    if (p.length < 2) { setMsg('Entre un pseudo (2 caractères min).'); return; }
    setMsg('');
    setTarget(p);
    setBust(Date.now());
  }

  async function download() {
    if (!url) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error('bad');
      const blob = await res.blob();
      const a = document.createElement('a');
      const href = URL.createObjectURL(blob);
      a.href = href;
      a.download = `${target}-${mode}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch {
      // Repli : ouvre l'image (clic droit → Enregistrer l'image).
      window.open(url, '_blank', 'noopener');
      setMsg("Téléchargement direct bloqué : l'image s'est ouverte, fais clic droit → Enregistrer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 860 }}>
      <h2 className="section-title">Skins 3D</h2>
      <p className="section-sub">
        Rendu 3D haute qualité d&apos;un skin (ombres, relief, épaisseur) à partir du pseudo Minecraft.
        Fond transparent — parfait pour tes affiches et montages.
      </p>

      {/* Contrôles */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '16px 0' }}>
        <input
          type="text"
          value={pseudo}
          placeholder="Pseudo Minecraft…"
          onChange={(e) => setPseudo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && generate()}
          style={{
            flex: '1 1 220px', padding: '11px 13px', borderRadius: 10, border: '1px solid var(--line)',
            background: 'rgba(255,255,255,.04)', color: 'var(--txt)', font: 'inherit',
          }}
        />
        <button onClick={generate} className="btn-accent" style={{ padding: '11px 20px', borderRadius: 10 }}>
          Générer
        </button>
      </div>

      {/* Poses / modes */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => { setMode(m.id); if (target) setBust(Date.now()); }}
            style={{
              padding: '7px 14px', borderRadius: 999, cursor: 'pointer', font: 'inherit', fontSize: 13, fontWeight: 700,
              border: '1px solid ' + (mode === m.id ? '#7c5cff' : 'var(--line)'),
              background: mode === m.id ? '#7c5cff' : 'transparent',
              color: mode === m.id ? '#fff' : 'var(--txt)',
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Pose : bras + rotation (uniquement sur les vues en pied) */}
      {showPose && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18, maxWidth: 520 }}>
          <label style={{ fontSize: 13 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Bras : {arms}°</div>
            <input type="range" min={-15} max={90} value={arms} onChange={(e) => setArms(Number(e.target.value))} style={{ width: '100%' }} />
          </label>
          <label style={{ fontSize: 13 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Rotation : {yaw}°</div>
            <input type="range" min={-60} max={60} value={yaw} onChange={(e) => setYaw(Number(e.target.value))} style={{ width: '100%' }} />
          </label>
        </div>
      )}

      {/* Aperçu */}
      <div
        style={{
          minHeight: 360, borderRadius: 16, border: '1px solid var(--line)',
          background:
            'repeating-conic-gradient(rgba(255,255,255,.03) 0% 25%, transparent 0% 50%) 50% / 24px 24px, var(--panel)',
          display: 'grid', placeItems: 'center', padding: 20,
        }}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={target}
            style={{ maxHeight: 460, maxWidth: '100%', objectFit: 'contain', filter: 'drop-shadow(0 12px 24px rgba(0,0,0,.45))' }}
            onError={() => setMsg("Impossible de générer ce skin (pseudo introuvable ?).")}
          />
        ) : (
          <div style={{ color: 'var(--muted)', textAlign: 'center' }}>
            Entre un pseudo et clique <strong>Générer</strong> pour voir le rendu 3D.
          </div>
        )}
      </div>

      {url && (
        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={download} disabled={busy} className="btn-accent" style={{ padding: '10px 20px', borderRadius: 10 }}>
            {busy ? '…' : 'Télécharger (PNG)'}
          </button>
          <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontWeight: 600 }}>
            Ouvrir en grand
          </a>
        </div>
      )}
      {msg && <p style={{ marginTop: 10, color: 'var(--muted)' }}>{msg}</p>}

      <p style={{ marginTop: 18, fontSize: 12.5, color: 'var(--muted)' }}>
        Les poses proposées sont les poses natives du moteur — pour une pose
        100% custom (bras écartés précis, etc.), il faut Blender.
      </p>
    </div>
  );
}
