'use client';

import { useRef, useState } from 'react';
import { getGrade, isFounderTier } from '@xo/shared';

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
import { GradeBadge } from './GradeBadge';

/** Logo du grade (bouclier). Se cache si l'image n'existe pas encore. */
function GradeLogo({ grade }: { grade: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="grade-logo"
      src={`/logos/${grade}.png`}
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

  // Sections visibles selon le grade (émojis gardés seulement pour Staff & Site)
  const sections: Section[] = [{ id: 'profil', label: 'Profil', icon: '' }];
  // Liens utiles + Gestion Staff : à partir d'admin (en dessous = juste Profil)
  if (level >= getGrade('admin').level) {
    sections.push({ id: 'liens', label: 'Liens utiles', icon: '🔗' });
    sections.push({ id: 'staff', label: 'Gestion Staff', icon: '🧑‍💼', soon: true });
  }
  if (founder) {
    sections.push({ id: 'serveurs', label: 'Gestion Serveurs', icon: '🖥️' });
  }
  if (level >= getGrade('admin').level) {
    sections.push({ id: 'playtime', label: 'Temps de jeu', icon: '⏱️' });
  }
  if (level >= getGrade('responsable').level) {
    sections.push({ id: 'reseaux', label: 'Gestion Réseaux', icon: '', soon: true });
  }
  if (level >= getGrade('admin').level) {
    sections.push({ id: 'sanctions', label: 'Gestion Sanction(s)', icon: '' });
  }
  if (founder) {
    sections.push({ id: 'launcher', label: 'Launcher', icon: '🚀' });
    sections.push({ id: 'support', label: 'Support', icon: '🎫' });
    sections.push({ id: 'trafic', label: 'Trafic du site', icon: '📈' });
    sections.push({ id: 'automsg', label: 'Messages auto', icon: '💬' });
    sections.push({ id: 'site', label: 'Gestion Site', icon: '🔐' });
  }

  const [active, setActive] = useState('profil');
  const current = sections.find((s) => s.id === active) ?? sections[0];

  return (
    <div className="panel">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">X.O</div>
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
        ) : current.id === 'staff' ? (
          <StaffSection myGrade={account.site_grade} />
        ) : current.id === 'serveurs' ? (
          <ServeursSection />
        ) : current.id === 'playtime' ? (
          <PlaytimeSection />
        ) : current.id === 'sanctions' ? (
          <SanctionsSection />
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
