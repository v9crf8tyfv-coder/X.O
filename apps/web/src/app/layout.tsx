import type { Metadata } from 'next';
import './globals.css';
import { isSiteBlocked } from '@/lib/siteLock';

export const metadata: Metadata = {
  title: 'X.O — Panel',
  description: 'Panel de gestion staff du serveur',
};

// Vérifie le verrouillage à chaque requête (jamais mis en cache statique)
export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const blocked = await isSiteBlocked();
  return (
    <html lang="fr">
      <body>
        {blocked ? (
          <div className="denied">
            <div className="denied-card">
              <div className="denied-emoji">🔒</div>
              <h1>Site verrouillé</h1>
              <p>Le site est totalement verrouillé par le propriétaire. Reviens plus tard.</p>
            </div>
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
