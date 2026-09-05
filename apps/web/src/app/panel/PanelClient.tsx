'use client';

import { useRef, useState, useEffect } from 'react';
import { getGrade, isFounderTier, gradeLogoKey } from '@xo/shared';

/** Charge une image, la recadre en carré `size`px, renvoie un data URL JPEG */
async function resizeImage(file: File, size: number): Promise<string> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = URL.createObjectURL(file);
  });
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const scale = Math.max(size / img.width, size / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  return canvas.toDataURL('image/jpeg', 0.82);
}
import SiteSection from './SiteSection';
import LauncherSection from './LauncherSection';
import SupportStaffSection from './SupportStaffSection';
import VisitsSection from './VisitsSection';
import AutoMessagesSection from './AutoMessagesSection';
import StaffSection from './StaffSection';
import ServeursSection from './ServeursSection';
import LiensSection from './LiensSection';
import PlaytimeSection from './PlaytimeSection';
import SanctionsSection from './SanctionsSection';
import AffichesSection from './AffichesSection';
import FormationSection from './FormationSection';
import AccessSection from './AccessSection';
import { PANEL_SECTIONS } from '@/lib/panelSections';
import { GradeBadge } from './GradeBadge';

/** Logo du grade (bouclier). Se cache si l'image n'existe pas encore. */
function GradeLogo({ grade }: { grade: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="grade-logo"
      src={`/logos/${gradeLogoKey(grade)}.png`}
      alt=""
      onError={() => setOk(false)}
    />
  );
}

interface Props {
  account: {
    username: string;
    site_grade: string;
    site_grades: string[];
    is_founder_chief: boolean;
    minecraft_pseudo: string | null;
    avatar_url: string | null;
  };
}

interface Section {
  id: string;
  label: string;
  icon: string;
  soon?: boolean;
}

export default function PanelClient({ account }: Props) {
  const grade = getGrade(account.site_grade);
  const founder = isFounderTier(account.site_grade);
  const level = grade.level;

  // Config d'accès par catégorie (définie par les Fondateurs dans la section « Accès »).
  const [access, setAccess] = useState<Record<string, string[]>>({});
  useEffect(() => {
    fetch('/api/panel-access')
      .then((r) => (r.ok ? r.json() : { access: {} }))
      .then((d) => setAccess(d.access || {}))
      .catch(() => {});
  }, []);

  // Sections visibles = registre filtré par la config d'accès.
  // Si des grades précis sont cochés pour une section : seuls ces grades y accèdent.
  // Sinon : accès par défaut (niveau du grade). Les fondateurs voient tout.
  const mine = [account.site_grade, ...(account.site_grades || [])];
  const sections: Section[] = PANEL_SECTIONS.filter((s) => {
    if (s.founderOnly) return founder; // ex : la config d'accès elle-même
    const allowed = access[s.id];
    if (Array.isArray(allowed) && allowed.length > 0) {
      if (founder || mine.some((g) => allowed.includes(g))) return true;
      return Boolean(s.extraGrade && account.site_grades.includes(s.extraGrade));
    }
    if (level >= s.defaultLevel) return true;
    return Boolean(s.extraGrade && account.site_grades.includes(s.extraGrade));
  }).map((s) => ({ id: s.id, label: s.label, icon: s.icon, soon: s.soon }));

  const [active, setActive] = useState('profil');
  const current = sections.find((s) => s.id === active) ?? sections[0];

  // Thème clair / sombre (choix manuel mémorisé ; sinon suit l'OS).
  const [isDark, setIsDark] = useState(true);
  useEffect(() => {
    try {
      const saved = localStorage.getItem('xo_theme');
      if (saved === 'light' || saved === 'dark') {
        document.documentElement.setAttribute('data-theme', saved);
        setIsDark(saved === 'dark');
      } else {
        setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
      }
    } catch { /* ignore */ }
  }, []);
  function toggleTheme() {
    const next = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('xo_theme', next); } catch { /* ignore */ }
    setIsDark(next === 'dark');
  }

  return (
    <div className="panel">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark" aria-hidden="true">XO</span>
          <span>X.O</span>
          <button className="theme-toggle" type="button" onClick={toggleTheme} title="Thème clair / sombre" aria-label="Changer de thème">
            {isDark ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
            )}
          </button>
        </div>
        <nav className="sidebar-nav">
          {sections.map((s) => (
            <button
              key={s.id}
              className={`nav-item ${active === s.id ? 'active' : ''}`}
              onClick={() => setActive(s.id)}
            >
              {s.icon && <span className="nav-icon">{s.icon}</span>}
              <span>{s.label}</span>
            </button>
          ))}
        </nav>
        <button
          className="logout"
          onClick={async () => {
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/';
          }}
        >
          Déconnexion
        </button>
      </aside>

      {/* Contenu */}
      <main className="panel-main">
        {current.id === 'profil' ? (
          <ProfileCard account={account} />
        ) : current.id === 'liens' ? (
          <LiensSection myGrade={account.site_grade} />
        ) : current.id === 'site' ? (
          <SiteSection myGrade={account.site_grade} isChief={account.is_founder_chief} />
        ) : current.id === 'launcher' ? (
          <LauncherSection />
        ) : current.id === 'support' ? (
          <SupportStaffSection />
        ) : current.id === 'trafic' ? (
          <VisitsSection />
        ) : current.id === 'automsg' ? (
          <AutoMessagesSection />
        ) : current.id === 'acces' ? (
          <AccessSection initial={access} />
        ) : current.id === 'staff' ? (
          <StaffSection myGrade={account.site_grade} />
        ) : current.id === 'serveurs' ? (
          <ServeursSection />
        ) : current.id === 'playtime' ? (
          <PlaytimeSection />
        ) : current.id === 'sanctions' ? (
          <SanctionsSection />
        ) : current.id === 'affiches' ? (
          <AffichesSection />
        ) : current.id === 'formation' ? (
          <FormationSection />
        ) : (
          <div className="soon-card">
            <div className="soon-emoji">{current.icon}</div>
            <h2>{current.label}</h2>
            <p>Cette section arrive bientôt.</p>
          </div>
        )}
      </main>
    </div>
  );
}

function ProfileCard({ account }: Props) {
  const initial = account.username.charAt(0).toUpperCase();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await resizeImage(file, 256);
      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl }),
      });
      if (res.ok) window.location.reload();
      else alert((await res.json().catch(() => ({}))).error ?? 'Échec de l’envoi.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="profile-card">
      <button
        type="button"
        className="profile-avatar avatar-edit"
        onClick={() => fileRef.current?.click()}
        title="Changer la photo"
      >
        {account.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={account.avatar_url} alt={account.username} />
        ) : (
          <span>{uploading ? '…' : initial}</span>
        )}
      </button>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
      <div className="profile-info">
        <div className="profile-name">
          {account.username}
          {['fondateur', 'cofondateur', 'responsable', 'dev'].includes(account.site_grade) && (
            <GradeLogo grade={account.site_grade} />
          )}
        </div>
        {account.minecraft_pseudo && (
          <div className="profile-mc">⛏️ {account.minecraft_pseudo}</div>
        )}
        <div className="profile-grade">
          {(account.site_grades.length ? account.site_grades : ['joueur']).map((gk) => {
            const gg = getGrade(gk);
            const label = gk === 'joueur' ? 'Joueur' : gg.label;
            return (
              <span className="grade-tag" key={gk}>
                <GradeBadge gk={gk} />
                {label}
              </span>
            );
          })}
          {account.is_founder_chief && (
            <span className="chief-dot" title="Fondateur principal" />
          )}
        </div>
      </div>
    </div>
  );
}
