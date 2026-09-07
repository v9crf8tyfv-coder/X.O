'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/**
 * DA Emeria — éditeur dans le panel.
 * Les textes sont éditables EN CLIQUANT dessus (contentEditable). La couleur est un
 * curseur (appliquée via une variable CSS pour ne pas effacer le texte édité).
 * Chaque élément / affiche a son bouton Télécharger (PNG ; transparent pour les éléments).
 */

const PURPLE = '#7c5cff';
const DARK = '#0b0a12';
const LIGHT = '#f2f0f7';
const NMSR = 'https://nmsr.nickac.dev';
const W = 1920, H = 1080;
const FONT = "'Sora', system-ui, sans-serif";

/** Export d'un nœud en PNG. Sans w/h → taille naturelle. Toujours un vrai téléchargement. */
async function exportNode(node: HTMLElement, name: string, opaqueColor: string | null, w?: number, h?: number) {
  try { await (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts?.ready; } catch { /* ok */ }
  const { toPng } = await import('html-to-image');
  const opts: Record<string, unknown> = {
    pixelRatio: 2, cacheBust: true,
    backgroundColor: opaqueColor ?? undefined, // null = transparent
    style: { margin: '0', transform: 'none' },
  };
  if (w && h) { opts.width = w; opts.height = h; }
  const dataUrl = await toPng(node, opts);
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `${name}-${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Texte éditable au clic (le contenu initial est constant → React n'écrase jamais tes modifs). */
function Edit({ init, style }: { init: string; style?: CSSProperties }) {
  return (
    <span className="da-edit" contentEditable suppressContentEditableWarning spellCheck={false} style={style}>
      {init}
    </span>
  );
}

/* ---------- éléments de marque ---------- */
function LogoMark({ s = 44, outline = false }: { s?: number; outline?: boolean }) {
  return (
    <div style={{ width: s, height: s, borderRadius: s * 0.28, display: 'grid', placeItems: 'center', background: outline ? 'transparent' : PURPLE, border: outline ? `${s*0.05}px solid ${PURPLE}` : 'none', color: outline ? PURPLE : '#fff', fontWeight: 800, fontFamily: FONT, fontSize: s * 0.5 }}>E</div>
  );
}

export default function DaSection() {
  const [tab, setTab] = useState<'affiches' | 'elements'>('affiches');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!document.getElementById('sora-font')) {
      const l = document.createElement('link');
      l.id = 'sora-font'; l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&display=swap';
      document.head.appendChild(l);
    }
    if (!document.getElementById('da-edit-style')) {
      const s = document.createElement('style');
      s.id = 'da-edit-style';
      s.textContent = '.da-edit{outline:none;cursor:text;border-radius:4px;transition:box-shadow .1s}.da-edit:hover{box-shadow:0 0 0 2px rgba(124,92,255,.45)}.da-edit:focus{box-shadow:0 0 0 2px #7c5cff}';
      document.head.appendChild(s);
    }
  }, []);

  async function dl(node: HTMLElement | null, name: string, opaqueColor: string | null, w?: number, h?: number) {
    if (!node) return;
    setBusy(true);
    try { await exportNode(node, name, opaqueColor, w, h); }
    catch (e) { alert('Export impossible : ' + (e as Error).message); }
    finally { setBusy(false); }
  }

  const tabBtn = (on: boolean): CSSProperties => ({ padding: '8px 16px', borderRadius: 999, cursor: 'pointer', font: 'inherit', fontWeight: 700, fontSize: 13, border: '1px solid ' + (on ? PURPLE : 'var(--line)'), background: on ? PURPLE : 'transparent', color: on ? '#fff' : 'var(--txt)' });

  return (
    <div style={{ maxWidth: 960 }}>
      <h2 className="section-title">DA · Éditeur Emeria</h2>
      <p className="section-sub">Clique directement sur les textes pour les modifier, change la couleur, puis télécharge. Les éléments s&apos;exportent en PNG transparent.</p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '14px 0 20px' }}>
        <button style={tabBtn(tab === 'affiches')} onClick={() => setTab('affiches')}>Affiches</button>
        <button style={tabBtn(tab === 'elements')} onClick={() => setTab('elements')}>Éléments</button>
      </div>

      {tab === 'affiches' ? <Affiches dl={dl} busy={busy} /> : <Elements dl={dl} busy={busy} />}
    </div>
  );
}

/* ================= AFFICHES ================= */
function Affiches({ dl, busy }: { dl: (n: HTMLElement | null, name: string, opaque: string | null, w?: number, h?: number) => void; busy: boolean }) {
  const [which, setWhich] = useState<'staff' | 'recrutement'>('staff');
  const [accent, setAccent] = useState(PURPLE);
  const [pseudo, setPseudo] = useState('');
  const [showSkin, setShowSkin] = useState(true);
  const staffRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<HTMLDivElement>(null);

  const skinUrl = pseudo.trim() ? `${NMSR}/fullbody/${encodeURIComponent(pseudo.trim())}?width=1000` : '';
  const scale = 720 / W;
  const acc = { ['--acc' as string]: accent } as CSSProperties;

  const ctrl: CSSProperties = { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 };
  const btnStyle: CSSProperties = { padding: '8px 14px', borderRadius: 8, cursor: 'pointer', font: 'inherit', border: '1px solid var(--line)', background: 'transparent', color: 'var(--txt)' };
  const cornerMark = (pos: CSSProperties): CSSProperties => ({ position: 'absolute', width: 26, height: 26, ...pos });

  return (
    <>
      <div style={ctrl}>
        <button style={{ ...btnStyle, borderColor: which === 'staff' ? PURPLE : undefined }} onClick={() => setWhich('staff')}>Annonce staff</button>
        <button style={{ ...btnStyle, borderColor: which === 'recrutement' ? PURPLE : undefined }} onClick={() => setWhich('recrutement')}>Recrutement</button>
        <span style={{ marginLeft: 12, fontSize: 13, fontWeight: 700 }}>Couleur</span>
        <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} style={{ width: 40, height: 30, borderRadius: 6, border: '1px solid var(--line)', background: 'none', cursor: 'pointer' }} />
        {which === 'staff' && (
          <>
            <input value={pseudo} onChange={(e) => setPseudo(e.target.value)} placeholder="Pseudo (skin)" style={{ ...btnStyle, cursor: 'text' }} />
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}><input type="checkbox" checked={showSkin} onChange={(e) => setShowSkin(e.target.checked)} /> Skin</label>
          </>
        )}
      </div>

      <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 8 }}>Clique sur les textes pour les éditer · export {W}×{H}</div>

      {which === 'staff' ? (
        <>
          <div style={{ width: W * scale, height: H * scale, overflow: 'hidden', borderRadius: 10, border: '1px solid var(--line)' }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
              <div ref={staffRef} style={{ ...acc, width: W, height: H, position: 'relative', overflow: 'hidden', background: `repeating-linear-gradient(45deg, rgba(255,255,255,.02) 0 2px, transparent 2px 30px), ${DARK}`, fontFamily: FONT, color: '#fff' }}>
                <div style={{ position: 'absolute', inset: 40, border: '1.5px solid color-mix(in srgb, var(--acc) 40%, transparent)', borderRadius: 4 }} />
                {[{ top: 30, left: 30 }, { top: 30, right: 30 }, { bottom: 30, left: 30 }, { bottom: 30, right: 30 }].map((p, i) => (
                  <div key={i} style={cornerMark(p)}><div style={{ position: 'absolute', top: 12, left: 0, right: 0, height: 2, background: 'var(--acc)' }} /><div style={{ position: 'absolute', left: 12, top: 0, bottom: 0, width: 2, background: 'var(--acc)' }} /></div>
                ))}
                {showSkin && skinUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={skinUrl} alt="" crossOrigin="anonymous" style={{ position: 'absolute', left: 110, bottom: 0, height: H - 60, objectFit: 'contain', filter: 'drop-shadow(0 20px 40px rgba(0,0,0,.6))' }} />
                )}
                <div style={{ position: 'absolute', right: 130, top: '50%', transform: 'translateY(-50%)', textAlign: 'right', maxWidth: 1050 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: '#ffffff12', border: '1px solid color-mix(in srgb, var(--acc) 50%, transparent)', borderRadius: 10, padding: '8px 14px', marginBottom: 24 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--acc)', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 16 }}>E</div>
                    <Edit init="Emeria" style={{ fontSize: 20, fontWeight: 700 }} />
                  </div>
                  <div><Edit init="Xtazzking" style={{ fontSize: 124, fontWeight: 800, lineHeight: 1, letterSpacing: -2 }} /></div>
                  <div style={{ marginTop: 16 }}><Edit init="Responsable Administrateur" style={{ fontSize: 38, fontWeight: 700, letterSpacing: 8, textTransform: 'uppercase', color: 'var(--acc)' }} /></div>
                </div>
              </div>
            </div>
          </div>
          <button className="btn-accent" disabled={busy} onClick={() => dl(staffRef.current, 'affiche-staff', DARK, W, H)} style={{ marginTop: 14, padding: '11px 22px', borderRadius: 10 }}>{busy ? '…' : 'Télécharger PNG'}</button>
        </>
      ) : (
        <>
          <div style={{ width: W * scale, height: H * scale, overflow: 'hidden', borderRadius: 10, border: '1px solid var(--line)' }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
              <div ref={recRef} style={{ ...acc, width: W, height: H, position: 'relative', overflow: 'hidden', background: LIGHT, fontFamily: FONT, color: '#15131c' }}>
                <div style={{ position: 'absolute', inset: 55, border: '2px solid var(--acc)', borderRadius: 8 }} />
                <div style={{ position: 'absolute', inset: 55, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 90 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, marginBottom: 34 }}><LogoMark s={52} /><span style={{ fontSize: 34, fontWeight: 800, letterSpacing: 4 }}>EMERIA</span></div>
                  <Edit init="Nous recrutons des builders" style={{ fontSize: 92, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1 }} />
                  <div style={{ width: 90, height: 3, background: 'var(--acc)', margin: '30px 0' }} />
                  <Edit init="Les profils recherchés :" style={{ fontSize: 30, fontWeight: 700, marginBottom: 20 }} />
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {['Autonome', 'Mature', 'Passionné'].map((p) => (
                      <span key={p} style={{ display: 'inline-flex', gap: 8, padding: '12px 24px', borderRadius: 999, background: 'color-mix(in srgb, var(--acc) 14%, transparent)', color: '#3a2f52', fontSize: 26, fontWeight: 700 }}><span style={{ color: 'var(--acc)' }}>+</span><Edit init={p} /></span>
                    ))}
                  </div>
                  <Edit init="Des visions de grandeur ? Donnez-leur forme sur Emeria." style={{ fontSize: 26, fontStyle: 'italic', color: '#6b6478', margin: '34px 0 30px' }} />
                  <span style={{ background: 'var(--acc)', color: '#fff', padding: '18px 40px', borderRadius: 14, fontSize: 30, fontWeight: 800 }}><Edit init="Postulez sur le forum" /></span>
                </div>
              </div>
            </div>
          </div>
          <button className="btn-accent" disabled={busy} onClick={() => dl(recRef.current, 'affiche-recrutement', LIGHT, W, H)} style={{ marginTop: 14, padding: '11px 22px', borderRadius: 10 }}>{busy ? '…' : 'Télécharger PNG'}</button>
        </>
      )}
    </>
  );
}

/* ================= ÉLÉMENTS (transparent) ================= */
function Elements({ dl, busy }: { dl: (n: HTMLElement | null, name: string, opaque: string | null, w?: number, h?: number) => void; busy: boolean }) {
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const items: { name: string; node: ReactNode }[] = [
    { name: 'logo-E', node: <LogoMark s={160} /> },
    { name: 'logo-E-contour', node: <LogoMark s={160} outline /> },
    { name: 'lockup-emeria', node: <div style={{ display: 'inline-flex', alignItems: 'center', gap: 16, fontFamily: FONT }}><LogoMark s={64} /><span style={{ fontSize: 44, fontWeight: 800, letterSpacing: 5, color: '#fff' }}>EMERIA</span></div> },
    { name: 'badge-emeria', node: <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '12px 20px', borderRadius: 12, background: PURPLE, fontFamily: FONT }}><LogoMark s={30} /><span style={{ color: '#fff', fontWeight: 700, fontSize: 22 }}>Emeria</span></div> },
    { name: 'chip-grade', node: <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 22px', borderRadius: 999, background: '#17141f', fontFamily: FONT }}><span style={{ color: PURPLE, fontWeight: 800, fontSize: 22 }}>+</span><Edit init="MODÉRATEUR" style={{ color: '#fff', fontWeight: 700, fontSize: 20, letterSpacing: 1 }} /></div> },
    { name: 'bouton-plein', node: <div style={{ display: 'inline-flex', padding: '16px 30px', borderRadius: 12, background: PURPLE, color: '#fff', fontFamily: FONT, fontWeight: 700, fontSize: 24 }}><Edit init="Postulez sur le forum" /></div> },
    { name: 'bouton-contour', node: <div style={{ display: 'inline-flex', padding: '16px 30px', borderRadius: 12, background: 'transparent', color: PURPLE, border: `2px solid ${PURPLE}`, fontFamily: FONT, fontWeight: 700, fontSize: 24 }}><Edit init="Rejoindre Emeria" /></div> },
    { name: 'bouton-sombre', node: <div style={{ display: 'inline-flex', gap: 8, padding: '16px 30px', borderRadius: 12, background: '#17141f', color: '#fff', fontFamily: FONT, fontWeight: 700, fontSize: 24 }}><span style={{ opacity: .7 }}>›</span><Edit init="Voir le règlement" /></div> },
  ];

  return (
    <div>
      <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 12 }}>Clique sur le texte des badges/boutons pour l&apos;éditer, puis télécharge (fond transparent).</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
        {items.map((it, i) => (
          <div key={it.name} style={{ border: '1px solid var(--line)', borderRadius: 14, padding: 16, textAlign: 'center', background: 'repeating-conic-gradient(rgba(255,255,255,.03) 0% 25%, transparent 0% 50%) 50% / 20px 20px, var(--panel)' }}>
            <div style={{ minHeight: 130, display: 'grid', placeItems: 'center', overflow: 'auto' }}>
              <div ref={(el) => { refs.current[i] = el; }} style={{ display: 'inline-block', padding: 8 }}>{it.node}</div>
            </div>
            <button className="btn-accent" disabled={busy} onClick={() => dl(refs.current[i], it.name, null)} style={{ marginTop: 10, padding: '8px 14px', borderRadius: 10, fontSize: 13 }}>Télécharger (transparent)</button>
          </div>
        ))}
      </div>
    </div>
  );
}
