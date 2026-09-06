'use client';

import { useEffect, useRef, useState } from 'react';

const SITE = 'https://emeria-site.com';
const MAX_MB = 3;

export default function BackgroundSection() {
  const [ver, setVer] = useState(0); // >0 = une image est enregistrée
  const [preview, setPreview] = useState(''); // aperçu local après sélection
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/site-bg')
      .then((r) => (r.ok ? r.json() : { ver: 0 }))
      .then((d) => setVer(d.ver ?? 0))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function pickFile(file: File) {
    setMsg('');
    if (!file.type.startsWith('image/')) { setMsg('Ce n\'est pas une image.'); return; }
    if (file.size > MAX_MB * 1024 * 1024) { setMsg(`Image trop lourde (max ${MAX_MB} Mo).`); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || '');
      setPreview(dataUrl); // aperçu instantané
      const comma = dataUrl.indexOf(',');
      const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : '';
      await upload(base64, file.type);
    };
    reader.readAsDataURL(file);
  }

  async function upload(base64: string, mime: string) {
    setBusy(true);
    setMsg('');
    try {
      const r = await fetch('/api/site-bg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: base64, mime }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { setVer(d.ver ?? Date.now()); setMsg('Enregistré ✅ (visible sur le site dans ~1 min)'); }
      else setMsg(d.error ?? 'Erreur.');
    } catch {
      setMsg('Impossible de contacter le serveur.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setMsg('');
    try {
      const r = await fetch('/api/site-bg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: '' }),
      });
      if (r.ok) { setVer(0); setPreview(''); setMsg('Image retirée (fond par défaut).'); }
      else setMsg('Erreur.');
    } catch {
      setMsg('Impossible de contacter le serveur.');
    } finally {
      setBusy(false);
    }
  }

  // Aperçu : le fichier local si on vient d'en choisir un, sinon l'image enregistrée (servie par le site).
  const previewBg = preview || (ver > 0 ? `${SITE}/api/status?img=1&v=${ver}` : '');

  return (
    <div style={{ maxWidth: 760 }}>
      <h2 className="section-title">Arrière-plan du site</h2>
      <p className="section-sub">
        Change l&apos;image de fond de la page d&apos;accueil du site. Réservé aux Responsables et Fondateurs.
      </p>

      <div style={{ margin: '18px 0', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); e.target.value = ''; }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={loading || busy}
          className="btn-accent"
          style={{ padding: '10px 20px', borderRadius: 10 }}
        >
          {busy ? 'Envoi…' : ver > 0 ? 'Changer l’image' : 'Choisir une image'}
        </button>
        {ver > 0 && (
          <button
            onClick={remove}
            disabled={busy}
            style={{
              padding: '10px 16px', borderRadius: 10, cursor: 'pointer',
              border: '1px solid rgba(214,69,69,.4)', background: 'transparent', color: '#e88', fontWeight: 600,
            }}
          >
            Retirer l&apos;image
          </button>
        )}
      </div>
      {msg && <p style={{ margin: '0 0 14px', color: 'var(--muted)' }}>{msg}</p>}

      {/* Aperçu */}
      <div>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Aperçu</div>
        <div
          style={{
            width: '100%', aspectRatio: '16 / 9', borderRadius: 14, border: '1px solid var(--line)',
            background: previewBg
              ? `linear-gradient(rgba(9,9,13,.55), rgba(9,9,13,.55)), url("${previewBg}") center/cover no-repeat`
              : 'var(--panel)',
            display: 'grid', placeItems: 'center', color: 'var(--muted)',
          }}
        >
          {!previewBg && (loading ? 'Chargement…' : 'Aucune image (fond par défaut)')}
        </div>
      </div>

      <div style={{ marginTop: 20, padding: 14, borderRadius: 12, background: 'rgba(124,92,255,.08)', border: '1px solid var(--line)', fontSize: 13, color: 'var(--muted)' }}>
        <strong style={{ color: 'var(--txt)' }}>Conseils :</strong> image <strong>paysage</strong> (16:9),
        idéalement <strong>1920 × 1080</strong> ou plus, en <strong>JPG</strong> / <strong>WebP</strong> / PNG,
        <strong> max 3 Mo</strong>. L&apos;image est recadrée automatiquement pour remplir l&apos;écran, avec un
        voile sombre par-dessus pour garder le texte lisible.
      </div>
    </div>
  );
}
