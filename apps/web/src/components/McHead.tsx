'use client';
import { useMemo, useRef, type CSSProperties } from 'react';

/**
 * Tête Minecraft fiable et CENTRALISÉE pour tout le panel.
 * Source fiable + secours AUTOMATIQUE : crafthead (vrai skin) -> mc-heads -> minotar -> Steve
 * -> repli data-URI (même origine, impossible à bloquer) -> jamais de tête cassée.
 * Accepte un pseudo OU un UUID.
 */
export function mcHeadSources(idOrPseudo: string, size = 64): string[] {
  const id = encodeURIComponent((idOrPseudo ?? '').trim() || 'MHF_Steve');
  const s = Math.max(8, Math.min(512, Math.round(size)));
  return [
    `https://crafthead.net/avatar/${id}/${s}`,
    `https://mc-heads.net/avatar/${id}/${s}`,
    `https://minotar.net/avatar/${id}/${s}`,
    `https://minotar.net/avatar/MHF_Steve/${s}`,
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='80' height='80' fill='%237a5b43'/%3E%3Crect x='20' y='22' width='40' height='36' fill='%23caa77f'/%3E%3C/svg%3E",
  ];
}

export function McHead({
  pseudo,
  size = 48,
  style,
  alt = '',
}: {
  pseudo: string;
  size?: number;
  style?: CSSProperties;
  alt?: string;
}) {
  const srcs = useMemo(() => mcHeadSources(pseudo, size), [pseudo, size]);
  const i = useRef(0);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={srcs[0]}
      alt={alt}
      style={{ width: size, height: size, borderRadius: 8, imageRendering: 'pixelated', ...style }}
      onError={(e) => {
        i.current += 1;
        if (i.current < srcs.length) (e.currentTarget as HTMLImageElement).src = srcs[i.current];
      }}
    />
  );
}
