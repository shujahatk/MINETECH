'use client';

import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Target,
  GitFork,
  Radio,
  Inbox,
  FileText,
  Activity,
  BarChart3,
  Settings,
  Command,
} from 'lucide-react';
import { Sidebar } from '../components/navigation/Sidebar';
import { TopNav } from '../components/navigation/TopNav';
import { ModalFrame } from '../components/modals/ModalFrame';
import { Button } from '../components/buttons/Button';
import { cn } from '../utils/cn';

export const DEFAULT_NAV_SECTIONS = [
  {
    title: 'Workspace',
    items: [
      ['Dashboard', 'dashboard', LayoutDashboard],
      ['Workstation', 'workstation', Target],
      ['Leads', 'leads', Users],
      ['Pipeline', 'pipeline', GitFork],
      ['Campaigns', 'campaigns', Radio],
      ['Inbox', 'inbox', Inbox, 3],
    ],
  },
  {
    title: 'Intelligence',
    items: [
      ['Analytics', 'analytics', BarChart3],
      ['Templates', 'templates', FileText],
      ['Sequences', 'sequences', Activity],
    ],
  },
  {
    title: 'System',
    items: [
      ['Settings', 'settings', Settings],
      ['System Health', 'command-center', Command],
    ],
  },
];

export function DashboardLayout({
  children,
  brandName = 'MineTech',
  brandSubtitle = 'Outbound CRM',
  brandLogoText = 'M',
  navSections = DEFAULT_NAV_SECTIONS,
  activeId = 'dashboard',
  onSelectNav = () => {},
  unreadCount = 3,
  userName = 'Admin User',
  userInitials = 'AU',
  onQuickAction = null,
  className = '',
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeItem = navSections
    .flatMap((s) => s.items)
    .find((item) => item[1] === activeId);
  const currentTitle = activeItem ? activeItem[0] : 'Workspace';

  return (
    <div className={cn('flex min-h-screen bg-background text-foreground', className)}>
      {/* Desktop Collapsible Sidebar */}
      <Sidebar
        brandName={brandName}
        brandSubtitle={brandSubtitle}
        brandLogoText={brandLogoText}
        sections={navSections}
        activeId={activeId}
        onSelect={(id) => {
          onSelectNav(id);
          setMobileOpen(false);
        }}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        onQuickAction={onQuickAction}
      />

      {/* Main Content Pane */}
      <div className="min-w-0 flex-1 flex flex-col">
        <TopNav
          title="Workspace"
          subtitle={currentTitle}
          onOpenMobile={() => setMobileOpen(true)}
          unreadCount={unreadCount}
          userName={userName}
          userInitials={userInitials}
          onQuickAction={onQuickAction}
        />

        <main className="page-content flex-1 outline-none">
          <div key={activeId} className="page-enter">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <ModalFrame
          title="Navigation Menu"
          onClose={() => setMobileOpen(false)}
          drawer
          className="left-0 right-auto max-w-xs"
        >
          <div className="flex items-center justify-between border-b border-border p-4 bg-sidebar">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
                {brandLogoText}
              </div>
              <span className="text-sm font-semibold text-foreground">{brandName}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setMobileOpen(false)}>
              Close
            </Button>
          </div>
          <div className="p-3 bg-sidebar flex-1 overflow-y-auto">
            {navSections.map((section) => (
              <div key={section.title} className="mb-4">
                <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.title}
                </p>
                <div className="space-y-0.5">
                  {section.items.map(([label, id, Icon, count]) => {
                    const isActive = activeId === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          onSelectNav(id);
                          setMobileOpen(false);
                        }}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors text-left',
                          isActive
                            ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
                            : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground'
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1">{label}</span>
                        {count && (
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ModalFrame>
      )}
    </div>
  );
}

export default DashboardLayout;
