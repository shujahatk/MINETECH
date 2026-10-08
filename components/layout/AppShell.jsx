'use client';
import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Inbox,
  Radio,
  GitFork,
  FileText,
  Target,
  BarChart3,
  Settings,
  Plus,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Activity,
  Search,
  Command,
} from 'lucide-react';
import ThemeToggle from '@/components/theme/ThemeToggle';
import { Button } from '@/components/ui/button';
import { ModalFrame } from '@/components/ui/modal-frame';
import { useVisibleInterval } from '@/lib/hooks/useVisibleInterval';

// Loaded only when the user opens Compose — not on every page load.
const ComposeModal = dynamic(() => import('@/components/email/ComposeModal'), { ssr: false });

// Calls / SMS are intentionally not in the navigation: MineTech is email-first.
// Their pages, API routes and webhooks still exist (see lib/config/features.js to re-enable).
const sections = [
  {
    title: 'Workspace',
    items: [
      ['Dashboard', '/dashboard', LayoutDashboard],
      ['Workstation', '/workstation', Target],
      ['Leads', '/leads', Users],
      ['Pipeline', '/pipeline', GitFork],
      ['Campaigns', '/email/blasts', Radio],
      ['Inbox', '/email/inbox', Inbox],
    ],
  },
  {
    title: 'Email',
    items: [
      ['Templates', '/email/templates', FileText],
      ['Sequences', '/email/sequences', Activity],
    ],
  },
  {
    title: 'Intelligence',
    items: [
      ['Analytics', '/analytics', BarChart3],
    ],
  },
  {
    title: 'System',
    items: [
      ['Settings', '/settings', Settings],
      ['System health', '/command-center', Command],
    ],
  },
];

