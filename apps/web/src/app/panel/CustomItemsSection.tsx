'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface Give {
  id: number;
  item: string;
  name: string | null;
  enchants: { id: string; lvl: number }[] | null;
  target: string;
  status: string;
  created_at: string;
}

const MC_COLORS: Record<string, string> = {
  '0': '#000000', '1': '#0000AA', '2': '#00AA00', '3': '#00AAAA', '4': '#AA0000',
  '5': '#AA00AA', '6': '#FFAA00', '7': '#AAAAAA', '8': '#555555', '9': '#5555FF',
  a: '#55FF55', b: '#55FFFF', c: '#FF5555', d: '#FF55FF', e: '#FFFF55', f: '#FFFFFF',
};

function renderMc(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let color = '#FFFFFF', bold = false, italic = false, buf = '', k = 0;
  const flush = () => {
    if (buf) out.push(<span key={k++} style={{ color, fontWeight: bold ? 700 : 400, fontStyle: italic ? 'italic' : 'normal' }}>{buf}</span>);
    buf = '';
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if ((ch === '&' || ch === '§') && i + 1 < text.length) {
      const c = text[++i].toLowerCase();
      if (MC_COLORS[c]) { flush(); color = MC_COLORS[c]; bold = italic = false; }
      else if (c === 'l') { flush(); bold = true; }
      else if (c === 'o') { flush(); italic = true; }
      else if (c === 'r') { flush(); color = '#FFFFFF'; bold = italic = false; }
      continue;
    }
    buf += ch;
  }
  flush();
  return out;
}

