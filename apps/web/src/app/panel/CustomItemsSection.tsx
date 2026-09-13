'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface Give {
  id: number;
  item: string;
  name: string | null;
  enchants: { id: string; lvl: number }[] | null;
  target: string;
  status: string;
}

const MC_COLORS: Record<string, string> = {
  '0': '#000000', '1': '#0000AA', '2': '#00AA00', '3': '#00AAAA', '4': '#AA0000',
  '5': '#AA00AA', '6': '#FFAA00', '7': '#AAAAAA', '8': '#555555', '9': '#5555FF',
  a: '#55FF55', b: '#55FFFF', c: '#FF5555', d: '#FF55FF', e: '#FFFF55', f: '#FFFFFF',
};
const short = (id: unknown) => { const s = String(id ?? ''); return (s.split(':').pop() || s).replace(/_/g, ' '); };

// Traduction FR -> EN pour chercher en français (les IDs Minecraft sont en anglais).
const FR_EN: Record<string, string> = {
  diamant: 'diamond', or: 'gold', dore: 'gold', doree: 'gold', fer: 'iron', bois: 'wood',
  pierre: 'stone', epee: 'sword', pioche: 'pickaxe', hache: 'axe', pelle: 'shovel', houe: 'hoe',
  arc: 'bow', arbalete: 'crossbow', fleche: 'arrow', casque: 'helmet', plastron: 'chestplate',
  jambieres: 'leggings', bottes: 'boots', bouclier: 'shield', pomme: 'apple', pain: 'bread',
  emeraude: 'emerald', charbon: 'coal', lingot: 'ingot', bloc: 'block', tete: 'head', oeuf: 'egg',
  seau: 'bucket', cuir: 'leather', livre: 'book', four: 'furnace', coffre: 'chest', tonneau: 'barrel',
  torche: 'torch', echelle: 'ladder', porte: 'door', lit: 'bed', laine: 'wool', verre: 'glass',
  sable: 'sand', gravier: 'gravel', terre: 'dirt', herbe: 'grass', eau: 'water', lave: 'lava',
  glace: 'ice', neige: 'snow', os: 'bone', perle: 'pearl', baton: 'stick', totem: 'totem',
  elytres: 'elytra', netherite: 'netherite', obsidienne: 'obsidian', ame: 'soul', braise: 'ember',
  // enchantements
  efficacite: 'efficiency', solidite: 'unbreaking', raccommodage: 'mending', fortune: 'fortune',
  tranchant: 'sharpness', protection: 'protection', soie: 'silk', pouvoir: 'power', infinite: 'infinity',
  flamme: 'flame', butin: 'looting', chute: 'feather', respiration: 'respiration', aqua: 'aqua',
};
function tokens(q: string): string[] {
  return q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/)
    .filter(Boolean).map((w) => FR_EN[w] || w);
}

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
      const n = text[i + 1].toLowerCase();
      if (n === '#' && i + 7 < text.length) {
        flush(); color = '#' + text.slice(i + 2, i + 8); bold = italic = false; i += 7; continue;
      }
      i++;
      if (MC_COLORS[n]) { flush(); color = MC_COLORS[n]; bold = italic = false; }
      else if (n === 'l') { flush(); bold = true; }
      else if (n === 'o') { flush(); italic = true; }
      else if (n === 'r') { flush(); color = '#FFFFFF'; bold = italic = false; }
      continue;
    }
    buf += ch;
  }
  flush();
  return out;
}

