import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'X.O — Panel',
  description: 'Panel de gestion staff du serveur',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