export default function CustomItemsSection() {
  const [items, setItems] = useState<string[]>([]);
  const [enchList, setEnchList] = useState<string[]>([]);
  const [gives, setGives] = useState<Give[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [item, setItem] = useState('minecraft:netherite_pickaxe');
  const [name, setName] = useState('&6PIOCHE DES MINES');
  const [lore, setLore] = useState('&7Née des entrailles du monde.');
  const [target, setTarget] = useState('');
  const [enchants, setEnchants] = useState<{ id: string; lvl: number }[]>([{ id: 'minecraft:efficiency', lvl: 10 }]);

  const focusRef = useRef<'name' | 'lore'>('name');

  async function loadRegistry() {
    try {
      const r = await fetch('/api/registry');
      const d = await r.json();
      setItems(d.items ?? []);
      setEnchList(d.enchants ?? []);
    } catch { /* pas grave : on garde la saisie libre */ }
  }
  async function loadGives() {
    try {
      const r = await fetch('/api/custom-items');
      if (!r.ok) throw new Error('Accès refusé');
      const d = await r.json();
      setGives(d.items ?? []);
    } catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { loadRegistry(); loadGives(); }, []);

  function insertCode(code: string) {
    if (focusRef.current === 'name') setName((s) => s + code);
    else setLore((s) => s + code);
  }

  async function give() {
    setSaving(true); setError('');
    const loreLines = lore.split('\n').map((s) => s.trim()).filter(Boolean);
    const payload = { item, name, lore: loreLines, enchants: enchants.filter((e) => e.id.trim()), target };
    const r = await fetch('/api/custom-items', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    setSaving(false);
    if (r.ok) { await loadGives(); setError(''); }
    else setError((await r.json().catch(() => ({}))).error || 'Échec.');
  }
  async function del(id: number) {
    await fetch(`/api/custom-items?id=${id}`, { method: 'DELETE' });
    await loadGives();
  }

  const muted = 'var(--muted, #8a8a94)';
  const codeBtns = ['6', 'e', 'c', 'a', 'b', 'd', '5', 'f', '7', '0', 'l', 'o', 'r'];

  return (
    <div className="launcher-sec">
      <h2 style={{ marginBottom: 6 }}>Items custom</h2>
      <p style={{ color: muted, marginBottom: 18 }}>
        Crée un item (n’importe quel item, même modé), ajoute des enchantements à n’importe quel niveau,
        un nom et une description colorés, puis donne-le à un joueur. L’item arrive en jeu dès que le
        joueur est en ligne (le mod vérifie toutes les 12 s).
      </p>

      {error && (
        <div style={{ background: 'rgba(220,60,60,.14)', border: '1px solid rgba(220,60,60,.4)', color: '#ffb4b4', padding: '10px 14px', borderRadius: 10, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div className="lchr-card">
        <h3>Nouvel item</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Item</span>
            <input className="btn-sec" list="ci-items" value={item} onChange={(e) => setItem(e.target.value)}
              placeholder="minecraft:netherite_pickaxe" style={{ padding: '10px 12px' }} />
            <datalist id="ci-items">{items.slice(0, 2000).map((i) => <option key={i} value={i} />)}</datalist>
            <span style={{ color: muted, fontSize: 12 }}>{items.length ? `${items.length} items détectés (modés inclus)` : 'Liste indisponible — saisis l’ID à la main (le serveur doit avoir tourné une fois).'}</span>
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Enchantements</span>
            {enchants.map((e, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input className="btn-sec" list="ci-ench" value={e.id}
                  onChange={(ev) => setEnchants((cur) => cur.map((x, i) => i === idx ? { ...x, id: ev.target.value } : x))}
                  placeholder="minecraft:efficiency" style={{ padding: '8px 10px', flex: 1, minWidth: 200 }} />
                <input className="btn-sec" type="number" min={1} value={e.lvl}
                  onChange={(ev) => setEnchants((cur) => cur.map((x, i) => i === idx ? { ...x, lvl: Number(ev.target.value) } : x))}
                  style={{ padding: '8px 10px', width: 100 }} />
                <button type="button" className="btn-sec" style={{ padding: '8px 10px' }}
                  onClick={() => setEnchants((cur) => cur.filter((_, i) => i !== idx))}>Retirer</button>
              </div>
            ))}
            <datalist id="ci-ench">{enchList.map((i) => <option key={i} value={i} />)}</datalist>
            <button type="button" className="btn-sec" style={{ padding: '8px 10px', alignSelf: 'flex-start' }}
              onClick={() => setEnchants((cur) => [...cur, { id: '', lvl: 1 }])}>+ Ajouter un enchant</button>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Nom de l’item</span>
            <input className="btn-sec" value={name} onFocusCapture={() => (focusRef.current = 'name')}
              onChange={(e) => setName(e.target.value)} placeholder="&6PIOCHE DES MINES" style={{ padding: '10px 12px' }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Description (une ligne par retour)</span>
            <textarea className="btn-sec" rows={3} value={lore} onFocusCapture={() => (focusRef.current = 'lore')}
              onChange={(e) => setLore(e.target.value)} style={{ padding: '10px 12px', resize: 'vertical' }} />
          </label>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ color: muted, fontSize: 12 }}>Couleur / style (clic → insère dans le dernier champ cliqué) :</span>
            {codeBtns.map((c) => (
              <button key={c} type="button" onClick={() => insertCode('&' + c)}
                title={'&' + c}
                style={{ width: 26, height: 26, borderRadius: 6, cursor: 'pointer', border: '1px solid var(--line)',
                  background: MC_COLORS[c] || '#2a2a33', color: c === 'l' || c === 'o' || c === 'r' ? '#fff' : '#000',
                  fontWeight: 700, fontSize: 12 }}>
                {c === 'l' ? 'G' : c === 'o' ? 'I' : c === 'r' ? 'R' : ''}
              </button>
            ))}
          </div>

          <div style={{ background: '#1a1a1f', borderRadius: 10, padding: '12px 14px', fontFamily: '"Minecraft","Courier New",monospace' }}>
            <div style={{ fontSize: 12, color: muted, marginBottom: 6 }}>Aperçu</div>
            <div style={{ fontSize: 16 }}>{renderMc(name || '(sans nom)')}</div>
            {lore.split('\n').filter(Boolean).map((l, i) => <div key={i} style={{ fontSize: 14 }}>{renderMc(l)}</div>)}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input className="btn-sec" value={target} onChange={(e) => setTarget(e.target.value)}
              placeholder="Pseudo du joueur" style={{ padding: '10px 12px', minWidth: 200 }} />
            <button className="btn-accent" onClick={give} disabled={saving}>{saving ? '…' : 'Donner l’item'}</button>
          </div>
        </div>
      </div>

      <div className="lchr-card">
        <h3>File d’attente <span className="lchr-count">{gives.length}</span></h3>
        {gives.length === 0 ? (
          <p className="lchr-hint">Aucun item pour l’instant.</p>
        ) : (
          <ul className="lchr-list">
            {gives.map((g) => (
              <li key={g.id}>
                <span style={{ flex: 1 }}>
                  <span>{g.name ? renderMc(g.name) : g.item}</span><br />
                  <span style={{ color: muted, fontSize: 12.5 }}>
                    {g.item} · pour <b>{g.target}</b> · {g.status === 'pending' ? 'en attente' : 'donné'}
                    {g.enchants?.length ? ' · ' + g.enchants.map((e) => `${e.id.split(':').pop()} ${e.lvl}`).join(', ') : ''}
                  </span>
                </span>
                <button className="lchr-x" onClick={() => del(g.id)}>Suppr.</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
