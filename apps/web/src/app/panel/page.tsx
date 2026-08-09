import Link from 'next/link';
import { ALL_GRADES } from '@xo/shared';
import { getCurrentAccount } from '@/lib/auth';
import { publicAccount } from '@/lib/accounts';
import PanelClient from './PanelClient';

export const dynamic = 'force-dynamic';

export default async function PanelPage() {
  const { isSiteBlocked } = await import('@/lib/siteLock');
  if (await isSiteBlocked()) {
    return (
      <div className="denied">
        <div className="denied-card">
          <div className="denied-emoji">🔒</div>
          <h1>Site verrouillé</h1>
          <p>Le site est temporairement verrouillé par le propriétaire.</p>
        </div>
      </div>
    );
  }
  const account = await getCurrentAccount();

  // Accès refusé : pas connecté, ou pas de grade staff valide (joueur = pas d'accès)
  const hasAccess =
    account !== null &&
    account.site_grade !== 'joueur' &&
    Boolean(ALL_GRADES[account.site_grade]);

  if (!hasAccess) {
    return (
      <div className="denied">
        <div className="denied-card">
          <div className="denied-emoji">🚫</div>
          <h1>Accès refusé</h1>
          <p>
            {account
              ? 'Ton compte n’a pas de grade staff. Un fondateur doit t’attribuer un accès.'
              : 'Tu dois être connecté avec un compte autorisé.'}
          </p>
          <Link href="/" className="btn-launch">
            Retour à l’accueil
          </Link>
        </div>
      </div>
    );
  }

  return <PanelClient account={publicAccount(account!)} />;
}
