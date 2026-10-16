'use client';

import React from 'react';
import { PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react';
import { cn } from '../../utils/cn';

/**
 * Enterprise Collapsible Sidebar Navigation.
 *  - brandName: string (e.g. 'MineTech')
 *  - brandSubtitle: string (e.g. 'Outbound CRM')
 *  - brandLogoText: string (e.g. 'M')
 *  - sections: Array of { title: string, items: Array<[label, idOrHref, Icon, badgeCount?]> }
 *  - activeId: Current active page/route identifier
 *  - onSelect: Callback when an item is clicked
 *  - collapsed: boolean
 *  - onToggleCollapse: () => void
 *  - onQuickAction: Optional callback for the quick + compose button
 */
export function Sidebar({
  brandName = 'MineTech',
  brandSubtitle = 'Outbound CRM',
  brandLogoText = 'M',
  brandLogoNode = null,
  sections = [],
  activeId = '',
  onSelect = () => {},
  collapsed = false,
  onToggleCollapse = () => {},
  onQuickAction = null,
  quickActionLabel = 'Compose email',
  className = '',
}) {
  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200 ease-out lg:flex z-20 select-none',
        collapsed ? 'w-[64px]' : 'w-[232px]',
        className
      )}
    >
      {/* Brand Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-sidebar-border px-3.5">
        <div className="flex items-center gap-2.5 overflow-hidden">
          {brandLogoNode || (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground shadow-subtle">
              {brandLogoText}
            </div>
          )}
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold tracking-tight text-foreground truncate">{brandName}</span>
              <span className="text-[10px] font-medium text-muted-foreground truncate">{brandSubtitle}</span>
            </div>
          )}
        </div>
        {!collapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Collapse sidebar"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors cursor-pointer"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto py-2">
        <nav aria-label="Main navigation" className={cn('px-2.5 py-3', collapsed ? 'space-y-3' : 'space-y-5')}>
          {sections.map((section, sIdx) => (
            <div key={section.title || sIdx}>
              {collapsed ? (
                sIdx > 0 && <div className="mx-2 mb-3 h-px bg-sidebar-border" aria-hidden="true" />
              ) : (
                <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                  {section.title}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map(([label, id, Icon, count]) => {
                  const isActive = activeId === id;
                  const showCount = count !== undefined && count > 0;

                  return (
                    <button
                      key={id}
                      type="button"
                      title={collapsed ? label : undefined}
                      aria-label={collapsed ? label : undefined}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => onSelect(id)}
                      className={cn(
                        'group relative flex w-full min-h-[34px] items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 cursor-pointer text-left',
                        isActive
                          ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
                          : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
                        collapsed && 'justify-center px-0'
                      )}
                    >
                      {/* Active indicator rail */}
                      {isActive && (
                        <span
                          aria-hidden="true"
                          className="absolute -left-2.5 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-primary anim-fade-in"
                        />
                      )}
                      {Icon && (
                        <Icon
                          className={cn(
                            'h-4 w-4 shrink-0 transition-transform duration-200',
                            isActive
                              ? 'text-primary'
                              : 'text-muted-foreground group-hover:text-foreground group-hover:scale-110'
                          )}
                          aria-hidden="true"
                        />
                      )}
                      {!collapsed && <span className="flex-1 truncate">{label}</span>}
                      {!collapsed && showCount && (
                        <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold leading-none tabular-nums text-primary">
                          {count}
                        </span>
                      )}
                      {collapsed && showCount && (
                        <span
                          aria-hidden="true"
                          className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full bg-primary ring-2 ring-sidebar"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Footer controls when collapsed */}
      {collapsed && (
        <div className="border-t border-sidebar-border p-3">
          <div className="flex flex-col items-center gap-2">
            {onQuickAction && (
              <button
                type="button"
                onClick={onQuickAction}
                title={quickActionLabel}
                aria-label={quickActionLabel}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors hover:bg-primary/20 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label="Expand sidebar"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors cursor-pointer"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

export default Sidebar;
