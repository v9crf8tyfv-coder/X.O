'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/**
 * DA Emeria — reproduction éditable de toute la planche (Design.pdf).
 * - On clique sur les textes pour les modifier (contentEditable).
 * - Le sélecteur de couleur recolore tout l'accent (variable CSS, n'efface pas les textes).
 * - Chaque élément a son bouton de téléchargement (PNG transparent) au survol ;
 *   un bouton télécharge toute la planche.
 * Correctif Safari : export via Blob (les data: URL ne se téléchargeaient pas, ouvraient un onglet).
 */

const ACC = '#7c5cff';
const DARK = '#100c1c';
const CARD_DARK = '#15101f';
const PAGE = '#f2f0f7';
const INK = '#15131c';
const MUT = '#8a8397';
const FONT = "'Sora', system-ui, sans-serif";

/** Export d'un nœud en PNG via Blob (téléchargement fiable, y compris Safari). */
async function exportNode(node: HTMLElement, name: string, opaque: string | null, pixelRatio = 2) {
  try { await (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts?.ready; } catch { /* ok */ }
  const { toBlob } = await import('html-to-image');
  const blob = await toBlob(node, {
    pixelRatio,
    cacheBust: false, // le buste est déjà embarqué en data URL
    backgroundColor: opaque ?? undefined, // null => transparent
    style: { margin: '0', transform: 'none' },
    filter: (n: HTMLElement) => !(n instanceof HTMLElement && n.dataset && n.dataset.noexport === '1'),
  });
  if (!blob) throw new Error('rendu vide');
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = `emeria-${name}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 5000);
}

/** Texte éditable au clic (contenu initial constant → React n'écrase jamais tes modifs). */
function Edit({ init, style, block }: { init: string; style?: CSSProperties; block?: boolean }) {
  const Tag = block ? 'div' : 'span';
  return (
    <Tag className="da-edit" contentEditable suppressContentEditableWarning spellCheck={false} style={style}>
      {init}
    </Tag>
  );
}

/** Cellule exportable : contenu + légende (hors export élément) + bouton télécharger au survol. */
function Item({ name, opaque = null, pr = 2, caption, children, cellStyle, full }:
  { name: string; opaque?: string | null; pr?: number; caption?: string; children: ReactNode; cellStyle?: CSSProperties; full?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="da-item" style={cellStyle}>
      <button className="da-dl" data-noexport="1" title="Télécharger en PNG"
        onClick={() => ref.current && exportNode(ref.current, name, opaque, pr).catch((e) => alert('Export impossible : ' + (e as Error).message))}>
        ⬇ PNG
      </button>
      <div ref={ref} style={full ? { display: 'block', width: '100%' } : { display: 'inline-block' }}>{children}</div>
      {caption && <div className="da-cap">{caption}</div>}
    </div>
  );
}

function SecTitle({ n, children }: { n: string; children: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '30px 0 16px' }}>
      <span style={{ color: 'var(--acc)', fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{n} — {children}</span>
      <span style={{ flex: 1, height: 1, background: 'color-mix(in srgb, var(--acc) 30%, transparent)' }} />
      <span style={{ width: 6, height: 6, transform: 'rotate(45deg)', background: 'var(--acc)' }} />
    </div>
  );
}

/* ---- briques de marque ---- */
function Mark({ s = 40, variant = 'full' }: { s?: number; variant?: 'full' | 'outline' | 'faint' }) {
  const bg = variant === 'full' ? 'var(--acc)' : 'transparent';
  const bd = variant === 'outline' ? `${Math.max(2, s * 0.05)}px solid var(--acc)` : 'none';
  const col = variant === 'full' ? '#fff' : variant === 'faint' ? 'color-mix(in srgb, var(--acc) 35%, #cfc8dd)' : 'var(--acc)';
  return <div style={{ width: s, height: s, borderRadius: s * 0.28, display: 'grid', placeItems: 'center', background: bg, border: bd, color: col, fontWeight: 800, fontFamily: FONT, fontSize: s * 0.5 }}>E</div>;
}
function Lockup({ dark = false, s = 30 }: { dark?: boolean; s?: number }) {
  return <div style={{ display: 'inline-flex', alignItems: 'center', gap: s * 0.4 }}><Mark s={s} /><span style={{ fontSize: s * 0.62, fontWeight: 800, letterSpacing: s * 0.12, color: dark ? '#fff' : INK }}>EMERIA</span></div>;
}

export default function DaSection() {
  const [accent, setAccent] = useState(ACC);
  const [pseudo, setPseudo] = useState('');
  const [showSkin, setShowSkin] = useState(true);
  const [bustData, setBustData] = useState(''); // buste en data URL (embarqué → présent dans l'export)
  const pageRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  // Récupère le buste NMSR et le convertit en data URL (débounce). Ainsi html-to-image
  // n'a rien à télécharger au moment de l'export : l'image est déjà dans la page.
  useEffect(() => {
    const p = pseudo.trim();
    setBustData('');
    if (p.length < 2) return;
    let cancel = false;
    const t = setTimeout(() => {
      fetch(`https://nmsr.nickac.dev/bust/${encodeURIComponent(p)}?width=800`, { mode: 'cors' })
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('nmsr'))))
        .then((b) => new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.onerror = rej; fr.readAsDataURL(b); }))
        .then((d) => { if (!cancel) setBustData(d); })
        .catch(() => {});
    }, 450);
    return () => { cancel = true; clearTimeout(t); };
  }, [pseudo]);

  useEffect(() => {
    if (!document.getElementById('sora-font')) {
      const l = document.createElement('link'); l.id = 'sora-font'; l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&family=Playfair+Display:ital@1&display=swap';
      document.head.appendChild(l);
    }
    if (!document.getElementById('da-style')) {
      const s = document.createElement('style'); s.id = 'da-style';
      s.textContent = `
        .da-edit{outline:none;cursor:text;border-radius:3px;transition:box-shadow .1s}
        .da-edit:hover{box-shadow:0 0 0 2px rgba(124,92,255,.4)}
        .da-edit:focus{box-shadow:0 0 0 2px var(--acc)}
        .da-item{position:relative}
        .da-cap{font-size:10px;color:${MUT};margin-top:7px;font-family:${FONT}}
        .da-dl{position:absolute;top:4px;right:4px;z-index:6;opacity:0;transition:opacity .12s;
          font:600 10px ${FONT};padding:3px 7px;border-radius:6px;border:1px solid var(--acc);
          background:var(--acc);color:#fff;cursor:pointer}
        .da-item:hover>.da-dl{opacity:1}
        .da-swatch{width:26px;height:26px;border-radius:7px}
      `;
      document.head.appendChild(s);
    }
  }, []);

  const rootVars = { ['--acc' as string]: accent } as CSSProperties;

  const card: CSSProperties = { borderRadius: 14, padding: 18, position: 'relative', overflow: 'hidden' };
  const lightCard: CSSProperties = { ...card, background: '#fff', border: `1px solid #e6e2ef` };

  async function downloadAll() {
    if (!pageRef.current) return;
    setBusy(true);
    try { await exportNode(pageRef.current, 'planche-DA', PAGE, 2); }
    catch (e) { alert('Export impossible : ' + (e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ maxWidth: 1040 }}>
      <h2 className="section-title">DA · Planche Emeria</h2>
      <p className="section-sub">Toute la charte, éditable : clique sur un texte pour le modifier, change la couleur, survole un élément pour le télécharger en PNG transparent.</p>

      {/* barre d'outils */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', margin: '14px 0 18px' }}>
        <button className="btn-accent" disabled={busy} onClick={downloadAll} style={{ padding: '10px 18px', borderRadius: 10 }}>{busy ? '…' : 'Télécharger toute la planche'}</button>
        <span style={{ fontSize: 13, fontWeight: 700 }}>Couleur</span>
        <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} style={{ width: 40, height: 30, borderRadius: 6, border: '1px solid var(--line)', background: 'none', cursor: 'pointer' }} />
        <input value={pseudo} onChange={(e) => setPseudo(e.target.value)} placeholder="Pseudo affiche staff" style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: 'var(--txt)', font: 'inherit' }} />
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}><input type="checkbox" checked={showSkin} onChange={(e) => setShowSkin(e.target.checked)} /> Skin</label>
      </div>

      {/* ===================== LA PLANCHE ===================== */}
      <div ref={pageRef} style={{ ...rootVars, background: PAGE, borderRadius: 16, padding: 26, fontFamily: FONT, color: INK }}>

        {/* header */}
        <div style={{ ...card, background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Mark s={40} />
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: 4, color: '#fff' }}>EMERIA</span>
                <span style={{ fontSize: 10, letterSpacing: 3, color: MUT }}>MC</span>
              </div>
              <Edit init="Direction artistique & kit d'affiches — v1" style={{ display: 'block', fontSize: 12, fontStyle: 'italic', color: '#b9b2c9', marginTop: 3 }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['var(--acc)', 'color-mix(in srgb, var(--acc) 65%, #fff)', '#2a2140', '#3a3450', '#fff'].map((c, i) => (
              <div key={i} className="da-swatch" style={{ background: c, border: c === '#fff' ? '1px solid #6b6478' : 'none' }} />
            ))}
          </div>
        </div>

        {/* 01 LOGOTYPES */}
        <SecTitle n="01">LOGOTYPES</SecTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
          <Item name="lockup-clair" cellStyle={lightCard} caption="lockup horizontal — usage principal"><div style={{ padding: '20px 8px' }}><Lockup s={30} /></div></Item>
          <Item name="lockup-centre" opaque={CARD_DARK} cellStyle={{ ...card, background: CARD_DARK }} caption="lockup centré — affiches / intro">
            <div style={{ display: 'grid', placeItems: 'center', gap: 8, padding: '14px 30px' }}><Mark s={40} /><span style={{ fontSize: 20, fontWeight: 800, letterSpacing: 6, color: '#fff' }}>EMERIA</span><span style={{ width: 5, height: 5, transform: 'rotate(45deg)', background: 'var(--acc)' }} /></div>
          </Item>
          <Item name="lockup-mono" opaque="#7c5cff" cellStyle={{ ...card, background: 'var(--acc)' }} caption="version monochrome — fond violet">
            <div style={{ padding: '20px 8px' }}><div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}><div style={{ width: 34, height: 34, borderRadius: 10, background: '#fff', display: 'grid', placeItems: 'center', color: 'var(--acc)', fontWeight: 800, fontSize: 18 }}>E</div><span style={{ fontSize: 19, fontWeight: 800, letterSpacing: 4, color: '#fff' }}>EMERIA</span></div></div>
          </Item>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginTop: 14 }}>
          <Item name="icone-source" cellStyle={lightCard} caption="logo icône — source"><div style={{ padding: 18 }}><Mark s={46} /></div></Item>
          <Item name="icone-pleine" cellStyle={lightCard} caption="version pleine"><div style={{ padding: 18 }}><Mark s={46} variant="full" /></div></Item>
          <Item name="icone-contour" opaque={CARD_DARK} cellStyle={{ ...card, background: CARD_DARK }} caption="version contour"><div style={{ padding: 18 }}><Mark s={46} variant="outline" /></div></Item>
          <Item name="icone-transparente" cellStyle={lightCard} caption="version transparente"><div style={{ padding: 18 }}><Mark s={46} variant="faint" /></div></Item>
        </div>

        {/* 02 BADGES & GRADES */}
        <SecTitle n="02">BADGES SERVEUR & GRADES</SecTitle>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <Item name="badge-sombre" cellStyle={{}}><div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10, background: CARD_DARK }}><Mark s={22} /><span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Emeria</span></div></Item>
          <Item name="badge-tint" cellStyle={{}}><div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10, background: 'color-mix(in srgb, var(--acc) 18%, #fff)', border: '1px solid var(--acc)' }}><Mark s={22} /><span style={{ color: 'var(--acc)', fontWeight: 700, fontSize: 15 }}>Emeria</span></div></Item>
          <Item name="badge-clair" cellStyle={{}}><div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10, background: '#fff', border: '1px solid #e6e2ef' }}><Mark s={22} /><span style={{ color: INK, fontWeight: 700, fontSize: 15 }}>Emeria</span></div></Item>
          <Item name="badge-plein" opaque="#7c5cff" cellStyle={{}}><div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10, background: 'var(--acc)' }}><div style={{ width: 22, height: 22, borderRadius: 7, background: '#fff', display: 'grid', placeItems: 'center', color: 'var(--acc)', fontWeight: 800, fontSize: 12 }}>E</div><span style={{ color: '#fff', fontWeight: 800, fontSize: 15, letterSpacing: 1 }}>EMERIA</span></div></Item>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
          {['JOUEUR', 'MODÉRATEUR', 'ADMINISTRATEUR', 'FONDATEUR'].map((g) => (
            <Item key={g} name={`grade-${g.toLowerCase()}`} cellStyle={{}}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 999, background: CARD_DARK }}>
                <span style={{ color: 'var(--acc)', fontWeight: 800 }}>+</span><Edit init={g} style={{ color: '#fff', fontWeight: 700, fontSize: 13, letterSpacing: 1 }} />
              </div>
            </Item>
          ))}
        </div>

        {/* 03 LIGNES, FILETS & CADRES */}
        <SecTitle n="03">LIGNES, FILETS & CADRES</SecTitle>
        <div style={{ ...lightCard, padding: 26 }}>
          <div style={{ display: 'grid', gap: 22 }}>
            <Item name="filet-double" cellStyle={{}} caption="filet double — sous les titres">
              <div style={{ width: 340 }}><div style={{ height: 2, background: 'var(--acc)' }} /><div style={{ height: 1, background: 'color-mix(in srgb, var(--acc) 40%, transparent)', marginTop: 3 }} /></div>
            </Item>
            <Item name="filet-losange" cellStyle={{}} caption="filet à losange central — séparateur">
              <div style={{ width: 340, display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ flex: 1, height: 1, background: 'var(--acc)' }} /><span style={{ width: 7, height: 7, transform: 'rotate(45deg)', background: 'var(--acc)' }} /><div style={{ flex: 1, height: 1, background: 'var(--acc)' }} /></div>
            </Item>
            <Item name="filet-fonction" cellStyle={{}} caption="filet à fonction — bas d'affiche">
              <div style={{ width: 340, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--acc)' }} /><div style={{ flex: 1, height: 1, background: 'var(--acc)' }} /><span style={{ width: 7, height: 7, transform: 'rotate(45deg)', background: 'var(--acc)' }} /><div style={{ flex: 1, height: 1, background: 'var(--acc)' }} /><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--acc)' }} /></div>
            </Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18, marginTop: 26 }}>
            <Item name="cadre-double-losange" full cellStyle={{}} caption="cadre 4 — double filet + losange">
              <div style={{ position: 'relative', width: '100%', height: 120, background: 'color-mix(in srgb, var(--acc) 6%, transparent)', border: '1px solid var(--acc)', outline: '1px solid var(--acc)', outlineOffset: 3 }}>
                {[{ top: -4, left: -4 }, { top: -4, right: -4 }, { bottom: -4, left: -4 }, { bottom: -4, right: -4 }].map((p, i) => <span key={i} style={{ position: 'absolute', width: 7, height: 7, transform: 'rotate(45deg)', background: 'var(--acc)', ...p }} />)}
              </div>
            </Item>
            <Item name="cadre-equerres" full cellStyle={{}} caption="cadre 2 — équerres d'angle">
              <div style={{ position: 'relative', width: '100%', height: 120, background: 'color-mix(in srgb, var(--acc) 4%, transparent)' }}>
                {[['top', 'left'], ['top', 'right'], ['bottom', 'left'], ['bottom', 'right']].map(([v, h], i) => (
                  <span key={i} style={{ position: 'absolute', width: 22, height: 22, [v]: 0, [h]: 0, borderTop: v === 'top' ? '2px solid var(--acc)' : 'none', borderBottom: v === 'bottom' ? '2px solid var(--acc)' : 'none', borderLeft: h === 'left' ? '2px solid var(--acc)' : 'none', borderRight: h === 'right' ? '2px solid var(--acc)' : 'none' } as CSSProperties} />
                ))}
                <span style={{ position: 'absolute', top: '50%', left: '50%', width: 6, height: 6, transform: 'translate(-50%,-50%) rotate(45deg)', background: 'var(--acc)' }} />
              </div>
            </Item>
            <Item name="cadre-simple" full cellStyle={{}} caption="cadre 1 — filet ligne simple">
              <div style={{ width: '100%', height: 120, border: '1px solid var(--acc)' }} />
            </Item>
          </div>
        </div>

        {/* 04 MOTIFS DE FOND */}
        <SecTitle n="04">MOTIFS DE FOND</SecTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
          <Item name="fond-clair" full cellStyle={{}} caption="treillis facettes — fond clair">
            <div style={{ width: '100%', height: 110, borderRadius: 12, background: `repeating-linear-gradient(45deg, rgba(124,92,255,.06) 0 1px, transparent 1px 22px), repeating-linear-gradient(-45deg, rgba(124,92,255,.06) 0 1px, transparent 1px 22px), #fbfaff`, border: '1px solid #e6e2ef' }} />
          </Item>
          <Item name="fond-sombre" full opaque={CARD_DARK} cellStyle={{}} caption="treillis facettes — fond sombre">
            <div style={{ width: '100%', height: 110, borderRadius: 12, background: `repeating-linear-gradient(45deg, rgba(255,255,255,.03) 0 1px, transparent 1px 24px), ${CARD_DARK}` }} />
          </Item>
          <Item name="fond-points" full opaque={CARD_DARK} cellStyle={{}} caption="trame de points — discrète">
            <div style={{ width: '100%', height: 110, borderRadius: 12, background: `radial-gradient(rgba(124,92,255,.5) 1.4px, transparent 1.6px) 0 0 / 30px 30px, ${CARD_DARK}` }} />
          </Item>
        </div>

        {/* 05 BOUTONS, CARTOUCHES & TYPO */}
        <SecTitle n="05">BOUTONS, CARTOUCHES & TYPO</SecTitle>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
          <Item name="bouton-plein" opaque="#7c5cff" cellStyle={{}}><div style={{ padding: '13px 24px', borderRadius: 12, background: 'var(--acc)', color: '#fff', fontWeight: 700, fontSize: 16 }}><Edit init="Postulez sur le forum" /></div></Item>
          <Item name="bouton-contour" cellStyle={{}}><div style={{ padding: '13px 24px', borderRadius: 12, border: '2px solid var(--acc)', color: 'var(--acc)', fontWeight: 700, fontSize: 16 }}><Edit init="Rejoindre Emeria" /></div></Item>
          <Item name="bouton-sombre" opaque={CARD_DARK} cellStyle={{}}><div style={{ padding: '13px 24px', borderRadius: 12, background: CARD_DARK, color: '#fff', fontWeight: 700, fontSize: 16, display: 'inline-flex', gap: 8 }}><span style={{ color: 'var(--acc)' }}>+</span><Edit init="Voir le règlement" /></div></Item>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
          <Item name="cartouche" full cellStyle={{}} caption="cartouche d'information">
            <div style={{ ...lightCard, width: '100%', padding: 18 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ width: 4, borderRadius: 3, background: 'var(--acc)' }} />
                <div>
                  <Edit init="OUVERTURE" style={{ display: 'block', fontSize: 11, fontWeight: 800, letterSpacing: 2, color: 'var(--acc)' }} />
                  <Edit init="Samedi 20h00 — serveur Emeria" style={{ display: 'block', fontSize: 16, fontWeight: 600, marginTop: 4 }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <span style={{ padding: '5px 12px', borderRadius: 999, background: 'color-mix(in srgb, var(--acc) 14%, #fff)', color: 'var(--acc)', fontSize: 12, fontWeight: 700 }}><Edit init="#emeria" /></span>
                <span style={{ padding: '5px 12px', borderRadius: 999, background: 'color-mix(in srgb, var(--acc) 14%, #fff)', color: 'var(--acc)', fontSize: 12, fontWeight: 700 }}><Edit init="play.emeria.fr" /></span>
              </div>
            </div>
          </Item>
          <Item name="typo" full opaque={CARD_DARK} cellStyle={{}} caption="hiérarchie typographique">
            <div style={{ ...card, width: '100%', background: CARD_DARK, padding: 20 }}>
              <Edit init="Titre" style={{ display: 'block', fontSize: 34, fontWeight: 800, color: '#fff', lineHeight: 1 }} />
              <Edit init="SOUS-TITRE CAPS" style={{ display: 'block', fontSize: 15, fontWeight: 700, letterSpacing: 3, color: 'var(--acc)', marginTop: 10 }} />
              <Edit init="Accroche en serif italique" style={{ display: 'block', fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: 16, color: '#d9d3e6', marginTop: 8 }} />
              <Edit init="Texte courant Sora 300 — 24px minimum sur affiche 1920×1080." style={{ display: 'block', fontWeight: 300, fontSize: 13, color: '#b9b2c9', marginTop: 8 }} />
            </div>
          </Item>
        </div>

        {/* 06 AFFICHES */}
        <SecTitle n="06">MODÈLES D'AFFICHES 1920×1080</SecTitle>
        <div style={{ display: 'grid', gap: 16 }}>
          {/* staff */}
          <Item name="affiche-staff" opaque={DARK} pr={2.5} cellStyle={{}}>
            <div style={{ width: 768, height: 432, position: 'relative', overflow: 'hidden', background: `repeating-linear-gradient(45deg, rgba(255,255,255,.02) 0 1px, transparent 1px 26px), ${DARK}`, color: '#fff' }}>
              <div style={{ position: 'absolute', inset: 18, border: '1px solid color-mix(in srgb, var(--acc) 40%, transparent)' }} />
              {[{ top: 12, left: 12 }, { top: 12, right: 12 }, { bottom: 12, left: 12 }, { bottom: 12, right: 12 }].map((p, i) => <span key={i} style={{ position: 'absolute', width: 9, height: 9, transform: 'rotate(45deg)', background: 'var(--acc)', ...p }} />)}
              <div style={{ position: 'absolute', left: 34, top: '50%', transform: 'translateY(-50%)', width: 420, height: 420, display: 'grid', placeItems: 'center' }}>
                {showSkin && bustData
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={bustData} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', filter: 'drop-shadow(0 18px 30px rgba(0,0,0,.7))' }} />
                  : <span style={{ fontSize: 9, color: MUT }}>{showSkin && pseudo.trim() ? 'chargement du buste…' : 'render du buste (PNG transparent)'}</span>}
              </div>
              <div style={{ position: 'absolute', right: 48, top: '50%', transform: 'translateY(-50%)', textAlign: 'right', maxWidth: 380 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#ffffff10', border: '1px solid color-mix(in srgb, var(--acc) 50%, transparent)', borderRadius: 8, padding: '5px 10px', marginBottom: 14 }}><Mark s={18} /><Edit init="Emeria" style={{ fontSize: 13, fontWeight: 700 }} /></div>
                <Edit init="Xtazzking" block style={{ fontSize: 58, fontWeight: 800, lineHeight: 1, letterSpacing: -1 }} />
                <Edit init="Responsable Administrateur" block style={{ fontSize: 18, fontWeight: 700, letterSpacing: 5, textTransform: 'uppercase', color: 'var(--acc)', marginTop: 12 }} />
              </div>
            </div>
          </Item>
          {/* recrutement */}
          <Item name="affiche-recrutement" opaque="#f7f5fc" pr={2.5} cellStyle={{}}>
            <div style={{ width: 768, height: 432, position: 'relative', overflow: 'hidden', background: `repeating-linear-gradient(45deg, rgba(124,92,255,.05) 0 1px, transparent 1px 26px), #f7f5fc`, color: INK }}>
              <div style={{ position: 'absolute', inset: 20, border: '2px solid var(--acc)' }} />
              <div style={{ position: 'absolute', inset: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 36 }}>
                <div style={{ marginBottom: 16 }}><Lockup s={26} /></div>
                <Edit init="Nous recrutons des builders" block style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1 }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0' }}><div style={{ width: 40, height: 1, background: 'var(--acc)' }} /><span style={{ width: 6, height: 6, transform: 'rotate(45deg)', background: 'var(--acc)' }} /><div style={{ width: 40, height: 1, background: 'var(--acc)' }} /></div>
                <Edit init="Les profils recherchés :" style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }} />
                <div style={{ display: 'flex', gap: 10 }}>
                  {['Autonome', 'Mature', 'Passionné'].map((p) => <span key={p} style={{ display: 'inline-flex', gap: 5, padding: '7px 15px', borderRadius: 999, background: 'color-mix(in srgb, var(--acc) 14%, transparent)', color: '#3a2f52', fontSize: 14, fontWeight: 700 }}><span style={{ color: 'var(--acc)' }}>+</span><Edit init={p} /></span>)}
                </div>
                <Edit init="Des visions de grandeur ? Donnez-leur forme sur Emeria." style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: 15, color: '#6b6478', margin: '16px 0' }} />
                <span style={{ background: 'var(--acc)', color: '#fff', padding: '11px 26px', borderRadius: 12, fontSize: 16, fontWeight: 800 }}><Edit init="Postulez sur le forum" /></span>
              </div>
            </div>
          </Item>
        </div>
      </div>
    </div>
  );
}