function Picker({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const opts = (Array.isArray(options) ? options : []).map((o) => String(o ?? '')).filter(Boolean);
  const toks = tokens(q);
  const matches = toks.length
    ? opts.filter((o) => { const s = o.toLowerCase(); return toks.every((t) => s.includes(t)); })
    : opts;
  const filtered = matches.slice(0, 600);
  const close = () => { setOpen(false); setQ(''); };

  return (
    <div style={{ flex: 1, minWidth: 220 }}>
      <button type="button" className="btn-sec" onClick={() => setOpen(true)}
        style={{ padding: '10px 12px', width: '100%', textAlign: 'left' }}>
        {value ? short(value) : <span style={{ opacity: 0.6 }}>{placeholder}</span>}
        <span style={{ float: 'right', opacity: 0.6 }}>▾</span>
      </button>

      {open && (
        <div onClick={close}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(1000px, 96vw)', maxHeight: '86vh', display: 'flex', flexDirection: 'column',
              background: '#14141a', border: '2px solid #2c2c38', borderRadius: 14, padding: 16, boxShadow: '0 20px 60px rgba(0,0,0,.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <b style={{ fontSize: 16 }}>{placeholder}</b>
              <button type="button" onClick={close} className="btn-sec" style={{ padding: '6px 12px' }}>✕ Fermer</button>
            </div>
            <input autoFocus className="btn-sec" placeholder="Rechercher (FR ou EN)…" value={q} onChange={(e) => setQ(e.target.value)}
              style={{ padding: '10px 12px', width: '100%', marginBottom: 8, fontSize: 15 }} />
            <div style={{ fontSize: 12, color: '#8a8a94', marginBottom: 8 }}>
              {matches.length} résultat(s){matches.length > 600 ? ' — affiche les 600 premiers, affine la recherche' : ''}
            </div>
            <div style={{ overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))', gap: 6, paddingRight: 4 }}>
              {filtered.map((o) => (
                <button key={o} type="button" onClick={() => { onChange(o); close(); }} title={o}
                  style={{ height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                    padding: 6, borderRadius: 8, cursor: 'pointer', lineHeight: 1.15,
                    border: o === value ? '2px solid #7c5cff' : '1px solid #2c2c38',
                    background: o === value ? 'rgba(124,92,255,.22)' : '#1c1c24', color: '#e8e8ee', fontSize: 12 }}>
                  {short(o)}
                </button>
              ))}
              {filtered.length === 0 && <span style={{ color: '#888', fontSize: 13, padding: 10 }}>Aucun résultat</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CustomItemsSection() {
  const [items, setItems] = useState<string[]>([]);
  const [enchList, setEnchList] = useState<string[]>([]);
  const [gives, setGives] = useState<Give[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [item, setItem] = useState('minecraft:netherite_pickaxe');
  const [name, setName] = useState('&#FFAA00PIOCHE DES MINES');
  const [lore, setLore] = useState('&7Née des entrailles du monde.');
  const [target, setTarget] = useState('');
  const [enchants, setEnchants] = useState<{ id: string; lvl: number }[]>([{ id: 'minecraft:efficiency', lvl: 10 }]);
  const focusRef = useRef<'name' | 'lore'>('name');

  async function loadRegistry() {
    try { const d = await (await fetch('/api/registry')).json(); setItems(d.items ?? []); setEnchList(d.enchants ?? []); } catch { /* saisie libre */ }
  }
  async function loadGives() {
    try { const r = await fetch('/api/custom-items'); if (!r.ok) throw new Error('Accès refusé'); setGives((await r.json()).items ?? []); }
    catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { loadRegistry(); loadGives(); }, []);

  function insertCode(code: string) {
    if (focusRef.current === 'name') setName((s) => s + code); else setLore((s) => s + code);
  }
  function insertHex(hex: string) { insertCode('&#' + hex.replace('#', '').toUpperCase()); }

  async function give() {
    setSaving(true); setError('');
    const loreLines = lore.split('\n').map((s) => s.trim()).filter(Boolean);
    const r = await fetch('/api/custom-items', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item, name, lore: loreLines, enchants: enchants.filter((e) => e.id.trim()), target }),
    });
    setSaving(false);
    if (r.ok) { await loadGives(); setError(''); } else setError((await r.json().catch(() => ({}))).error || 'Échec.');
  }
  async function del(id: number) { await fetch(`/api/custom-items?id=${id}`, { method: 'DELETE' }); await loadGives(); }

  const muted = 'var(--muted, #8a8a94)';
  const codeBtns = ['l', 'o', 'n', 'm', 'r'];

  return (
    <div className="launcher-sec">
      <h2 style={{ marginBottom: 6 }}>Items custom</h2>
      <p style={{ color: muted, marginBottom: 18 }}>
        Choisis n’importe quel item (recherche dans <b>tous</b> les items du serveur, modés inclus, mis à jour
        automatiquement), ajoute des enchantements à n’importe quel niveau, un nom et une description avec les
        couleurs que tu veux (HEX), puis donne-le. L’item arrive en jeu dès que le joueur est en ligne.
      </p>

      {error && (
        <div style={{ background: 'rgba(220,60,60,.14)', border: '1px solid rgba(220,60,60,.4)', color: '#ffb4b4', padding: '10px 14px', borderRadius: 10, marginBottom: 16 }}>{error}</div>
      )}

      <div className="lchr-card">
        <h3>Nouvel item</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Item — <span style={{ color: muted, fontWeight: 400 }}>{items.length ? `${items.length} détectés` : 'liste vide (démarre le serveur une fois)'}</span></span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Picker value={item} onChange={setItem} options={items} placeholder="Choisir un item…" />
            </div>
            <span style={{ color: muted, fontSize: 12, fontFamily: 'monospace' }}>{item}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Enchantements</span>
            {enchants.map((e, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <Picker value={e.id} options={enchList} placeholder="Choisir un enchant…"
                  onChange={(v) => setEnchants((cur) => cur.map((x, i) => i === idx ? { ...x, id: v } : x))} />
                <input className="btn-sec" type="number" min={1} value={e.lvl}
                  onChange={(ev) => setEnchants((cur) => cur.map((x, i) => i === idx ? { ...x, lvl: Number(ev.target.value) } : x))}
                  style={{ padding: '8px 10px', width: 100 }} />
                <button type="button" className="btn-sec" style={{ padding: '8px 10px' }}
                  onClick={() => setEnchants((cur) => cur.filter((_, i) => i !== idx))}>Retirer</button>
              </div>
            ))}
            <button type="button" className="btn-sec" style={{ padding: '8px 10px', alignSelf: 'flex-start' }}
              onClick={() => setEnchants((cur) => [...cur, { id: '', lvl: 1 }])}>+ Ajouter un enchant</button>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Nom</span>
            <input className="btn-sec" value={name} onFocusCapture={() => (focusRef.current = 'name')}
              onChange={(e) => setName(e.target.value)} style={{ padding: '10px 12px' }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Description (une ligne par retour)</span>
            <textarea className="btn-sec" rows={3} value={lore} onFocusCapture={() => (focusRef.current = 'lore')}
              onChange={(e) => setLore(e.target.value)} style={{ padding: '10px 12px', resize: 'vertical' }} />
          </label>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ color: muted, fontSize: 12 }}>Couleur (insère dans le dernier champ cliqué) :</span>
            <input type="color" onChange={(e) => insertHex(e.target.value)} defaultValue="#ffaa00"
              style={{ width: 34, height: 30, borderRadius: 6, border: '1px solid var(--line)', background: 'none', cursor: 'pointer' }} />
            {codeBtns.map((c) => (
              <button key={c} type="button" onClick={() => insertCode('&' + c)} title={'&' + c}
                style={{ width: 30, height: 30, borderRadius: 6, cursor: 'pointer', border: '1px solid var(--line)', background: '#2a2a33', color: '#fff', fontWeight: 700, fontSize: 12 }}>
                {c === 'l' ? 'G' : c === 'o' ? 'I' : c === 'n' ? 'S' : c === 'm' ? 'B' : 'R'}
              </button>
            ))}
          </div>

          <div style={{ background: '#141018', borderRadius: 10, padding: '12px 14px', fontFamily: '"Courier New",monospace' }}>
            <div style={{ fontSize: 12, color: muted, marginBottom: 6 }}>Aperçu</div>
            <div style={{ fontSize: 17 }}>{renderMc(name || '(sans nom)')}</div>
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
                  <span>{g.name ? renderMc(g.name) : short(g.item)}</span><br />
                  <span style={{ color: muted, fontSize: 12.5 }}>
                    {g.item} · pour <b>{g.target}</b> · {g.status === 'pending' ? 'en attente' : 'donné'}
                    {g.enchants?.length ? ' · ' + g.enchants.map((e) => `${short(e.id)} ${e.lvl}`).join(', ') : ''}
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
