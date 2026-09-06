'use client';

import { useEffect, useState } from 'react';

export default function BackgroundSection() {
  const [url, setUrl] = useState('');
  const [saved, setSaved] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/site-bg')
      .then((r) => (r.ok ? r.json() : { url: '' }))
      .then((d) => { setUrl(d.url ?? ''); setSaved(d.url ?? ''); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function save(next: string) {
    setBusy(true);
    setMsg('');
    try {
      const r = await fetch('/api/site-bg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: next }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { setSaved(next); setMsg('Enregistré ✅ (visible sur le site dans ~1 min)'); }
      else setMsg(d.error ?? 'Erreur.');
    } catch {
      setMsg('Impossible de contacter le serveur.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <h2 className="section-title">Arrière-plan du site</h2>
      <p className="section-sub">
        Change l&apos;image de fond de la page d&apos;accueil du site. Réservé aux Responsables et Fondateurs.
      </p>

      <div style={{ margin: '18px 0' }}>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>URL de l&apos;image</label>
        <input
          type="text"
          value={url}
          placeholder="https://…/mon-image.jpg"
          onChange={(e) => setUrl(e.target.value)}
          disabled={loading || busy}
          style={{
            width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 10,
            border: '1px solid var(--line)', background: 'rgba(255,255,255,.04)', color: 'var(--txt)',
            font: 'inherit',
          }}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => save(url.trim())}
            disabled={loading || busy || url.trim() === saved.trim()}
            className="btn-accent"
            style={{ padding: '9px 18px', borderRadius: 10 }}
          >
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          {saved && (
            <button
              onClick={() => { setUrl(''); save(''); }}
              disabled={busy}
              style={{
                padding: '9px 16px', borderRadius: 10, cursor: 'pointer',
                border: '1px solid rgba(214,69,69,.4)', background: 'transparent', color: '#e88', fontWeight: 600,
              }}
            >
              Retirer l&apos;image
            </button>
          )}
        </div>
        {msg && <p style={{ marginTop: 10, color: 'var(--muted)' }}>{msg}</p>}
      </div>

      {/* Aperçu */}
      <div>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Aperçu</div>
        <div
          style={{
            width: '100%', aspectRatio: '16 / 9', borderRadius: 14, border: '1px solid var(--line)',
            background: url
              ? `linear-gradient(rgba(11,11,15,.55), rgba(11,11,15,.55)), url("${url}") center/cover no-repeat`
              : 'var(--panel)',
            display: 'grid', placeItems: 'center', color: 'var(--muted)',
          }}
        >
          {!url && 'Aucune image (fond par défaut)'}
        </div>
      </div>

      <div style={{ marginTop: 20, padding: 14, borderRadius: 12, background: 'rgba(124,92,255,.08)', border: '1px solid var(--line)', fontSize: 13, color: 'var(--muted)' }}>
        <strong style={{ color: 'var(--txt)' }}>Format recommandé :</strong> image <strong>paysage</strong> (16:9),
        au moins <strong>1920 × 1080 px</strong> (idéalement 2560 × 1440), en <strong>JPG</strong> ou
        <strong> WebP</strong>, &lt; 2–3 Mo. Colle une <strong>URL directe</strong> vers l&apos;image
        (lien qui finit par .jpg/.png/.webp — depuis Discord, imgur, etc.). L&apos;image est automatiquement
        recadrée pour remplir l&apos;écran, donc n&apos;importe quelle taille marche, mais du paysage rend le mieux.
      </div>
    </div>
  );
}
