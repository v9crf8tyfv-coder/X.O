'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/**
 * DA Emeria (fidèle au kit) : éditeur d'affiches + éléments de marque.
 * Police Sora, violet #7c5cff. Export via html-to-image (PNG, transparent pour les éléments).
 */

const PURPLE = '#7c5cff';
const DARK = '#0b0a12';
const LIGHT = '#f2f0f7';
const NMSR = 'https://nmsr.nickac.dev';
const W = 1920, H = 1080;
const FONT = "'Sora', system-ui, sans-serif";

async function exportNode(node: HTMLElement, name: string, transparent: boolean, w: number, h: number) {
  try { await (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts?.ready; } catch { /* ok */ }
  const { toPng } = await import('html-to-image');
  const url = await toPng(node, {
    pixelRatio: 2, cacheBust: true, width: w, height: h,
    backgroundColor: transparent ? undefined : 'transparent',
    style: { margin: '0', transform: 'none', left: '0', top: '0' },
  });
  const a = document.createElement('a');
  a.href = url; a.download = `${name}-${Date.now()}.png`; a.click();
}

/* ---------- petits composants de marque ---------- */

function LogoMark({ s = 44, outline = false }: { s?: number; outline?: boolean }) {
  return (
    <div style={{
      width: s, height: s, borderRadius: s * 0.28, display: 'grid', placeItems: 'center',
      background: outline ? 'transparent' : PURPLE, border: outline ? `2px solid ${PURPLE}` : 'none',
      color: outline ? PURPLE : '#fff', fontWeight: 800, fontFamily: FONT, fontSize: s * 0.5,
    }}>E</div>
  );
}

function Lockup({ dark = false }: { dark?: boolean }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, fontFamily: FONT }}>
      <LogoMark s={52} />
      <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: 4, color: dark ? '#fff' : '#15131c' }}>EMERIA</span>
    </div>
  );
}

function ServerBadge({ variant }: { variant: 'dark' | 'purple' | 'outline' }) {
  const bg = variant === 'dark' ? '#17141f' : variant === 'purple' ? PURPLE : 'transparent';
  const bd = variant === 'outline' ? `1.5px solid ${PURPLE}` : 'none';
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10, background: bg, border: bd, fontFamily: FONT }}>
      <LogoMark s={22} />
      <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>Emeria</span>
    </div>
  );
}

function GradeChip({ label }: { label: string }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 999, background: '#17141f', fontFamily: FONT }}>
      <span style={{ color: PURPLE, fontWeight: 800 }}>+</span>
      <span style={{ color: '#fff', fontWeight: 700, fontSize: 15, letterSpacing: 1, textTransform: 'uppercase' }}>{label}</span>
    </div>
  );
}

function BrandButton({ label, variant }: { label: string; variant: 'fill' | 'outline' | 'dark' }) {
  const st: CSSProperties =
    variant === 'fill' ? { background: PURPLE, color: '#fff', border: `2px solid ${PURPLE}` }
    : variant === 'outline' ? { background: 'transparent', color: PURPLE, border: `2px solid ${PURPLE}` }
    : { background: '#17141f', color: '#fff', border: '2px solid #17141f' };
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 26px', borderRadius: 12, fontFamily: FONT, fontWeight: 700, fontSize: 22, whiteSpace: 'nowrap', ...st }}>
      {variant === 'dark' && <span style={{ opacity: .8 }}>›</span>}{label}
    </div>
  );
}

/* ---------- section ---------- */

