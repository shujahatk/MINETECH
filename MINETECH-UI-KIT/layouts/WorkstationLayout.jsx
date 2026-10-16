'use client';

import React from 'react';
import { cn } from '../utils/cn';

/**
 * 3-Column Workstation Layout extracted from SalesCockpit
 *  - leftPane: Queue / Prospect list (e.g., width 300px-340px)
 *  - centerPane: Active Intelligence / Working Canvas / Call Controls
 *  - rightPane: Timeline / History / Activity Stream (e.g., width 320px-360px)
 */
export function WorkstationLayout({
  header = null,
  leftPane,
  centerPane,
  rightPane,
  className = '',
}) {
  return (
    <div className={cn('flex flex-col h-[calc(100vh-4.5rem)] space-y-3', className)}>
      {header && <div className="shrink-0">{header}</div>}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0 overflow-hidden">
        {/* Left Column: Priority Queue / Contacts */}
        <div className="lg:col-span-3 flex flex-col h-full min-h-0 overflow-hidden rounded-xl border border-border bg-card shadow-card">
          {leftPane}
        </div>

        {/* Center Column: Intelligence, Call Controls, Active Work */}
        <div className="lg:col-span-6 flex flex-col h-full min-h-0 overflow-y-auto space-y-3 pr-1">
          {centerPane}
        </div>

        {/* Right Column: Timeline, History, Metadata */}
        <div className="lg:col-span-3 flex flex-col h-full min-h-0 overflow-hidden rounded-xl border border-border bg-card shadow-card">
          {rightPane}
        </div>
      </div>
    </div>
  );
}

export default WorkstationLayout;
