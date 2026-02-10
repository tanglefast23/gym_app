import type { Metadata, Viewport } from 'next';
import { Inter, DM_Mono } from 'next/font/google';
import { ClickSoundProvider } from '@/components/ui/ClickSoundProvider';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ThemeProvider } from '@/components/ui/ThemeProvider';
import { FontSizeProvider } from '@/components/ui/FontSizeProvider';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

const dmMono = DM_Mono({
  variable: '--font-dm-mono',
  weight: ['400', '500'],
  subsets: ['latin'],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#F59E0B',
};

export const metadata: Metadata = {
  title: 'Workout PWA',
  description: 'Track your workouts, log weights, and monitor progress',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Workout',
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:; img-src 'self' data:; font-src 'self' data:; connect-src 'self';"
        />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body
        className={`${inter.variable} ${dmMono.variable} bg-background text-foreground antialiased`}
      >
        <ThemeProvider />
        <FontSizeProvider />
        <ClickSoundProvider />
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