export default function AppShell({ children }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';
  const [user, setUser] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('minetech-sidebar') === 'collapsed');
    } catch {}
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isLoginPage) return;
    fetch('/api/auth/me')
      .then((r) => {
        if (!r.ok) throw new Error('Not authenticated');
        return r.json();
      })
      .then((j) => {
        if (j.user) setUser(j.user);
      })
      .catch(() => {});
  }, [isLoginPage]);

  // Sidebar badge: one head-only COUNT query (not the full inbox payload), paused while the tab is hidden.
  const fetchUnread = useCallback(async () => {
    try {
      const res = await fetch('/api/email/inbox/unread');
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!isLoginPage) fetchUnread();
  }, [isLoginPage, fetchUnread]);

  useVisibleInterval(fetchUnread, 60000, !isLoginPage);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    window.location.href = '/login';
  };

  const toggleSidebar = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem('minetech-sidebar', next ? 'collapsed' : 'expanded');
    } catch {}
  };

  if (isLoginPage) return children;

  const current = sections.flatMap((s) => s.items).find(([, href]) => pathname === href)?.[0] || 'Workspace';
  const initials = user?.name?.split(' ').slice(0, 2).map((n) => n[0]).join('') || 'M';

  const navigation = (compact = false) => (
    <nav aria-label="Main navigation" className={`px-2.5 py-3 ${compact ? 'space-y-3' : 'space-y-5'}`}>
      {sections.map((section, sectionIndex) => (
        <div key={section.title}>
          {compact ? (
            sectionIndex > 0 && <div className="mx-2 mb-3 h-px bg-sidebar-border" aria-hidden="true" />
          ) : (
            <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              {section.title}
            </p>
          )}
          <div className="space-y-0.5">
            {section.items.map(([label, href, Icon]) => {
              const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
              const showUnread = href === '/email/inbox' && unreadCount > 0;
              return (
                <Link
                  key={href}
                  href={href}
                  title={compact ? label : undefined}
                  aria-label={compact ? label : undefined}
                  aria-current={isActive ? 'page' : undefined}
                  className={`group relative flex min-h-[34px] items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
                    isActive
                      ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
                      : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground'
                  } ${compact ? 'justify-center px-0' : ''}`}
                >
                  {/* Active rail: small, brand-coloured, fades in with the route change */}
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute -left-2.5 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-primary anim-fade-in"
                    />
                  )}
                  <Icon
                    className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
                      isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground group-hover:scale-110'
                    }`}
                    aria-hidden="true"
                  />
                  {!compact && <span className="flex-1 truncate">{label}</span>}
                  {!compact && showUnread && (
                    <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold leading-none tabular-nums text-primary">
                      {unreadCount}
                    </span>
                  )}
                  {compact && showUnread && (
                    <span
                      aria-hidden="true"
                      className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full bg-primary ring-2 ring-sidebar"
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      {/* Main Desktop Sidebar */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200 ease-out lg:flex ${
          collapsed ? 'w-[64px]' : 'w-[232px]'
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-sidebar-border px-3.5">
          <Link href="/dashboard" aria-label="MineTech dashboard" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground shadow-subtle">
              M
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-sm font-semibold tracking-tight text-foreground">MineTech</span>
                <span className="text-[10px] font-medium text-muted-foreground">Outbound CRM</span>
              </div>
            )}
          </Link>
          {!collapsed && (
            <button
              onClick={toggleSidebar}
              aria-label="Collapse sidebar"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto py-2">{navigation(collapsed)}</div>

        {/* Footer: expand control when collapsed */}
        {collapsed && (
          <div className="border-t border-sidebar-border p-3">
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => setIsComposeOpen(true)}
                title="Compose email"
                aria-label="Compose email"
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors hover:bg-primary/20"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                onClick={toggleSidebar}
                aria-label="Expand sidebar"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="min-w-0 flex-1 flex flex-col">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-border bg-card/90 px-4 backdrop-blur-md sm:px-5 xl:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="hidden items-center gap-2 text-xs font-medium sm:flex">
              <span className="text-muted-foreground">Workspace</span>
              <span className="text-muted-foreground/60">/</span>
              <span className="text-foreground font-semibold">{current}</span>
            </div>
            <span className="font-semibold sm:hidden text-foreground">MineTech</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Search Pill */}
            <Link
              href="/leads"
              className="hidden h-8 items-center gap-2 rounded-lg border border-border bg-muted/50 px-2.5 text-xs text-muted-foreground transition-colors hover:border-muted-foreground/40 hover:bg-muted sm:flex"
            >
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Search leads, campaigns...</span>
              <kbd className="kbd ml-3">
                /
              </kbd>
            </Link>

            {/* Quick Actions */}
            <Button
              variant="outline"
              size="sm"
              className="hidden items-center gap-1.5 sm:flex"
              onClick={() => setIsComposeOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 text-primary" />
              <span>Compose</span>
            </Button>

            {/* Theme Toggle Component */}
            <ThemeToggle />

            <Link
              href="/email/inbox"
              aria-label={`Inbox, ${unreadCount} unread`}
              className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-subtle transition-colors hover:bg-muted hover:text-foreground"
            >
              <Inbox className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>

            <div className="h-5 w-px bg-border" />

            {/* User Profile Pill */}
            <Link
              href="/settings"
              className="flex items-center gap-2 rounded-lg border border-transparent p-1 pr-2 transition-colors hover:border-border hover:bg-muted"
              aria-label="Account settings"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-secondary text-[10px] font-semibold text-foreground">
                {initials}
              </div>
              <span className="hidden text-xs font-medium text-foreground md:block max-w-[120px] truncate">
                {user?.name || 'Admin'}
              </span>
            </Link>

            <Button
              variant="ghost"
              size="icon"
              aria-label="Sign out"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Main Routed Page Content */}
        <main id="main-content" tabIndex={-1} className="page-content flex-1 outline-none">
          <div key={pathname} className="page-enter">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <ModalFrame title="Navigation" onClose={() => setMobileOpen(false)} drawer className="left-0 right-auto max-w-xs">
          <div className="flex items-center justify-between border-b border-border p-4 bg-sidebar">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
                M
              </div>
              <span className="text-sm font-semibold text-foreground">MineTech Outbound</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setMobileOpen(false)}>
              Close
            </Button>
          </div>
          <div className="py-2 bg-sidebar flex-1">{navigation()}</div>
          <div className="border-t border-border p-4 space-y-2 bg-sidebar">
            <Button
              className="w-full justify-center"
              onClick={() => {
                setMobileOpen(false);
                setIsComposeOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Compose email
            </Button>
          </div>
        </ModalFrame>
      )}

      {/* Persistent Modals */}
      {isComposeOpen && <ComposeModal onClose={() => setIsComposeOpen(false)} />}
    </div>
  );
}
