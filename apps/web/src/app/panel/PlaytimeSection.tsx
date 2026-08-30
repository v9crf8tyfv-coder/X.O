'use client';

import { useCallback, useEffect, useState } from 'react';
import { getGrade } from '@xo/shared';
import { GradeBadge } from './GradeBadge';

/** Grade le plus élevé (par niveau) d'un staff — pour l'affichage. */
function topGradeKey(grades: string[]): string {
  if (!grades || grades.length === 0) return 'joueur';
  return grades.reduce((best, g) => (getGrade(g).level > getGrade(best).level ? g : best), grades[0]!);
}

interface Row {
  id: string;
  pseudo: string;
  grades: string[];
  perDay: Record<string, number>;
  absentDays: string[];
  total: number;
}
interface Data {
  monday: string;
  days: string[];
  staff: Row[];
}

const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

/** minutes -> "2h05" / "45min" / "—" */
function fmt(min: number): string {
  if (!min) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h${String(m).padStart(2, '0')}`;
  if (h) return `${h}h`;
  return `${m}min`;
}

function shiftWeek(monday: string, deltaWeeks: number): string {
  const d = new Date(monday + 'T12:00:00');
  d.setDate(d.getDate() + deltaWeeks * 7);
  return d.toISOString().slice(0, 10);
}

export default function PlaytimeSection() {
  const [week, setWeek] = useState<string | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const q = week ? `?week=${week}` : '';
      const r = await fetch(`/api/playtime${q}`);
      if (r.ok) setData(await r.json());
      else setError('Accès refusé ou erreur.');
    } catch {
      setError('Impossible de contacter le serveur.');
    }
  }, [week]);
  useEffect(() => {
    load();
  }, [load]);

  const monday = data?.monday ?? '';
  const weekLabel = monday
    ? `Semaine du ${new Date(monday + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })}`
    : '…';
  const nowMonday = () => monday || new Date().toISOString().slice(0, 10);

  const staff = data?.staff ?? [];
  const current = staff.find((s) => s.id === selected) ?? null;

  // ---------- Vue détail d'un staff ----------
  if (current) {
    return (
      <div className="site-section">
        <button className="back-btn" onClick={() => setSelected(null)}>
          ← Retour à la liste
        </button>
        <div className="pt-detail-head">
          <GradeBadge gk={topGradeKey(current.grades)} />
          <h2 style={{ margin: 0 }}>{current.pseudo}</h2>
          <span className="pt-grade">{getGrade(topGradeKey(current.grades)).label}</span>
        </div>

        <div className="pt-weeknav">
          <button className="chip" onClick={() => setWeek(shiftWeek(nowMonday(), -1))}>
            ← Précédente
          </button>
          <span className="pt-weeklabel">{weekLabel}</span>
          <button className="chip" onClick={() => setWeek(shiftWeek(nowMonday(), 1))}>
            Suivante →
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="pt-table pt-detail">
            <thead>
              <tr>
                {(data?.days ?? []).map((d, i) => (
                  <th key={d}>
                    {DAY_LABELS[i]}
                    <div className="pt-date">
                      {new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {(data?.days ?? []).map((d) => {
                  const absent = current.absentDays.includes(d);
                  const min = current.perDay[d] ?? 0;
                  return (
                    <td key={d} className={absent ? 'pt-absent' : ''}>
                      {absent ? (
                        <>
                          ABSENT
                          {min > 0 && <div className="pt-absent-play">joué {fmt(min)}</div>}
                        </>
                      ) : (
                        fmt(min)
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="pt-weektotal">
          Total de la semaine : <strong>{fmt(current.total)}</strong>
        </div>
      </div>
    );
  }

  // ---------- Vue liste des staffs ----------
  return (
    <div className="site-section">
      <h2>Temps de jeu</h2>
      <p className="site-sub">Clique sur un staff pour voir son temps de jeu détaillé (par jour).</p>
      {error && <div className="form-error">{error}</div>}

      <div className="pt-list">
        {staff.length === 0 && <p className="site-sub">Aucun staff visible.</p>}
        {staff.map((s) => (
          <button key={s.id} className="pt-row" onClick={() => setSelected(s.id)}>
            <span className="pt-staff">
              <GradeBadge gk={topGradeKey(s.grades)} />
              <strong>{s.pseudo}</strong>
              <span className="pt-grade">{getGrade(topGradeKey(s.grades)).label}</span>
            </span>
            <span className="pt-rowtotal">{fmt(s.total)} cette semaine ›</span>
          </button>
        ))}
      </div>
    </div>
  );
}
