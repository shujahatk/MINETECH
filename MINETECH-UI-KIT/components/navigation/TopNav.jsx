'use client';

import React from 'react';
import { Menu, Search, Plus, Bell, LogOut } from 'lucide-react';
import { Button } from '../buttons/Button';
import { ThemeToggle } from '../../themes/ThemeToggle';
import { cn } from '../../utils/cn';

export function TopNav({
  title = 'Workspace',
  subtitle = 'Dashboard',
  breadcrumbs = null,
  onOpenMobile = () => {},
  onSearchClick = () => {},
  onQuickAction = null,
  quickActionLabel = 'Compose',
  unreadCount = 0,
  onNotificationClick = () => {},
  userName = 'Admin',
  userInitials = 'M',
  userRole = 'Account Executive',
  onLogout = () => {},
  extraActions = null,
  className = '',
}) {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-border bg-card/90 px-4 backdrop-blur-md sm:px-5 xl:px-6 select-none',
        className
      )}
    >
      {/* Left Area: Mobile Trigger + Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden shrink-0"
          aria-label="Open navigation"
          onClick={onOpenMobile}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {breadcrumbs ? (
          <div className="hidden sm:block">{breadcrumbs}</div>
        ) : (
          <div className="hidden items-center gap-2 text-xs font-medium sm:flex">
            <span className="text-muted-foreground">{title}</span>
            <span className="text-muted-foreground/60">/</span>
            <span className="text-foreground font-semibold">{subtitle}</span>
          </div>
        )}

        <span className="font-semibold text-sm sm:hidden text-foreground truncate">{subtitle}</span>
      </div>

      {/* Right Area: Search + Actions + Theme + Notifications + User */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Search Pill */}
        <button
          type="button"
          onClick={onSearchClick}
          className="hidden h-8 items-center gap-2 rounded-lg border border-border bg-muted/50 px-2.5 text-xs text-muted-foreground transition-colors hover:border-muted-foreground/40 hover:bg-muted sm:flex cursor-pointer"
        >
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Search leads, campaigns...</span>
          <kbd className="kbd ml-3 font-mono text-[10px]">
            /
          </kbd>
        </button>

        {/* Quick Action Button */}
        {onQuickAction && (
          <Button
            variant="outline"
            size="sm"
            className="hidden items-center gap-1.5 sm:flex"
            onClick={onQuickAction}
          >
            <Plus className="h-3.5 w-3.5 text-primary" />
            <span>{quickActionLabel}</span>
          </Button>
        )}

        {extraActions}

        {/* Theme Toggle Component */}
        <ThemeToggle />

        {/* Notifications / Inbox Bell */}
        <button
          type="button"
          onClick={onNotificationClick}
          aria-label={`Notifications, ${unreadCount} unread`}
          className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-subtle transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        <div className="h-5 w-px bg-border hidden sm:block" />

        {/* User Profile Pill */}
        <div
          className="flex items-center gap-2 rounded-lg border border-transparent p-1 pr-2 transition-colors hover:border-border hover:bg-muted cursor-pointer"
          title={`${userName} (${userRole})`}
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-secondary text-[10px] font-semibold text-foreground">
            {userInitials}
          </div>
          <span className="hidden text-xs font-medium text-foreground md:block max-w-[120px] truncate">
            {userName}
          </span>
        </div>

        {onLogout && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Sign out"
            onClick={onLogout}
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </div>
    </header>
  );
}

export default TopNav;
