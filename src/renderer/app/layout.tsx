import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'ProfTest - LaTeX Test Generator',
  description: 'Cross-platform LaTeX test generator with AI assistance',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="theme-dark">{children}</body>
    </html>
  );
}
