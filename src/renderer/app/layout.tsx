import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'prof-test',
  description: 'Cross-platform LaTeX test generator',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