export default function DaSection() {
  const [tab, setTab] = useState<'affiches' | 'elements'>('affiches');

  // charge la police Sora une fois
  useEffect(() => {
    if (document.getElementById('sora-font')) return;
    const l = document.createElement('link');
    l.id = 'sora-font'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&display=swap';
    document.head.appendChild(l);
  }, []);

  const [busy, setBusy] = useState(false);
  async function dl(node: HTMLElement | null, base: string, transparent: boolean, w = W, h = H) {
    if (!node) return;
    setBusy(true);
    try { await exportNode(node, base, transparent, w, h); }
    catch (e) { alert('Export impossible : ' + (e as Error).message); }
    finally { setBusy(false); }
  }

  const lbl: CSSProperties = { display: 'block', fontSize: 12, color: 'var(--muted,#8a8a94)', margin: '10px 0 4px', fontWeight: 700 };
  const inp: CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 8, color: 'var(--txt,#e8e8ec)', padding: '9px 11px', font: 'inherit' };
  const tabBtn = (on: boolean): CSSProperties => ({ padding: '8px 16px', borderRadius: 999, cursor: 'pointer', font: 'inherit', fontWeight: 700, fontSize: 13, border: '1px solid ' + (on ? PURPLE : 'var(--line)'), background: on ? PURPLE : 'transparent', color: on ? '#fff' : 'var(--txt)' });

  return (
    <div style={{ maxWidth: 940 }}>
      <h2 className="section-title">DA · Direction Artistique</h2>
      <p className="section-sub">Kit Emeria : affiches personnalisables (export PNG 1920×1080) et éléments à télécharger en transparent.</p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '14px 0 20px' }}>
        <button style={tabBtn(tab === 'affiches')} onClick={() => setTab('affiches')}>Affiches</button>
        <button style={tabBtn(tab === 'elements')} onClick={() => setTab('elements')}>Éléments (transparent)</button>
      </div>

      {tab === 'affiches' ? <Affiches dl={dl} busy={busy} lbl={lbl} inp={inp} /> : <Elements dl={dl} busy={busy} lbl={lbl} inp={inp} />}
    </div>
  );
}

