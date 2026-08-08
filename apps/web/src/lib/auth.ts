import { findById, type Account } from './accounts';
import { getSessionAccountId } from './session';

/** Compte connecté (côté serveur), ou null */
export async function getCurrentAccount(): Promise<Account | null> {
  const id = getSessionAccountId();
  if (!id) return null;
  return findById(id);
}
