'use client';

import { useRef, useState, type ReactNode, type CSSProperties } from 'react';

/**
 * Générateur d'affiches (admins et +). Crée une image (format Discord large,
 * carré ou portrait) entièrement personnalisable — DA Emeria, couleurs, fond,
 * surbrillance, et écriture Minecraft (codes couleur §). Export en PNG.
 */

const MC_COLORS: Record<string, string> = {
  '0': '#000000', '1': '#0000AA', '2': '#00AA00', '3': '#00AAAA',
  '4': '#AA0000', '5': '#AA00AA', '6': '#FFAA00', '7': '#AAAAAA',
  '8': '#555555', '9': '#5555FF', a: '#55FF55', b: '#55FFFF',
  c: '#FF5555', d: '#FF55FF', e: '#FFFF55', f: '#FFFFFF',
};

/** Rend un texte avec les codes couleur/format Minecraft (§). */
function renderMc(text: string, baseColor: string): ReactNode {
  const out: ReactNode[] = [];
  let cur: CSSProperties = { color: baseColor };
  let buf = '';
  let key = 0;
  const flush = () => { if (buf) { out.push(<span key={key++} style={{ ...cur }}>{buf}</span>); buf = ''; } };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if ((ch === '§' || ch === '&') && i + 1 < text.length) {
      const code = text[i + 1].toLowerCase();
      if (MC_COLORS[code]) { flush(); cur = { ...cur, color: MC_COLORS[code] }; i++; continue; }
      if (code === 'l') { flush(); cur = { ...cur, fontWeight: 800 }; i++; continue; }
      if (code === 'o') { flush(); cur = { ...cur, fontStyle: 'italic' }; i++; continue; }
      if (code === 'n') { flush(); cur = { ...cur, textDecoration: 'underline' }; i++; continue; }
      if (code === 'm') { flush(); cur = { ...cur, textDecoration: 'line-through' }; i++; continue; }
      if (code === 'r') { flush(); cur = { color: baseColor }; i++; continue; }
    }
    if (ch === '\n') { flush(); out.push(<br key={key++} />); continue; }
    buf += ch;
  }
  flush();
  return out;
}

type Fmt = 'banner' | 'square' | 'portrait';
const SIZES: Record<Fmt, { w: number; h: number; label: string }> = {
  banner: { w: 1000, h: 360, label: 'Bannière (Discord)' },
  square: { w: 720, h: 720, label: 'Carré' },
  portrait: { w: 700, h: 940, label: 'Portrait' },
};
type Bg = 'emeria' | 'dark' | 'solid' | 'gradient';

