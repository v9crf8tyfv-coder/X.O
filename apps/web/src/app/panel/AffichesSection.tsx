'use client';

import { useRef, useState, type ReactNode, type CSSProperties } from 'react';

/**
 * Générateur d'affiches (admins et +). Produit une IMAGE pleine (format Discord)
 * entièrement personnalisable : dégradé/couleurs, écriture Minecraft (§), encadré,
 * surbrillance. Export PNG haute résolution — l'image EST le visuel (pas de marge).
 */

const MC_COLORS: Record<string, string> = {
  '0': '#000000', '1': '#0000AA', '2': '#00AA00', '3': '#00AAAA',
  '4': '#AA0000', '5': '#AA00AA', '6': '#FFAA00', '7': '#AAAAAA',
  '8': '#555555', '9': '#5555FF', a: '#55FF55', b: '#55FFFF',
  c: '#FF5555', d: '#FF55FF', e: '#FFFF55', f: '#FFFFFF',
};

/** Rend un texte avec markdown Discord (**, __, *, ~~) ET codes couleur Minecraft (§/&). */
function renderMc(text: string, baseColor: string): ReactNode {
  const out: ReactNode[] = [];
  let color = baseColor, bold = false, italic = false, underline = false, strike = false;
  let buf = '';
  let key = 0;
  const styleNow = (): CSSProperties => ({
    color,
    fontWeight: bold ? 800 : undefined,
    fontStyle: italic ? 'italic' : undefined,
    textDecoration: [underline ? 'underline' : '', strike ? 'line-through' : ''].filter(Boolean).join(' ') || undefined,
  });
  const flush = () => { if (buf) { out.push(<span key={key++} style={styleNow()}>{buf}</span>); buf = ''; } };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], nx = text[i + 1];
    if ((ch === '§' || ch === '&') && nx) {
      const code = nx.toLowerCase();
      if (MC_COLORS[code]) { flush(); color = MC_COLORS[code]; i++; continue; }
      if (code === 'l') { flush(); bold = true; i++; continue; }
      if (code === 'o') { flush(); italic = true; i++; continue; }
      if (code === 'n') { flush(); underline = true; i++; continue; }
      if (code === 'm') { flush(); strike = true; i++; continue; }
      if (code === 'r') { flush(); color = baseColor; bold = italic = underline = strike = false; i++; continue; }
    }
    if (ch === '*' && nx === '*') { flush(); bold = !bold; i++; continue; }
    if (ch === '_' && nx === '_') { flush(); underline = !underline; i++; continue; }
    if (ch === '~' && nx === '~') { flush(); strike = !strike; i++; continue; }
    if (ch === '*') { flush(); italic = !italic; continue; }
    if (ch === '\n') { flush(); out.push(<br key={key++} />); continue; }
    buf += ch;
  }
  flush();
  return out;
}

type Fmt = 'banner' | 'landscape' | 'square' | 'portrait';
const SIZES: Record<Fmt, { w: number; h: number; label: string }> = {
  banner: { w: 1200, h: 360, label: 'Bannière' },
  landscape: { w: 1200, h: 675, label: 'Paysage 16:9' },
  square: { w: 1080, h: 1080, label: 'Carré' },
  portrait: { w: 900, h: 1200, label: 'Portrait' },
};
type Mode = 'affiche' | 'banniere';

