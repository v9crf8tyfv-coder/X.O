// Pousse un rank vers le Google Sheet "listes staff" via un Apps Script webhook (déployé sur le
// compte Google de l'admin). 100% GRATUIT (Apps Script), best-effort et JAMAIS bloquant pour le
// rank. L'URL du webhook est dans la variable d'env SHEET_WEBHOOK_URL (sinon : no-op silencieux).
//
// Principe : on envoie le pseudo + la liste de SES grades + une date. Le script range le pseudo
// dans chaque colonne de grade s'il n'y est pas déjà (dédup côté script). date='' = pas de date
// (backfill des staffs déjà en place) ; date=aujourd'hui = nouveau rank.

const SHEET_TOKEN = 'emeria-sheet-7q2'; // partagé avec le script (anti-POST random sur l'URL)

export async function pushRankToSheet(
  pseudo: string,
  grades: string[],
  withDate: boolean,
): Promise<void> {
  const url = process.env.SHEET_WEBHOOK_URL;
  if (!url || !pseudo || !Array.isArray(grades) || grades.length === 0) return;
  const date = withDate
    ? new Date().toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })
    : '';
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: SHEET_TOKEN, pseudo, grades, date }),
      signal: ctrl.signal,
    }).finally(() => clearTimeout(t));
  } catch {
    /* webhook indispo -> on n'empêche jamais le rank */
  }
}