export default function AffichesSection() {
  const [fmt, setFmt] = useState<Fmt>('banner');
  const [bg, setBg] = useState<Bg>('emeria');
  const [c1, setC1] = useState('#7c5cff');
  const [c2, setC2] = useState('#241146');
  const [accent, setAccent] = useState('#7c5cff');
  const [textColor, setTextColor] = useState('#ffffff');
  const [banner, setBanner] = useState(true);
  const [bannerTitle, setBannerTitle] = useState('EmeriaMC');
  const [bannerSub, setBannerSub] = useState('ANNONCE');
  const [box, setBox] = useState(true);
  const [title, setTitle] = useState('Titre de l’affiche');
  const [body, setBody] = useState('Écris ton texte ici.\nTu peux utiliser les couleurs Minecraft : §avert §crouge §ejaune §lgras§r.');
  const [mc, setMc] = useState(false);
  const [highlight, setHighlight] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const size = SIZES[fmt];
  const font = mc ? "'Courier New', monospace" : "'Helvetica Neue', Arial, sans-serif";

  const bgStyle: CSSProperties =
    bg === 'emeria' ? { background: 'linear-gradient(135deg,#7c5cff 0%,#241146 60%,#0e0e12 100%)' }
    : bg === 'dark' ? { background: '#0e0e12' }
    : bg === 'solid' ? { background: c1 }
    : { background: `linear-gradient(135deg,${c1},${c2})` };

  async function download() {
    if (!ref.current) return;
    setBusy(true);
    try {
      const { toPng } = await import('html-to-image');
      const url = await toPng(ref.current, { pixelRatio: 2, cacheBust: true, width: size.w, height: size.h });
      const a = document.createElement('a');
      a.href = url;
      a.download = `affiche-emeria-${Date.now()}.png`;
      a.click();
    } catch (e) {
      alert('Export impossible : ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const lbl: CSSProperties = { display: 'block', fontSize: 12, color: 'var(--muted,#8a8a94)', margin: '10px 0 4px', fontWeight: 700 };
  const inp: CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, color: '#e8e8ec', padding: '8px 10px', font: 'inherit' };
  const row: CSSProperties = { display: 'flex', gap: 8, alignItems: 'center' };

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Affiches</h2>
      <p style={{ color: 'var(--muted,#8a8a94)', marginTop: 0 }}>
        Crée une image personnalisée (DA Emeria) et télécharge-la en PNG pour la mettre où tu veux.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px,320px) 1fr', gap: 22, alignItems: 'start' }}>
        {/* Contrôles */}
        <div style={{ border: '1px solid rgba(255,255,255,.1)', borderRadius: 14, padding: 16, background: 'rgba(255,255,255,.02)' }}>
          <label style={lbl}>Format</label>
          <div style={{ ...row, flexWrap: 'wrap' }}>
            {(Object.keys(SIZES) as Fmt[]).map((f) => (
              <button key={f} onClick={() => setFmt(f)} style={{ ...inp, width: 'auto', cursor: 'pointer', borderColor: fmt === f ? accent : 'rgba(255,255,255,.12)', color: fmt === f ? '#fff' : '#aaa' }}>{SIZES[f].label}</button>
            ))}
          </div>

          <label style={lbl}>Fond</label>
          <div style={{ ...row, flexWrap: 'wrap' }}>
            {([['emeria', 'Emeria'], ['dark', 'Sombre'], ['solid', 'Uni'], ['gradient', 'Dégradé']] as [Bg, string][]).map(([b, t]) => (
              <button key={b} onClick={() => setBg(b)} style={{ ...inp, width: 'auto', cursor: 'pointer', borderColor: bg === b ? accent : 'rgba(255,255,255,.12)', color: bg === b ? '#fff' : '#aaa' }}>{t}</button>
            ))}
          </div>
          {(bg === 'solid' || bg === 'gradient') && (
            <div style={{ ...row, marginTop: 8 }}>
              <input type="color" value={c1} onChange={(e) => setC1(e.target.value)} title="Couleur 1" />
              {bg === 'gradient' && <input type="color" value={c2} onChange={(e) => setC2(e.target.value)} title="Couleur 2" />}
            </div>
          )}

          <label style={lbl}>Couleurs</label>
          <div style={row}>
            <span style={{ fontSize: 12, color: '#aaa' }}>Accent</span>
            <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} />
            <span style={{ fontSize: 12, color: '#aaa' }}>Texte</span>
            <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} />
          </div>

          <label style={{ ...lbl, marginTop: 14 }}><input type="checkbox" checked={banner} onChange={(e) => setBanner(e.target.checked)} /> Bandeau en haut</label>
          {banner && (
            <>
              <input style={inp} value={bannerTitle} onChange={(e) => setBannerTitle(e.target.value)} placeholder="Titre du bandeau" />
              <input style={{ ...inp, marginTop: 6 }} value={bannerSub} onChange={(e) => setBannerSub(e.target.value)} placeholder="Sous-titre du bandeau" />
            </>
          )}

          <label style={{ ...lbl, marginTop: 10 }}><input type="checkbox" checked={box} onChange={(e) => setBox(e.target.checked)} /> Encadré (comme les modèles)</label>
          <label style={lbl}><input type="checkbox" checked={mc} onChange={(e) => setMc(e.target.checked)} /> Écriture Minecraft (codes § / &amp;)</label>
          <label style={lbl}><input type="checkbox" checked={highlight} onChange={(e) => setHighlight(e.target.checked)} /> Surbrillance du titre</label>

          <label style={lbl}>Titre</label>
          <input style={inp} value={title} onChange={(e) => setTitle(e.target.value)} />

          <label style={lbl}>Texte (§ pour les couleurs Minecraft)</label>
          <textarea style={{ ...inp, minHeight: 120, resize: 'vertical' }} value={body} onChange={(e) => setBody(e.target.value)} />

          <button onClick={download} disabled={busy} style={{ marginTop: 14, width: '100%', background: accent, color: '#fff', border: 0, borderRadius: 10, padding: '12px', fontWeight: 700, cursor: 'pointer', opacity: busy ? .6 : 1 }}>
            {busy ? 'Génération…' : 'Télécharger en PNG'}
          </button>
        </div>

        {/* Aperçu */}
        <div style={{ overflow: 'auto', maxWidth: '100%' }}>
          <div style={{ color: 'var(--muted,#8a8a94)', fontSize: 12, marginBottom: 8 }}>Aperçu ({size.w}×{size.h})</div>
          <div
            ref={ref}
            style={{
              width: size.w, height: size.h, ...bgStyle, color: textColor, fontFamily: font,
              boxSizing: 'border-box', padding: fmt === 'banner' ? 30 : 40, display: 'flex', flexDirection: 'column',
              justifyContent: 'center', position: 'relative', overflow: 'hidden',
            }}
          >
            {banner && (
              <div style={{ background: 'linear-gradient(135deg,#7c5cff,#241146)', borderRadius: 12, padding: '16px 22px', textAlign: 'center', marginBottom: 18 }}>
                <div style={{ fontSize: fmt === 'banner' ? 30 : 34, fontWeight: 800, color: '#fff', fontFamily: font }}>{bannerTitle}</div>
                {bannerSub && <div style={{ fontSize: 13, color: '#e7ddff', letterSpacing: 1 }}>{bannerSub}</div>}
              </div>
            )}
            <div style={box ? { border: `2px solid ${accent}`, borderRadius: 14, padding: '22px 26px', background: 'rgba(0,0,0,.28)' } : {}}>
              {title && (
                <div style={{
                  fontSize: fmt === 'banner' ? 26 : 30, fontWeight: 800, marginBottom: 14, fontFamily: font,
                  color: highlight ? '#0e0e12' : textColor,
                  background: highlight ? accent : 'transparent',
                  display: 'inline-block', padding: highlight ? '4px 12px' : 0, borderRadius: highlight ? 8 : 0,
                }}>
                  {mc ? renderMc(title, highlight ? '#0e0e12' : textColor) : title}
                </div>
              )}
              <div style={{ fontSize: fmt === 'banner' ? 17 : 19, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: font }}>
                {mc ? renderMc(body, textColor) : body.split('\n').map((l, i) => <div key={i}>{l || ' '}</div>)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