export default function AffichesSection() {
  const [fmt, setFmt] = useState<Fmt>('landscape');
  const [mode, setMode] = useState<Mode>('affiche');
  const [gradient, setGradient] = useState(true);
  const [c1, setC1] = useState('#7c5cff');
  const [c2, setC2] = useState('#241146');
  const [accent, setAccent] = useState('#ffffff');
  const [textColor, setTextColor] = useState('#ffffff');
  const [title, setTitle] = useState('EmeriaMC');
  const [subtitle, setSubtitle] = useState('ANNONCE');
  const [body, setBody] = useState('Écris ton texte ici.\n§eTu peux utiliser les couleurs Minecraft §aavec §cles codes §.');
  const [box, setBox] = useState(false);
  const [mc, setMc] = useState(false);
  const [highlight, setHighlight] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const size = SIZES[fmt];
  const font = mc ? "'Courier New', monospace" : "'Helvetica Neue', Arial, sans-serif";
  const bg = gradient ? `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)` : c1;
  const bannerMode = mode === 'banniere';
  const scale = Math.min(1, 560 / size.w); // aperçu réduit pour tenir dans le panel

  async function download() {
    if (!ref.current) return;
    setBusy(true);
    try {
      const { toPng } = await import('html-to-image');
      const url = await toPng(ref.current, {
        pixelRatio: 2, cacheBust: true, width: size.w, height: size.h,
        style: { margin: '0', transform: 'none', left: '0', top: '0' },
      });
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

  const lbl: CSSProperties = { display: 'block', fontSize: 12, color: 'var(--muted,#8a8a94)', margin: '12px 0 4px', fontWeight: 700 };
  const inp: CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, color: '#e8e8ec', padding: '8px 10px', font: 'inherit' };
  const chip = (on: boolean): CSSProperties => ({ ...inp, width: 'auto', cursor: 'pointer', borderColor: on ? '#7c5cff' : 'rgba(255,255,255,.12)', color: on ? '#fff' : '#aaa' });
  const row: CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' };

  const titleNode = renderMc(title, highlight ? '#0e0e12' : textColor);
  const bodyNode = renderMc(body, textColor);

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Affiches</h2>
      <p style={{ color: 'var(--muted,#8a8a94)', marginTop: 0 }}>
        Crée un visuel (format Discord) et télécharge-le en PNG. L&apos;image est pleine, sans marge.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px,320px) 1fr', gap: 22, alignItems: 'start' }}>
        {/* Contrôles */}
        <div style={{ border: '1px solid rgba(255,255,255,.1)', borderRadius: 14, padding: 16, background: 'rgba(255,255,255,.02)' }}>
          <label style={lbl}>Type</label>
          <div style={row}>
            <button onClick={() => setMode('affiche')} style={chip(mode === 'affiche')}>Affiche (titre + texte)</button>
            <button onClick={() => setMode('banniere')} style={chip(bannerMode)}>Bannière (titre seul)</button>
          </div>

          <label style={lbl}>Format</label>
          <div style={row}>
            {(Object.keys(SIZES) as Fmt[]).map((f) => (
              <button key={f} onClick={() => setFmt(f)} style={chip(fmt === f)}>{SIZES[f].label}</button>
            ))}
          </div>

          <label style={lbl}>Fond</label>
          <div style={row}>
            <button onClick={() => setGradient(true)} style={chip(gradient)}>Dégradé</button>
            <button onClick={() => setGradient(false)} style={chip(!gradient)}>Uni</button>
          </div>
          <div style={{ ...row, marginTop: 8 }}>
            <span style={{ fontSize: 12, color: '#aaa' }}>Couleur 1</span>
            <input type="color" value={c1} onChange={(e) => setC1(e.target.value)} />
            {gradient && (<><span style={{ fontSize: 12, color: '#aaa' }}>Couleur 2</span><input type="color" value={c2} onChange={(e) => setC2(e.target.value)} /></>)}
          </div>
          <div style={{ ...row, marginTop: 8 }}>
            <span style={{ fontSize: 12, color: '#aaa' }}>Texte</span>
            <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} />
            <span style={{ fontSize: 12, color: '#aaa' }}>Accent</span>
            <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} />
          </div>

          <label style={lbl}>Titre</label>
          <input style={inp} value={title} onChange={(e) => setTitle(e.target.value)} />
          <label style={lbl}>Sous-titre</label>
          <input style={inp} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />

          {!bannerMode && (
            <>
              <label style={lbl}>Texte (§ = couleurs Minecraft)</label>
              <textarea style={{ ...inp, minHeight: 110, resize: 'vertical' }} value={body} onChange={(e) => setBody(e.target.value)} />
              <label style={lbl}><input type="checkbox" checked={box} onChange={(e) => setBox(e.target.checked)} /> Encadré autour du texte</label>
            </>
          )}
          <label style={lbl}><input type="checkbox" checked={mc} onChange={(e) => setMc(e.target.checked)} /> Écriture Minecraft (§ / &amp;)</label>
          <label style={lbl}><input type="checkbox" checked={highlight} onChange={(e) => setHighlight(e.target.checked)} /> Surbrillance du titre</label>

          <button onClick={download} disabled={busy} style={{ marginTop: 16, width: '100%', background: '#7c5cff', color: '#fff', border: 0, borderRadius: 10, padding: '12px', fontWeight: 700, cursor: 'pointer', opacity: busy ? .6 : 1 }}>
            {busy ? 'Génération…' : 'Télécharger en PNG'}
          </button>
        </div>

        {/* Aperçu (réduit visuellement, mais exporté en taille réelle) */}
        <div>
          <div style={{ color: 'var(--muted,#8a8a94)', fontSize: 12, marginBottom: 8 }}>Aperçu — export {size.w}×{size.h}</div>
          <div style={{ width: size.w * scale, height: size.h * scale, overflow: 'hidden', borderRadius: 10 }}>
            <div
              ref={ref}
              style={{
                width: size.w, height: size.h, background: bg, color: textColor, fontFamily: font,
                boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
                alignItems: bannerMode ? 'center' : 'stretch', justifyContent: 'center',
                textAlign: bannerMode ? 'center' : 'left', padding: bannerMode ? '4%' : '6%',
                transform: `scale(${scale})`, transformOrigin: 'top left',
              }}
            >
              {/* Titre */}
              <div style={{
                fontSize: bannerMode ? Math.round(size.w * 0.07) : Math.round(size.w * 0.045),
                fontWeight: 800, fontFamily: font, lineHeight: 1.1,
                color: highlight ? '#0e0e12' : textColor,
                background: highlight ? accent : 'transparent',
                display: 'inline-block', padding: highlight ? '6px 18px' : 0, borderRadius: highlight ? 10 : 0,
                marginBottom: subtitle || !bannerMode ? 10 : 0,
              }}>{titleNode}</div>

              {subtitle && (
                <div style={{ fontSize: bannerMode ? Math.round(size.w * 0.028) : Math.round(size.w * 0.026), letterSpacing: 1.5, color: accent, fontWeight: 700, marginBottom: bannerMode ? 0 : 20 }}>
                  {renderMc(subtitle, accent)}
                </div>
              )}

              {!bannerMode && (
                <div style={box ? { border: `2px solid ${accent}`, borderRadius: 16, padding: '4%', background: 'rgba(0,0,0,.25)', marginTop: 6 } : { marginTop: 6 }}>
                  <div style={{ fontSize: Math.round(size.w * 0.024), lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: font }}>
                    {bodyNode}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
