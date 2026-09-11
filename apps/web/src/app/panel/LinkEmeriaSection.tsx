'use client';

import { useEffect, useState, type CSSProperties } from 'react';

/**
 * Link Emeria (admins et +).
 * On upload une image depuis son ordinateur -> elle est hébergée (release GitHub, gratuit)
 * -> on récupère une URL PUBLIQUE stable à coller EN JEU dans l'affiche du SignBaton (mod MapImage).
 * L'historique des liens est gardé dans le navigateur (localStorage) pour les réutiliser.
 */

interface LinkItem { url: string; name: string; at: number }
const LS_KEY = 'emeria_link_history';

export default function LinkEmeriaSection() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [items, setItems] = useState<LinkItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch { /* pas d'historique */ }
  }, []);

  function persist(next: LinkItem[]) {
    setItems(next);
    try { localStorage.setItem(LS_KEY, JSON.stringify(next.slice(0, 60))); } catch { /* ignore */ }
  }

  async function upload(file: File) {
    setUploading(true); setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch('/api/upload', { method: 'POST', body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Upload échoué');
      persist([{ url: d.url, name: file.name, at: Date.now() }, ...items]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied((c) => (c === url ? null : c)), 1500);
    } catch { /* clipboard indispo */ }
  }

  function remove(url: string) {
    persist(items.filter((it) => it.url !== url));
  }

  const muted: CSSProperties = { color: 'var(--muted,#8a8a94)' };
  const card: CSSProperties = { border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, background: 'rgba(255,255,255,.02)', padding: 14 };
  const btn: CSSProperties = { background: '#7c5cff', color: '#fff', border: 0, borderRadius: 10, padding: '10px 16px', fontWeight: 700, cursor: uploading ? 'wait' : 'pointer', opacity: uploading ? 0.6 : 1 };
  const btnSec: CSSProperties = { background: 'rgba(255,255,255,.08)', color: '#e8e8ec', border: '1px solid rgba(255,255,255,.15)', borderRadius: 8, padding: '7px 12px', fontWeight: 600, cursor: 'pointer', fontSize: 13 };

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Link Emeria</h2>
      <p style={{ ...muted, marginTop: 0, maxWidth: 640 }}>
        Envoie une image depuis ton ordinateur. Tu récupères un <b>lien public</b> à coller <b>en jeu</b> dans
        l&apos;affiche du SignBaton (image sur les panneaux). Le lien est permanent.
      </p>

      <div style={{ ...card, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
        <label style={btn}>
          {uploading ? 'Envoi…' : 'Choisir une image'}
          <input type="file" accept="image/*" hidden disabled={uploading}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
        </label>
        <span style={{ ...muted, fontSize: 13 }}>PNG, JPG, GIF, WebP — max 4 Mo.</span>
      </div>

      {error && <div style={{ color: '#ff6b6b', marginBottom: 14 }}>{error}</div>}

      {items.length === 0 ? (
        <p style={muted}>Aucun lien encore. Envoie une image pour obtenir ton premier lien.</p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {items.map((it) => (
            <div key={it.url} style={{ ...card, display: 'flex', gap: 14, alignItems: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.url} alt={it.name} style={{ width: 76, height: 76, objectFit: 'cover', borderRadius: 8, flexShrink: 0, background: '#111' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</div>
                <div style={{ ...muted, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.url}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button style={btnSec} onClick={() => copy(it.url)}>{copied === it.url ? 'Copié !' : 'Copier le lien'}</button>
                <button style={{ ...btnSec, color: '#ff9b9b' }} onClick={() => remove(it.url)}>Retirer</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