/* ================= AFFICHES ================= */
function Affiches({ dl, busy, lbl, inp }: { dl: (n: HTMLElement | null, b: string, t: boolean, w?: number, h?: number) => void; busy: boolean; lbl: CSSProperties; inp: CSSProperties }) {
  const [which, setWhich] = useState<'staff' | 'recrutement'>('staff');
  const [accent, setAccent] = useState(PURPLE);
  // staff
  const [pseudo, setPseudo] = useState('');
  const [showSkin, setShowSkin] = useState(true);
  const [name, setName] = useState('Xtazzking');
  const [role, setRole] = useState('Responsable Administrateur');
  // recrutement
  const [titre, setTitre] = useState('Nous recrutons des builders');
  const [profils, setProfils] = useState('Autonome, Mature, Passionné');
  const [accroche, setAccroche] = useState('Des visions de grandeur ? Donnez-leur forme sur Emeria.');
  const [btn, setBtn] = useState('Postulez sur le forum');

  const staffRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<HTMLDivElement>(null);
  const skinUrl = pseudo.trim() ? `${NMSR}/fullbody/${encodeURIComponent(pseudo.trim())}?width=1000` : '';
  const scale = 600 / W;

  const corner = (pos: CSSProperties): CSSProperties => ({ position: 'absolute', width: 26, height: 26, ...pos });

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={() => setWhich('staff')} style={{ ...inp, width: 'auto', cursor: 'pointer', borderColor: which === 'staff' ? PURPLE : undefined }}>Annonce staff</button>
        <button onClick={() => setWhich('recrutement')} style={{ ...inp, width: 'auto', cursor: 'pointer', borderColor: which === 'recrutement' ? PURPLE : undefined }}>Recrutement</button>
        <label style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Couleur</span>
          <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} style={{ width: 38, height: 30, borderRadius: 6, border: '1px solid var(--line)', background: 'none', cursor: 'pointer' }} />
        </label>
      </div>

      {which === 'staff' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={lbl}>Pseudo (skin)</label><input style={inp} value={pseudo} placeholder="Pseudo Minecraft" onChange={(e) => setPseudo(e.target.value)} /></div>
            <div><label style={lbl}>Nom (gros titre)</label><input style={inp} value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><label style={lbl}>Rôle / sous-titre</label><input style={inp} value={role} onChange={(e) => setRole(e.target.value)} /></div>
            <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 8, marginTop: 22 }}><input type="checkbox" checked={showSkin} onChange={(e) => setShowSkin(e.target.checked)} /> Afficher le skin</label>
          </div>
          <Preview scale={scale}>
            <div ref={staffRef} style={{ width: W, height: H, position: 'relative', overflow: 'hidden', background: `repeating-linear-gradient(45deg, rgba(255,255,255,.02) 0 2px, transparent 2px 30px), ${DARK}`, fontFamily: FONT, color: '#fff' }}>
              <div style={{ position: 'absolute', inset: 40, border: `1.5px solid ${accent}44`, borderRadius: 4 }} />
              {[{ top: 30, left: 30 }, { top: 30, right: 30 }, { bottom: 30, left: 30 }, { bottom: 30, right: 30 }].map((p, i) => (
                <div key={i} style={corner(p)}><div style={{ position: 'absolute', top: 12, left: 0, right: 0, height: 2, background: accent }} /><div style={{ position: 'absolute', left: 12, top: 0, bottom: 0, width: 2, background: accent }} /></div>
              ))}
              {showSkin && skinUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={skinUrl} alt="" crossOrigin="anonymous" style={{ position: 'absolute', left: 110, bottom: 0, height: H - 60, objectFit: 'contain', filter: 'drop-shadow(0 20px 40px rgba(0,0,0,.6))' }} />
              )}
              <div style={{ position: 'absolute', right: 130, top: '50%', transform: 'translateY(-50%)', textAlign: 'right', maxWidth: 1050 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: '#ffffff12', border: `1px solid ${accent}55`, borderRadius: 10, padding: '8px 14px', marginBottom: 24 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: accent, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 16 }}>E</div>
                  <span style={{ fontSize: 20, fontWeight: 700 }}>Emeria</span>
                </div>
                <div style={{ fontSize: 124, fontWeight: 800, lineHeight: 1, letterSpacing: -2 }}>{name}</div>
                <div style={{ fontSize: 38, fontWeight: 700, letterSpacing: 8, textTransform: 'uppercase', color: accent, marginTop: 16 }}>{role}</div>
              </div>
            </div>
          </Preview>
          <button className="btn-accent" disabled={busy} onClick={() => dl(staffRef.current, 'affiche-staff', false)} style={{ marginTop: 14, padding: '11px 22px', borderRadius: 10 }}>{busy ? '…' : 'Télécharger PNG (1920×1080)'}</button>
        </>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={lbl}>Titre</label><input style={inp} value={titre} onChange={(e) => setTitre(e.target.value)} /></div>
            <div><label style={lbl}>Profils (virgules)</label><input style={inp} value={profils} onChange={(e) => setProfils(e.target.value)} /></div>
            <div><label style={lbl}>Accroche (italique)</label><input style={inp} value={accroche} onChange={(e) => setAccroche(e.target.value)} /></div>
            <div><label style={lbl}>Bouton</label><input style={inp} value={btn} onChange={(e) => setBtn(e.target.value)} /></div>
          </div>
          <Preview scale={scale}>
            <div ref={recRef} style={{ width: W, height: H, position: 'relative', overflow: 'hidden', background: LIGHT, fontFamily: FONT, color: '#15131c' }}>
              <div style={{ position: 'absolute', inset: 55, border: `2px solid ${accent}`, borderRadius: 8 }} />
              <div style={{ position: 'absolute', inset: 55, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 90 }}>
                <div style={{ marginBottom: 34 }}><Lockup /></div>
                <div style={{ fontSize: 92, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1 }}>{titre}</div>
                <div style={{ width: 90, height: 3, background: accent, margin: '30px 0' }} />
                <div style={{ fontSize: 30, fontWeight: 700, marginBottom: 20 }}>Les profils recherchés :</div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {profils.split(',').map((p) => p.trim()).filter(Boolean).map((p, i) => (
                    <span key={i} style={{ display: 'inline-flex', gap: 8, padding: '12px 24px', borderRadius: 999, background: `${accent}1e`, color: '#3a2f52', fontSize: 26, fontWeight: 700 }}><span style={{ color: accent }}>+</span>{p}</span>
                  ))}
                </div>
                <div style={{ fontSize: 26, fontStyle: 'italic', color: '#6b6478', margin: '34px 0 30px' }}>{accroche}</div>
                <div style={{ background: accent, color: '#fff', padding: '18px 40px', borderRadius: 14, fontSize: 30, fontWeight: 800, boxShadow: `0 12px 30px ${accent}55` }}>{btn}</div>
              </div>
            </div>
          </Preview>
          <button className="btn-accent" disabled={busy} onClick={() => dl(recRef.current, 'affiche-recrutement', false)} style={{ marginTop: 14, padding: '11px 22px', borderRadius: 10 }}>{busy ? '…' : 'Télécharger PNG (1920×1080)'}</button>
        </>
      )}
    </>
  );
}

