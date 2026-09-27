'use client';

import { useCallback, useEffect, useState } from 'react';
import { getGrade } from '@xo/shared';
import { GradeBadge } from './GradeBadge';
import PlaytimeSection from './PlaytimeSection';

/** Grade le plus élevé (par niveau) d'un staff — pour l'affichage. */
function topGradeKey(grades: string[]): string {
  if (!grades || grades.length === 0) return 'joueur';
  return grades.reduce((best, g) => (getGrade(g).level > getGrade(best).level ? g : best), grades[0]!);
}

type Tab = 'playtime' | 'dmdfinish';

/**
 * « Suivis Staff » : regroupe les petits suivis d'un staff.
 * Chaque staff RANK apparaît automatiquement (la liste vient de la table `staff`),
 * donc il n'y a rien à créer à la main — dès qu'un staff est rank, son suivi existe.
 *  - Temps de jeu (réutilise la vue existante)
 *  - Demandes finies : nombre de /dmdfinish par mois (table dmdfinish_log)
 */
export default function SuivisSection() {
  const [tab, setTab] = useState<Tab>('playtime');

  return (
    <div className="site-section">
      <h2>Suivis Staff</h2>
      <p className="site-sub">
        Suivis automatiques de chaque staff (dès qu&apos;un staff est rank, son suivi apparaît).
      </p>

      <div style={{ display: 'flex', gap: 8, margin: '4px 0 18px', flexWrap: 'wrap' }}>
        <TabButton active={tab === 'playtime'} onClick={() => setTab('playtime')}>
          Temps de jeu
        </TabButton>
        <TabButton active={tab === 'dmdfinish'} onClick={() => setTab('dmdfinish')}>
          Demandes finies (/dmdfinish)
        </TabButton>
      </div>

      {tab === 'playtime' ? <PlaytimeSection /> : <DmdFinishSub />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '9px 16px',
        borderRadius: 10,
        cursor: 'pointer',
        fontWeight: 700,
        fontSize: 14,
        border: active ? '1px solid #7c5cff' : '1px solid rgba(255,255,255,.16)',
        background: active ? '#7c5cff' : 'rgba(255,255,255,.06)',
        color: active ? '#fff' : 'var(--txt, #e7e7ea)',
        boxShadow: active ? '0 4px 14px rgba(124,92,255,.35)' : 'none',
      }}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Sous-onglet : nombre de /dmdfinish par mois et par staff           */
/* ------------------------------------------------------------------ */

interface DmdRow {
  id: string;
  pseudo: string;
  grades: string[];
  count: number;
}
interface DmdData {
  month: string; // YYYY-MM
  staff: DmdRow[];
}

/** "YYYY-MM" du mois courant. */
function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}
/** Décale un "YYYY-MM" de n mois. */
function addMonths(m: string, n: number): string {
  const [y, mm] = m.split('-').map(Number);
  const d = new Date(Date.UTC(y!, mm! - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}
/** "YYYY-MM" -> "septembre 2026". */
function monthLabel(m: string): string {
  const [y, mm] = m.split('-').map(Number);
  const d = new Date(Date.UTC(y!, mm! - 1, 1));
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function DmdFinishSub() {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<DmdData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback((m: string) => {
    setLoading(true);
    setError('');
    fetch(`/api/dmdfinish-stats?month=${m}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Accès refusé ou erreur.'))))
      .then((d: DmdData) => setData(d))
      .catch((e) => setError(e.message || 'Erreur de chargement.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(month);
  }, [month, load]);

  const isCurrent = month >= currentMonth();
  const total = data?.staff.reduce((a, s) => a + s.count, 0) ?? 0;

  return (
    <div>
      <div className="pt-weeknav">
        <button className="back-btn" onClick={() => setMonth(addMonths(month, -1))}>
          ‹ Mois précédent
        </button>
        <span className="pt-weeklabel" style={{ textTransform: 'capitalize' }}>
          {monthLabel(month)}
        </span>
        <button className="back-btn" onClick={() => setMonth(addMonths(month, 1))} disabled={isCurrent}>
          Mois suivant ›
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}
      {loading && !data && <p className="site-sub">Chargement…</p>}

      {data && (
        <>
          <p className="site-sub">
            {total} demande{total > 1 ? 's' : ''} finie{total > 1 ? 's' : ''} ce mois-ci (total staff visibles).
          </p>
          <div className="pt-list">
            {data.staff.length === 0 && <p className="site-sub">Aucun staff visible.</p>}
            {data.staff.map((s) => (
              <div key={s.id} className="pt-row" style={{ cursor: 'default' }}>
                <span className="pt-staff">
                  <GradeBadge gk={topGradeKey(s.grades)} />
                  <strong>{s.pseudo}</strong>
                  <span className="pt-grade">{getGrade(topGradeKey(s.grades)).label}</span>
                </span>
                <span className="pt-rowtotal">
                  {s.count} /dmdfinish
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
