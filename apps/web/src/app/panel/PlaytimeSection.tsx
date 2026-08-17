'use client';

import { useCallback, useEffect, useState } from 'react';
import { getGrade } from '@xo/shared';
import { GradeBadge } from './GradeBadge';

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

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

/** minutes -> "2h05" / "45m" / "—" */
function fmt(min: number): string {
  if (!min) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h${String(m).padStart(2, '0')}`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function shiftWeek(monday: string, deltaWeeks: number): string {
  const d = new Date(monday + 'T12:00:00');
  d.setDate(d.getDate() + deltaWeeks * 7);
  return d.toISOString().slice(0, 10);
}

export default function PlaytimeSection() {
  const [week, setWeek] = useState<string | null>(null); // lundi ISO, null = semaine courante
  const [data, setData] = useState<Data | null>(null);
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
  const label = monday
    ? `Semaine du ${new Date(monday + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`
    : '…';

  return (
    <div className="site-section">
      <h2>Temps de jeu</h2>
      <p className="site-sub">Temps de jeu réel (en jeu) de chaque staff, par jour.</p>
      {error && <div className="form-error">{error}</div>}

      <div className="pt-weeknav">
        <button className="chip" onClick={() => setWeek(shiftWeek(monday || new Date().toISOString().slice(0, 10), -1))}>
          ← Semaine préc.
        </button>
        <span className="pt-weeklabel">{label}</span>
        <button className="chip" onClick={() => setWeek(shiftWeek(monday || new Date().toISOString().slice(0, 10), 1))}>
          Semaine suiv. →
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="pt-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Staff</th>
              {(data?.days ?? []).map((d, i) => (
                <th key={d}>
                  {DAY_LABELS[i]}
                  <div className="pt-date">
                    {new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                  </div>
                </th>
              ))}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {(data?.staff ?? []).map((s) => (
              <tr key={s.id}>
                <td style={{ textAlign: 'left' }}>
                  <span className="pt-staff">
                    <GradeBadge gk={s.grades[0] ?? 'joueur'} /> {s.pseudo}
                    <span className="pt-grade">{getGrade(s.grades[0]).label}</span>
                  </span>
                </td>
                {(data?.days ?? []).map((d) => (
                  <td key={d} className={s.absentDays.includes(d) ? 'pt-absent' : ''}>
                    {s.absentDays.includes(d) ? 'ABSENT' : fmt(s.perDay[d] ?? 0)}
                  </td>
                ))}
                <td className="pt-total">{fmt(s.total)}</td>
              </tr>
            ))}
            {data && data.staff.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', opacity: 0.6 }}>
                  Aucun staff visible.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
