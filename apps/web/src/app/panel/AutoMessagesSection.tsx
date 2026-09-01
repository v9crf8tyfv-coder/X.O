'use client';

import { useEffect, useState } from 'react';

interface Msg {
  id: number;
  channel_id: string;
  content: string;
  image_url: string | null;
  mode: string;
  every_hours: number | null;
  at_hhmm: string | null;
  enabled: boolean;
}

export default function AutoMessagesSection() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Formulaire
  const [target, setTarget] = useState<'game' | 'discord'>('game');
  const [channelId, setChannelId] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [mode, setMode] = useState<'interval' | 'daily'>('interval');
  const [everyHours, setEveryHours] = useState('2');
  const [atHHMM, setAtHHMM] = useState('19:00');
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/auto-messages');
      if (!r.ok) throw new Error('Accès refusé');
      setMsgs((await r.json()).messages ?? []);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function add() {
    setSaving(true);
    setError('');
    const r = await fetch('/api/auto-messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, channelId, content, imageUrl, mode, everyHours: Number(everyHours), atHHMM }),
    });
    setSaving(false);
    if (r.ok) { setContent(''); setImageUrl(''); await load(); }
    else setError((await r.json().catch(() => ({}))).error || 'Échec de l’ajout.');
  }
  async function toggle(m: Msg) {
    await fetch('/api/auto-messages', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: m.id, enabled: !m.enabled }),
    });
    await load();
  }
  async function del(id: number) {
    if (!confirm('Supprimer ce message automatique ?')) return;
    await fetch(`/api/auto-messages?id=${id}`, { method: 'DELETE' });
    await load();
  }

  const muted = 'var(--muted, #8a8a94)';
  const timing = (m: Msg) =>
    m.mode === 'daily' ? `chaque jour à ${m.at_hhmm}` : `toutes les ${m.every_hours ?? 2} h`;

  return (
    <div className="launcher-sec">
      <h2 style={{ marginBottom: 6 }}>Messages automatiques</h2>
      <p style={{ color: muted, marginBottom: 18 }}>
        Messages postés automatiquement, en boucle ou à heure fixe. Choisis <b>En jeu</b> (chat Minecraft,
        pour les rappels de vote) ou <b>Discord</b> (un salon). Idéal pour « N'oubliez pas de voter : /vote ».
      </p>

      {error && (
        <div style={{ background: 'rgba(220,60,60,.14)', border: '1px solid rgba(220,60,60,.4)', color: '#ffb4b4', padding: '10px 14px', borderRadius: 10, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div className="lchr-card">
        <h3>Nouveau message</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
          <select className="btn-sec" value={target} onChange={(e) => setTarget(e.target.value as 'game' | 'discord')} style={{ padding: '10px 12px' }}>
            <option value="game">En jeu (chat Minecraft)</option>
            <option value="discord">Discord (un salon)</option>
          </select>
          {target === 'discord' && (
            <input className="btn-sec" placeholder="ID du salon Discord (clic droit sur le salon → Copier l'identifiant)"
              value={channelId} onChange={(e) => setChannelId(e.target.value)} style={{ padding: '10px 12px' }} />
          )}
          <textarea className="btn-sec" placeholder="Message (ex. N'oubliez pas de voter : /vote)" rows={3}
            value={content} onChange={(e) => setContent(e.target.value)} style={{ padding: '10px 12px', resize: 'vertical' }} />
          {target === 'discord' && (
            <input className="btn-sec" placeholder="Lien image (optionnel, https://…)"
              value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} style={{ padding: '10px 12px' }} />
          )}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <select className="btn-sec" value={mode} onChange={(e) => setMode(e.target.value as 'interval' | 'daily')} style={{ padding: '10px 12px' }}>
              <option value="interval">Toutes les X heures</option>
              <option value="daily">Chaque jour à une heure</option>
            </select>
            {mode === 'interval' ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input className="btn-sec" type="number" min={1} max={168} value={everyHours}
                  onChange={(e) => setEveryHours(e.target.value)} style={{ width: 80, padding: '10px 12px' }} />
                <span style={{ color: muted }}>heures</span>
              </span>
            ) : (
              <input className="btn-sec" type="time" value={atHHMM} onChange={(e) => setAtHHMM(e.target.value)} style={{ padding: '10px 12px' }} />
            )}
            <button className="btn-accent" onClick={add} disabled={saving}>{saving ? '…' : 'Ajouter'}</button>
          </div>
        </div>
      </div>

      <div className="lchr-card">
        <h3>Messages configurés <span className="lchr-count">{msgs.length}</span></h3>
        {loading ? (
          <p className="lchr-hint">Chargement…</p>
        ) : msgs.length === 0 ? (
          <p className="lchr-hint">Aucun message automatique pour l’instant.</p>
        ) : (
          <ul className="lchr-list">
            {msgs.map((m) => (
              <li key={m.id} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ flex: 1 }}>
                    <span style={{ opacity: m.enabled ? 1 : 0.5 }}>
                      {m.content ? m.content.slice(0, 80) : '(image seule)'}
                      {m.content.length > 80 ? '…' : ''}
                    </span>
                    <br />
                    <span style={{ color: muted, fontSize: 12.5 }}>
                      {m.channel_id ? `Discord #${m.channel_id}` : 'En jeu'} · {timing(m)} · {m.enabled ? 'actif' : 'en pause'}
                      {m.image_url ? ' · image' : ''}
                    </span>
                  </span>
                  <span style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button className="lchr-x" onClick={() => setPreview(preview === m.id ? null : m.id)}>Voir en chat</button>
                    <button className="lchr-x" onClick={() => toggle(m)}>{m.enabled ? 'Pause' : 'Activer'}</button>
                    <button className="lchr-x" onClick={() => del(m.id)}>Suppr.</button>
                  </span>
                </div>
                {preview === m.id && <ChatPreview text={m.content} inGame={!m.channel_id} />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ChatPreview({ text, inGame }: { text: string; inGame: boolean }) {
  return (
    <div style={{
      background: 'rgba(0,0,0,0.80)', borderRadius: 6, padding: '12px 14px',
      fontFamily: '"Courier New", monospace', fontSize: 14, lineHeight: 1.7,
      border: '1px solid rgba(255,255,255,0.1)',
    }}>
      <div style={{ color: '#6b6b6b', fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
        {inGame ? 'Aperçu — chat en jeu' : 'Aperçu — message Discord'}
      </div>
      {inGame ? (
        <div>
          <span style={{ color: '#FFAA00', fontWeight: 700 }}>[EmeriaMC] </span>
          <span style={{ color: '#FFFF55' }}>{text || '(vide)'}</span>
        </div>
      ) : (
        <div style={{ color: '#dcddde' }}>{text || '(vide)'}</div>
      )}
    </div>
  );
}
