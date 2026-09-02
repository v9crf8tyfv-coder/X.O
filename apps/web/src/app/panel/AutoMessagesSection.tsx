'use client';

import { useEffect, useState, type ReactNode } from 'react';

interface Msg {
  id: number;
  channel_id: string;
  content: string;
  image_url: string | null;
  mode: string;
  every_hours: number | null;
  at_hhmm: string | null;
  days: string | null;
  enabled: boolean;
}

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']; // index 0 = jour 1 (Lundi)

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
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]); // tous par défaut
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  const toggleDay = (d: number) => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()));

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
      body: JSON.stringify({ target, channelId, content, imageUrl, mode, everyHours: Number(everyHours), atHHMM, days }),
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
  const timing = (m: Msg) => {
    if (m.mode !== 'daily') {
      const n = m.every_hours ?? 2;
      if (n === 1) return 'toutes les heures (à chaque heure pile)';
      const hs: string[] = [];
      for (let h = 0; h < 24; h += n) hs.push(h + 'h');
      return `toutes les ${n} h — à ${hs.join(', ')}`;
    }
    const jours = m.days
      ? ' (' + m.days.split(',').map((d) => DAY_LABELS[Number(d) - 1]).join(' ') + ')'
      : '';
    return `chaque jour à ${m.at_hhmm}${jours}`;
  };

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
          <textarea className="btn-sec" placeholder="Message — Discord : **gras** __souligné__ · En jeu : &a couleur &l gras (voir aperçu)" rows={3}
            value={content} onChange={(e) => setContent(e.target.value)} style={{ padding: '10px 12px', resize: 'vertical' }} />
          <input className="btn-sec" placeholder="Lien image (optionnel, https://… — s'affiche sur Discord)"
            value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} style={{ padding: '10px 12px' }} />
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
          {mode === 'daily' && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ color: muted, fontSize: 13 }}>Jours :</span>
              {DAY_LABELS.map((lbl, i) => {
                const d = i + 1;
                const on = days.includes(d);
                return (
                  <button key={d} type="button" onClick={() => toggleDay(d)} className="btn-sec"
                    style={{ padding: '6px 10px', opacity: on ? 1 : 0.4, borderColor: on ? 'var(--accent, #7c5cff)' : undefined }}>
                    {lbl}
                  </button>
                );
              })}
              <span style={{ color: muted, fontSize: 12 }}>
                ({days.length === 7 ? 'tous les jours' : days.length === 0 ? 'aucun jour !' : days.length + ' jours'})
              </span>
            </div>
          )}
          <ChatPreview text={content} inGame={target === 'game'} />
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

const MC_COLORS: Record<string, string> = {
  '0': '#000000', '1': '#0000AA', '2': '#00AA00', '3': '#00AAAA', '4': '#AA0000', '5': '#AA00AA',
  '6': '#FFAA00', '7': '#AAAAAA', '8': '#555555', '9': '#5555FF', a: '#55FF55', b: '#55FFFF',
  c: '#FF5555', d: '#FF55FF', e: '#FFFF55', f: '#FFFFFF',
};

/** Rend les codes Minecraft &a &l &n … en <span> stylés. */
function renderMc(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let color = '#FFFFFF', bold = false, italic = false, underline = false, strike = false, buf = '', k = 0;
  const flush = () => {
    if (!buf) return;
    const deco = `${underline ? 'underline' : ''} ${strike ? 'line-through' : ''}`.trim();
    out.push(<span key={k++} style={{ color, fontWeight: bold ? 700 : 400, fontStyle: italic ? 'italic' : 'normal', textDecoration: deco || 'none' }}>{buf}</span>);
    buf = '';
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if ((ch === '&' || ch === '§') && i + 1 < text.length) {
      const c = text[i + 1].toLowerCase();
      if (MC_COLORS[c]) { flush(); color = MC_COLORS[c]; bold = italic = underline = strike = false; i++; continue; }
      if (c === 'l') { flush(); bold = true; i++; continue; }
      if (c === 'o') { flush(); italic = true; i++; continue; }
      if (c === 'n') { flush(); underline = true; i++; continue; }
      if (c === 'm') { flush(); strike = true; i++; continue; }
      if (c === 'r') { flush(); color = '#FFFFFF'; bold = italic = underline = strike = false; i++; continue; }
      if (c === 'k') { i++; continue; }
    }
    buf += ch;
  }
  flush();
  return out;
}

/** Rend le markdown Discord (**gras** __souligné__ *italique* ~~barré~~) — simple, non imbriqué. */
function renderDiscord(text: string): ReactNode[] {
  const re = /(\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*]+\*)/g;
  const out: ReactNode[] = [];
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(<span key={k++}>{text.slice(last, m.index)}</span>);
    const t = m[0];
    if (t.startsWith('**')) out.push(<b key={k++}>{t.slice(2, -2)}</b>);
    else if (t.startsWith('__')) out.push(<u key={k++}>{t.slice(2, -2)}</u>);
    else if (t.startsWith('~~')) out.push(<s key={k++}>{t.slice(2, -2)}</s>);
    else out.push(<i key={k++}>{t.slice(1, -1)}</i>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(<span key={k++}>{text.slice(last)}</span>);
  return out;
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
          {text ? renderMc(text) : <span style={{ color: '#888' }}>(vide)</span>}
        </div>
      ) : (
        <div style={{ color: '#dcddde' }}>{text ? renderDiscord(text) : <span style={{ color: '#888' }}>(vide)</span>}</div>
      )}
    </div>
  );
}
