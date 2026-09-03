'use client';

import { useState } from 'react';
import { getGrade, gradeLogoKey } from '@xo/shared';

/**
 * Affiche le LOGO du grade (fichier /logos/<grade>.png) s'il existe,
 * sinon replie sur un point de couleur.
 */
export function GradeBadge({ gk }: { gk: string }) {
  const [ok, setOk] = useState(true);
  const color = gk === 'joueur' ? 'ffffff' : getGrade(gk).color;

  if (ok) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="grade-logo-sm"
        src={`/logos/${gradeLogoKey(gk)}.png`}
        alt=""
        onError={() => setOk(false)}
      />
    );
  }
  return (
    <span
      className="grade-bubble"
      style={{ backgroundColor: `#${color}`, color: `#${color}` }}
    />
  );
}