function Preview({ scale, children }: { scale: number; children: ReactNode }) {
  return (
    <>
      <div style={{ margin: '16px 0 8px', color: 'var(--muted)', fontSize: 12 }}>Aperçu — export {W}×{H}</div>
      <div style={{ width: W * scale, height: H * scale, overflow: 'hidden', borderRadius: 10, border: '1px solid var(--line)' }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>{children}</div>
      </div>
    </>
  );
}

/* ================= ÉLÉMENTS (transparent) ================= */
function Elements({ dl, busy, lbl, inp }: { dl: (n: HTMLElement | null, b: string, t: boolean, w?: number, h?: number) => void; busy: boolean; lbl: CSSProperties; inp: CSSProperties }) {
  // boutons éditables
  const [btnLabel, setBtnLabel] = useState('Postulez sur le forum');
  const [btnVariant, setBtnVariant] = useState<'fill' | 'outline' | 'dark'>('fill');
  const btnRef = useRef<HTMLDivElement>(null);

  const cell: CSSProperties = { border: '1px solid var(--line)', borderRadius: 14, padding: 16, textAlign: 'center', background: 'repeating-conic-gradient(rgba(255,255,255,.03) 0% 25%, transparent 0% 50%) 50% / 20px 20px, var(--panel)' };

  // éléments fixes (logos, badges, chips)
  const fixed: { name: string; w: number; h: number; node: ReactNode }[] = [
    { name: 'logo-E', w: 160, h: 160, node: <LogoMark s={140} /> },
    { name: 'logo-E-contour', w: 160, h: 160, node: <LogoMark s={140} outline /> },
    { name: 'lockup-emeria', w: 340, h: 90, node: <div style={{ transform: 'scale(1)' }}><Lockup dark /></div> },
    { name: 'badge-emeria', w: 200, h: 70, node: <ServerBadge variant="purple" /> },
    { name: 'chip-joueur', w: 200, h: 60, node: <GradeChip label="Joueur" /> },
    { name: 'chip-moderateur', w: 240, h: 60, node: <GradeChip label="Modérateur" /> },
    { name: 'chip-administrateur', w: 280, h: 60, node: <GradeChip label="Administrateur" /> },
    { name: 'chip-fondateur', w: 240, h: 60, node: <GradeChip label="Fondateur" /> },
  ];
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  return (
    <div>
      {/* Bouton éditable */}
      <h3 style={{ fontSize: 15, fontWeight: 800, margin: '4px 0 10px' }}>Bouton personnalisable</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end', marginBottom: 12 }}>
        <div><label style={lbl}>Texte du bouton</label><input style={inp} value={btnLabel} onChange={(e) => setBtnLabel(e.target.value)} /></div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['fill', 'outline', 'dark'] as const).map((v) => (
            <button key={v} onClick={() => setBtnVariant(v)} style={{ ...inp, width: 'auto', cursor: 'pointer', borderColor: btnVariant === v ? PURPLE : undefined }}>{v === 'fill' ? 'Plein' : v === 'outline' ? 'Contour' : 'Sombre'}</button>
          ))}
        </div>
      </div>
      <div style={{ ...cell, marginBottom: 24 }}>
        <div style={{ display: 'grid', placeItems: 'center', minHeight: 90, overflow: 'hidden' }}>
          <div ref={btnRef} style={{ display: 'inline-block', padding: 6 }}><BrandButton label={btnLabel} variant={btnVariant} /></div>
        </div>
        <button className="btn-accent" disabled={busy} onClick={() => dl(btnRef.current, 'bouton', true, 0, 0)} style={{ marginTop: 10, padding: '8px 16px', borderRadius: 10, fontSize: 13 }}>Télécharger (transparent)</button>
      </div>

      {/* Logos, badges, chips */}
      <h3 style={{ fontSize: 15, fontWeight: 800, margin: '4px 0 10px' }}>Logos & badges</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 16 }}>
        {fixed.map((it, i) => (
          <div key={it.name} style={cell}>
            <div style={{ display: 'grid', placeItems: 'center', minHeight: 130, overflow: 'hidden' }}>
              <div ref={(el) => { refs.current[i] = el; }} style={{ display: 'inline-block', padding: 6 }}>{it.node}</div>
            </div>
            <button className="btn-accent" disabled={busy} onClick={() => dl(refs.current[i], it.name, true, 0, 0)} style={{ marginTop: 10, padding: '8px 14px', borderRadius: 10, fontSize: 13 }}>Télécharger (transparent)</button>
          </div>
        ))}
      </div>
    </div>
  );
}
