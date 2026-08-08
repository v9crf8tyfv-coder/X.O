'use client';

import { useState } from 'react';
import { getGrade, isFounderTier } from '@xo/shared';

interface Props {
  account: {
    username: string;
    site_grade: string;
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

  // Sections visibles selon le grade
  const sections: Section[] = [{ id: 'profil', label: 'Profil', icon: '👤' }];
  if (level >= getGrade('admin').level) {
    sections.push({ id: 'staff', label: 'Gestion Staff', icon: '🧑‍💼', soon: true });
  }
  if (founder) {
    sections.push({ id: 'serveurs', label: 'Gestion Serveurs', icon: '🖥️', soon: true });
    sections.push({ id: 'reseaux', label: 'Gestion Réseaux', icon: '🌐', soon: true });
  }
  if (level >= getGrade('admin').level) {
    sections.push({ id: 'sanctions', label: 'Gestion Sanction(s)', icon: '⚖️', soon: true });
  }
  if (founder) {
    sections.push({ id: 'site', label: 'Gestion Site', icon: '🔐', soon: true });
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
              <span className="nav-icon">{s.icon}</span>
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
  const grade = getGrade(account.site_grade);
  const initial = account.username.charAt(0).toUpperCase();

  return (
    <div className="profile-card">
      <div className="profile-avatar">
        {account.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={account.avatar_url} alt={account.username} />
        ) : (
          <span>{initial}</span>
        )}
      </div>
      <div className="profile-info">
        <div className="profile-name">
          {account.username}
          {account.is_founder_chief && <span title="Fondateur chef">👑</span>}
        </div>
        {account.minecraft_pseudo && (
          <div className="profile-mc">⛏️ {account.minecraft_pseudo}</div>
        )}
        <div className="profile-grade">
          <span
            className="grade-bubble"
            style={{ backgroundColor: `#${grade.color}`, color: `#${grade.color}` }}
          />
          <span>{grade.label}</span>
        </div>
      </div>
    </div>
  );
}
