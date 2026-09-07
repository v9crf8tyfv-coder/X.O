'use client';

import { useRef, useState, type CSSProperties, type ReactNode } from 'react';

/**
 * Direction Artistique (DA) Emeria : éditeur d'affiches + éléments de marque.
 *  - Affiches (annonce staff / recrutement) : texte éditable + skin 3D optionnel → export PNG (1920×1080).
 *  - Éléments (logo, boutons, badges) → export PNG transparent.
 * Export via html-to-image (comme la section Affiches).
 */

const PURPLE = '#7c5cff';
const DARK = '#0b0a12';
const NMSR = 'https://nmsr.nickac.dev';
const W = 1920, H = 1080;

async function exportNode(node: HTMLElement, name: string, transparent: boolean, w: number, h: number) {
  const { toPng } = await import('html-to-image');
  const url = await toPng(node, {
    pixelRatio: 2,
    cacheBust: true,
    width: w,
    height: h,
    backgroundColor: transparent ? undefined : DARK,
    style: { margin: '0', transform: 'none', left: '0', top: '0' },
  });
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}-${Date.now()}.png`;
  a.click();
}

/* ---------------- Éléments de marque (téléchargeables transparent) ---------------- */

function LogoE({ size = 120 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.22, background: PURPLE,
      display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800,
      fontSize: size * 0.55, fontFamily: 'system-ui, sans-serif', boxShadow: `0 ${size*0.06}px ${size*0.15}px rgba(124,92,255,.4)`,
    }}>E</div>
  );
}

function BrandButton({ label, variant }: { label: string; variant: 'fill' | 'outline' }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 10, padding: '16px 30px', borderRadius: 14,
      fontFamily: 'system-ui, sans-serif', fontWeight: 700, fontSize: 26,
      background: variant === 'fill' ? PURPLE : 'transparent',
      color: variant === 'fill' ? '#fff' : PURPLE,
      border: `2px solid ${PURPLE}`,
      boxShadow: variant === 'fill' ? `0 8px 24px rgba(124,92,255,.35)` : 'none',
    }}>{label}</div>
  );
}

/* ---------------- Fond d'affiche (motif DA) ---------------- */
function afficheBg(accent: string): CSSProperties {
  return {
    width: W, height: H, position: 'relative', overflow: 'hidden',
    background:
      `radial-gradient(120% 120% at 15% 0%, ${accent}22 0%, transparent 45%), ` +
      `repeating-linear-gradient(45deg, rgba(255,255,255,.02) 0 2px, transparent 2px 26px), ` +
      DARK,
    fontFamily: 'system-ui, "Segoe UI", sans-serif',
    color: '#fff',
  };
}

export default function DaSection() {
  const [tab, setTab] = useState<'staff' | 'recrutement' | 'elements'>('staff');
  const [accent, setAccent] = useState(PURPLE);

  // Affiche staff
  const [pseudo, setPseudo] = useState('');
  const [showSkin, setShowSkin] = useState(true);
  const [name, setName] = useState('Pseudo');
  const [role, setRole] = useState('Responsable Administrateur');
  const [badge, setBadge] = useState('Emeria');
  const [footer, setFooter] = useState('EmeriaMC · Serveur Minecraft');

  // Affiche recrutement
  const [recTitre, setRecTitre] = useState('Nous recrutons des builders');
  const [recProfils, setRecProfils] = useState('Autonome, Mature, Passionné');
  const [recBtn, setRecBtn] = useState('Postuler sur le forum');

  const staffRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const skinUrl = pseudo.trim() ? `${NMSR}/fullbody/${encodeURIComponent(pseudo.trim())}?width=1000` : '';
  const scale = 560 / W; // aperçu réduit

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
    <div style={{ maxWidth: 900 }}>
      <h2 className="section-title">DA · Direction Artistique</h2>
      <p className="section-sub">
        Éditeur d&apos;affiches Emeria (texte personnalisable, skin 3D) et éléments de marque à télécharger.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '14px 0 20px' }}>
        <button style={tabBtn(tab === 'staff')} onClick={() => setTab('staff')}>Affiche staff</button>
        <button style={tabBtn(tab === 'recrutement')} onClick={() => setTab('recrutement')}>Affiche recrutement</button>
        <button style={tabBtn(tab === 'elements')} onClick={() => setTab('elements')}>Éléments (transparent)</button>
      </div>

      {/* Couleur d'accent commune */}
      {tab !== 'elements' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>Couleur :</span>
          <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} style={{ width: 40, height: 30, borderRadius: 6, border: '1px solid var(--line)', background: 'none', cursor: 'pointer' }} />
          <button onClick={() => setAccent(PURPLE)} style={{ ...inp, width: 'auto', cursor: 'pointer' }}>Violet Emeria</button>
        </div>
      )}

      {/* ---------------- AFFICHE STAFF ---------------- */}
      {tab === 'staff' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Pseudo (skin 3D)</label>
              <input style={inp} value={pseudo} placeholder="Pseudo Minecraft" onChange={(e) => { setPseudo(e.target.value); if (e.target.value.trim() && name === 'Pseudo') setName(e.target.value.trim()); }} />
            </div>
            <div>
              <label style={lbl}>Nom affiché (gros titre)</label>
              <input style={inp} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Rôle / sous-titre</label>
              <input style={inp} value={role} onChange={(e) => setRole(e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Badge (haut)</label>
              <input style={inp} value={badge} onChange={(e) => setBadge(e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Bas de page</label>
              <input style={inp} value={footer} onChange={(e) => setFooter(e.target.value)} />
            </div>
            <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 8, marginTop: 24 }}>
              <input type="checkbox" checked={showSkin} onChange={(e) => setShowSkin(e.target.checked)} /> Afficher le skin
            </label>
          </div>

          <div style={{ margin: '16px 0 8px', color: 'var(--muted)', fontSize: 12 }}>Aperçu — export {W}×{H}</div>
          <div style={{ width: W * scale, height: H * scale, overflow: 'hidden', borderRadius: 10, border: '1px solid var(--line)' }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
              <div ref={staffRef} style={afficheBg(accent)}>
                {/* cadre fin + coins */}
                <div style={{ position: 'absolute', inset: 40, border: `2px solid ${accent}55`, borderRadius: 6 }} />
                {/* skin */}
                {showSkin && skinUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={skinUrl} alt="" crossOrigin="anonymous"
                    style={{ position: 'absolute', left: 90, bottom: 0, height: H - 90, objectFit: 'contain', filter: 'drop-shadow(0 20px 40px rgba(0,0,0,.6))' }} />
                )}
                {/* bloc texte */}
                <div style={{ position: 'absolute', right: 120, top: '50%', transform: 'translateY(-50%)', textAlign: 'right', maxWidth: 1000 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,.06)', border: `1px solid ${accent}55`, borderRadius: 12, padding: '10px 18px', marginBottom: 26 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: accent, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: 20 }}>E</div>
                    <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: 1 }}>{badge}</span>
                  </div>
                  <div style={{ fontSize: 118, fontWeight: 800, lineHeight: 1, letterSpacing: -2 }}>{name}</div>
                  <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: 6, textTransform: 'uppercase', color: accent, marginTop: 18 }}>{role}</div>
                </div>
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 60, textAlign: 'center', color: 'rgba(255,255,255,.35)', fontSize: 22, letterSpacing: 2 }}>{footer}</div>
              </div>
            </div>
          </div>
          <button className="btn-accent" disabled={busy} onClick={() => dl(staffRef.current, 'affiche-staff', false)} style={{ marginTop: 14, padding: '11px 22px', borderRadius: 10 }}>
            {busy ? '…' : 'Télécharger PNG (1920×1080)'}
          </button>
        </>
      )}

      {/* ---------------- AFFICHE RECRUTEMENT ---------------- */}
      {tab === 'recrutement' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={lbl}>Titre</label><input style={inp} value={recTitre} onChange={(e) => setRecTitre(e.target.value)} /></div>
            <div><label style={lbl}>Profils recherchés (séparés par des virgules)</label><input style={inp} value={recProfils} onChange={(e) => setRecProfils(e.target.value)} /></div>
            <div><label style={lbl}>Texte du bouton</label><input style={inp} value={recBtn} onChange={(e) => setRecBtn(e.target.value)} /></div>
          </div>

          <div style={{ margin: '16px 0 8px', color: 'var(--muted)', fontSize: 12 }}>Aperçu — export {W}×{H}</div>
          <div style={{ width: W * scale, height: H * scale, overflow: 'hidden', borderRadius: 10, border: '1px solid var(--line)' }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
              <div ref={recRef} style={afficheBg(accent)}>
                <div style={{ position: 'absolute', inset: 60, border: `2px solid ${accent}55`, borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 80 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: 30 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: accent, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: 24 }}>E</div>
                    <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: 2 }}>EMERIA</span>
                  </div>
                  <div style={{ fontSize: 92, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1 }}>{recTitre}</div>
                  <div style={{ fontSize: 30, color: 'rgba(255,255,255,.6)', margin: '36px 0 20px', fontWeight: 700 }}>Les profils recherchés :</div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {recProfils.split(',').map((p) => p.trim()).filter(Boolean).map((p, i) => (
                      <span key={i} style={{ padding: '12px 24px', borderRadius: 999, border: `2px solid ${accent}`, color: '#fff', fontSize: 28, fontWeight: 700 }}>{p}</span>
                    ))}
                  </div>
                  <div style={{ marginTop: 50, background: accent, color: '#fff', padding: '20px 44px', borderRadius: 16, fontSize: 32, fontWeight: 800, boxShadow: `0 12px 30px ${accent}55` }}>{recBtn}</div>
                </div>
              </div>
            </div>
          </div>
          <button className="btn-accent" disabled={busy} onClick={() => dl(recRef.current, 'affiche-recrutement', false)} style={{ marginTop: 14, padding: '11px 22px', borderRadius: 10 }}>
            {busy ? '…' : 'Télécharger PNG (1920×1080)'}
          </button>
        </>
      )}

      {/* ---------------- ÉLÉMENTS (transparent) ---------------- */}
      {tab === 'elements' && (
        <ElementsGrid busy={busy} onDl={dl} />
      )}
    </div>
  );
}

/* Grille d'éléments téléchargeables en PNG transparent. */
function ElementsGrid({ busy, onDl }: { busy: boolean; onDl: (n: HTMLElement | null, base: string, t: boolean, w?: number, h?: number) => void }) {
  const items: { name: string; w: number; h: number; node: ReactNode }[] = [
    { name: 'logo-emeria', w: 260, h: 260, node: <LogoE size={220} /> },
    { name: 'bouton-postuler', w: 420, h: 100, node: <BrandButton label="Postuler sur le forum" variant="fill" /> },
    { name: 'bouton-rejoindre', w: 360, h: 100, node: <BrandButton label="Rejoindre Emeria" variant="outline" /> },
    { name: 'bouton-reglement', w: 340, h: 100, node: <BrandButton label="Vers le règlement" variant="outline" /> },
  ];
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
      {items.map((it, i) => (
        <div key={it.name} style={{ border: '1px solid var(--line)', borderRadius: 14, padding: 16, textAlign: 'center', background: 'repeating-conic-gradient(rgba(255,255,255,.03) 0% 25%, transparent 0% 50%) 50% / 20px 20px, var(--panel)' }}>
          <div style={{ display: 'grid', placeItems: 'center', minHeight: 140, overflow: 'hidden' }}>
            <div ref={(el) => { refs.current[i] = el; }} style={{ width: it.w, height: it.h, display: 'grid', placeItems: 'center', transform: `scale(${Math.min(1, 200 / it.w)})` }}>
              {it.node}
            </div>
          </div>
          <button className="btn-accent" disabled={busy} onClick={() => onDl(refs.current[i], it.name, true, it.w, it.h)} style={{ marginTop: 10, padding: '8px 14px', borderRadius: 10, fontSize: 13 }}>
            Télécharger (transparent)
          </button>
        </div>
      ))}
    </div>
  );
}
