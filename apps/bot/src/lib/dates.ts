/** Parse une date "JJ/MM/AAAA" -> Date (UTC minuit). null si invalide. */
export function parseFrDate(input: string): Date | null {
  const m = input.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const day = parseInt(m[1]!, 10);
  const month = parseInt(m[2]!, 10);
  const year = parseInt(m[3]!, 10);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCDate() !== day ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCFullYear() !== year
  ) {
    return null;
  }
  return d;
}

/** Formate une Date (ou "YYYY-MM-DD") en "JJ/MM/AAAA" */
export function formatFrDate(d: Date | string | null): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '—';
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = date.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Convertit une Date en "YYYY-MM-DD" pour Postgres (colonne date) */
export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Jours restants jusqu'à la date de fin (min 0). */
export function daysRemaining(end: Date | string | null): number {
  if (!end) return 0;
  const endDate = typeof end === 'string' ? new Date(end) : end;
  if (Number.isNaN(endDate.getTime())) return 0;
  const now = new Date();
  const diffMs =
    Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()) -
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.ceil(diffMs / 86_400_000));
}
