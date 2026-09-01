import './globals.css';
import AppShell from '@/components/layout/AppShell';

export const metadata = {
  title: 'MINETECH — Outbound Dialer & Sales Workstation',
  description: 'MINETECH Outbound Sales & Dialer Workstation with CRM, Email Blasts, Unified Inbox, Sequences, and Twilio Voice/SMS.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#090d16] text-slate-100 min-h-screen flex flex-col antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
