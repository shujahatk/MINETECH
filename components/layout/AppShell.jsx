'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Mail,
  Inbox,
  Send,
  Sparkles,
  Layers,
  FileText,
  Phone,
  MessageSquare,
  BarChart3,
  Settings,
  Flame,
  ChevronDown,
  PhoneCall,
  LogOut,
} from 'lucide-react';
import DialerModal from '@/components/twilio/DialerModal';
import ComposeModal from '@/components/email/ComposeModal';
import LoginPage from '@/app/login/page';

export default function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [authState, setAuthState] = useState('loading'); // 'loading' | 'authenticated' | 'unauthenticated'
  const [emailExpanded, setEmailExpanded] = useState(true);
  const [twilioExpanded, setTwilioExpanded] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isDialerOpen, setIsDialerOpen] = useState(false);
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const j = await res.json();
        if (j.user) {
          setUser(j.user);
          setAuthState('authenticated');
          return;
        }
      }
      setUser(null);
      setAuthState('unauthenticated');
    } catch (err) {
      setUser(null);
      setAuthState('unauthenticated');
    }
  };

  useEffect(() => {
    checkAuth();
  }, [pathname]);

  useEffect(() => {
    if (authState !== 'authenticated') return;
    const fetchUnread = async () => {
      try {
        const res = await fetch('/api/email/inbox');
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.counts?.unread || 0);
        }
      } catch (err) {}
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [authState, pathname]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    setUser(null);
    setAuthState('unauthenticated');
    window.location.href = '/login';
  };

  const navItemClass = (path, exact = false) => {
    const isActive = exact ? pathname === path : pathname.startsWith(path);
    return `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
      isActive
        ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shadow-[0_0_12px_rgba(99,102,241,0.25)]'
        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
    }`;
  };

  const isLoginPage = pathname === '/login';

  // 1. Loading state
  if (authState === 'loading') {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-500 flex items-center justify-center animate-pulse">
            <Flame className="w-6 h-6 text-indigo-400" />
          </div>
          <span className="text-xs text-slate-400 font-medium font-mono">Verifying authentication...</span>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated state or on /login page
  if (authState === 'unauthenticated' || isLoginPage) {
    return (
      <div className="min-h-screen bg-[#090d16] flex flex-col justify-center">
        <LoginPage />
      </div>
    );
  }

  // 3. Authenticated state: Full Workstation Shell
  return (
    <div className="flex min-h-screen bg-[#090d16]">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800/80 bg-[#0c1220]/90 backdrop-blur-md flex flex-col justify-between shrink-0 sticky top-0 h-screen overflow-y-auto">
        <div>
          {/* Logo Brand */}
          <div className="p-5 border-b border-slate-800/60 flex items-center justify-between">
            <Link href="/workstation" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform">
                <Flame className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-extrabold text-base tracking-tight text-white block">
                  MINETECH <span className="text-indigo-400">OUTBOUND</span>
                </span>
                <span className="text-[10px] text-slate-500 font-mono block -mt-0.5 tracking-wider uppercase">
                  Dialer & Workstation
                </span>
              </div>
            </Link>
          </div>

          {/* Quick Action Buttons */}
          <div className="p-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => setIsComposeOpen(true)}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition"
            >
              <Send className="w-3.5 h-3.5" /> Compose
            </button>
            <button
              onClick={() => setIsDialerOpen(true)}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition"
            >
              <PhoneCall className="w-3.5 h-3.5" /> Dial Pad
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            <Link href="/workstation" className={navItemClass('/workstation', true)}>
              <LayoutDashboard className="w-4 h-4 text-indigo-400" />
              <span>Dashboard</span>
            </Link>

            <Link href="/leads" className={navItemClass('/leads')}>
              <Users className="w-4 h-4 text-blue-400" />
              <span>Leads CRM</span>
            </Link>

            {/* Email Section */}
            <div className="pt-2">
              <button
                onClick={() => setEmailExpanded(!emailExpanded)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-300"
              >
                <span>Email Outreach</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${emailExpanded ? '' : '-rotate-90'}`} />
              </button>

              {emailExpanded && (
                <div className="mt-1 space-y-0.5 pl-1.5">
                  <Link href="/email/inbox" className={navItemClass('/email/inbox')}>
                    <Inbox className="w-4 h-4 text-amber-400" />
                    <span className="flex-1">Unified Inbox</span>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-500 text-white animate-pulse">
                        {unreadCount}
                      </span>
                    )}
                  </Link>

                  <Link href="/email/blasts" className={navItemClass('/email/blasts')}>
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span>Email Blasts</span>
                  </Link>

                  <Link href="/email/sequences" className={navItemClass('/email/sequences')}>
                    <Layers className="w-4 h-4 text-cyan-400" />
                    <span>Sequences</span>
                  </Link>

                  <Link href="/email/templates" className={navItemClass('/email/templates')}>
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <span>Templates</span>
                  </Link>
                </div>
              )}
            </div>

            {/* Twilio Section */}
            <div className="pt-2">
              <button
                onClick={() => setTwilioExpanded(!twilioExpanded)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-300"
              >
                <span>Twilio Channels</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${twilioExpanded ? '' : '-rotate-90'}`} />
              </button>

              {twilioExpanded && (
                <div className="mt-1 space-y-0.5 pl-1.5">
                  <Link href="/twilio/calls" className={navItemClass('/twilio/calls')}>
                    <Phone className="w-4 h-4 text-emerald-400" />
                    <span>Voice Calling</span>
                  </Link>

                  <Link href="/twilio/sms" className={navItemClass('/twilio/sms')}>
                    <MessageSquare className="w-4 h-4 text-sky-400" />
                    <span>SMS / WhatsApp</span>
                  </Link>
                </div>
              )}
            </div>

            <div className="pt-2">
              <Link href="/analytics" className={navItemClass('/analytics')}>
                <BarChart3 className="w-4 h-4 text-pink-400" />
                <span>Analytics</span>
              </Link>

              <Link href="/settings" className={navItemClass('/settings')}>
                <Settings className="w-4 h-4 text-slate-400" />
                <span>Settings</span>
              </Link>
            </div>
          </nav>
        </div>

        {/* Footer User Profile & System Status */}
        <div className="p-4 border-t border-slate-800/60 bg-slate-900/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-indigo-500/30 border border-indigo-400/50 flex items-center justify-center font-bold text-xs text-indigo-300 shrink-0">
                {user?.name ? user.name[0] : 'A'}
              </div>
              <div className="text-xs truncate">
                <span className="text-slate-200 font-semibold block leading-tight truncate">
                  {user?.name || 'Admin User'}
                </span>
                <span className="text-[10px] text-slate-400 font-mono block truncate">
                  {user?.email || 'admin@8020outbound.com'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleLogout}
                className="text-[11px] text-slate-500 hover:text-rose-400 transition"
                title="Log Out"
              >
                Logout
              </button>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="System Online"></span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#090d16] overflow-y-auto">
        <div className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">{children}</div>
      </main>

      {/* Quick Launch Modals */}
      {isDialerOpen && <DialerModal onClose={() => setIsDialerOpen(false)} />}
      {isComposeOpen && <ComposeModal onClose={() => setIsComposeOpen(false)} />}
    </div>
  );
}
