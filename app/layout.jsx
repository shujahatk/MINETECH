import './globals.css';
import AppShell from '@/components/layout/AppShell';
import { ThemeProvider, themeScriptSnippet } from '@/components/theme/ThemeProvider';
import { Toaster } from '@/components/ui/sonner';

export const metadata = {
  title: 'MINETECH — Outbound Sales Workstation & CRM',
  description: 'MINETECH outbound sales workstation with CRM, email campaigns, unified inbox and sequences.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScriptSnippet }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
        <ThemeProvider>
          <AppShell>{children}</AppShell>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
