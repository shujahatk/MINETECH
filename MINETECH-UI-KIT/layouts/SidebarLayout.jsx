'use client';

import React, { useState } from 'react';
import { Sidebar } from '../components/navigation/Sidebar';
import { cn } from '../utils/cn';

export function SidebarLayout({
  children,
  brandName = 'MineTech',
  brandSubtitle = 'Outbound CRM',
  brandLogoText = 'M',
  navSections = [],
  activeId = '',
  onSelectNav = () => {},
  className = '',
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={cn('flex min-h-screen bg-background text-foreground', className)}>
      <Sidebar
        brandName={brandName}
        brandSubtitle={brandSubtitle}
        brandLogoText={brandLogoText}
        sections={navSections}
        activeId={activeId}
        onSelect={onSelectNav}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
      />

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}

export default SidebarLayout;
