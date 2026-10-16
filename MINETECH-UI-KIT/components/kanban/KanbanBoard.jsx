'use client';

import React, { useState } from 'react';
import {
  Clock,
  Calendar,
  Building,
  User,
  AlertTriangle,
  ArrowRight,
  MoreVertical,
  Plus,
} from 'lucide-react';
import { StatusBadge } from '../feedback/StatusBadge';
import { TemperatureBadge } from '../feedback/TemperatureBadge';
import { Button } from '../buttons/Button';
import { cn } from '../../utils/cn';

export const DEFAULT_KANBAN_STAGES = [
  { id: 'NEW', title: '1. New Lead', color: 'border-t-primary/70' },
  { id: 'CONTACTED', title: '2. Contacted', color: 'border-t-muted-foreground/60' },
  { id: 'ENGAGED', title: '3. Engaged', color: 'border-t-primary/80' },
  { id: 'TECHNICAL_EVALUATION', title: '4. Tech Evaluation', color: 'border-t-primary' },
  { id: 'COMMERCIAL_DISCUSSION', title: '5. Commercial', color: 'border-t-amber-500' },
  { id: 'TRIAL_ORDER', title: '6. Trial Order', color: 'border-t-primary' },
  { id: 'APPROVED_SUPPLIER', title: '7. Approved Supplier', color: 'border-t-emerald-500' },
  { id: 'RECURRING_CUSTOMER', title: '8. Recurring Customer', color: 'border-t-emerald-600' },
];

export function KanbanBoard({
  stages = DEFAULT_KANBAN_STAGES,
  items = [],
  onItemClick = null,
  onStageChange = null,
  className = '',
}) {
  const [boardItems, setBoardItems] = useState(items);
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);

  // Sync with prop changes if items change externally
  React.useEffect(() => {
    setBoardItems(items);
  }, [items]);

  const handleDragStart = (id, e) => {
    setDraggedId(id);
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDrop = (stageId, e) => {
    e.preventDefault();
    setDragOverStage(null);
    const id = e.dataTransfer.getData('text/plain') || draggedId;
    if (!id) return;

    setBoardItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: stageId } : item))
    );

    if (onStageChange) {
      onStageChange(id, stageId);
    }
    setDraggedId(null);
  };

  return (
    <div className={cn('flex gap-3 overflow-x-auto pb-4 pt-1 select-none', className)}>
      {stages.map((stage) => {
        const stageItems = boardItems.filter((i) => i.status === stage.id);
        const isTargeted = dragOverStage === stage.id;
        const totalValue = stageItems.reduce((acc, curr) => acc + (curr.dealValue || 0), 0);

        return (
          <div
            key={stage.id}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverStage(stage.id);
            }}
            onDragLeave={() => setDragOverStage(null)}
            onDrop={(e) => handleDrop(stage.id, e)}
            className={cn(
              'flex flex-col w-72 shrink-0 rounded-xl border bg-muted/20 transition-all duration-150',
              stage.color,
              'border-t-2',
              isTargeted ? 'border-primary/60 bg-primary/5 ring-2 ring-primary/20' : 'border-border'
            )}
          >
            {/* Stage Header */}
            <div className="p-3 border-b border-border/70 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-foreground tracking-tight">{stage.title}</h3>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {stageItems.length} {stageItems.length === 1 ? 'deal' : 'deals'}
                  {totalValue > 0 && ` · $${(totalValue / 1000).toFixed(0)}k`}
                </span>
              </div>
              <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-muted/60 px-1.5 text-[10px] font-semibold text-muted-foreground">
                {stageItems.length}
              </span>
            </div>

            {/* Droppable Column Items */}
            <div className="p-2 space-y-2 flex-1 min-h-[420px] max-h-[calc(100vh-280px)] overflow-y-auto">
              {stageItems.map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(item.id, e)}
                  onClick={() => onItemClick && onItemClick(item)}
                  className="group relative rounded-lg border border-border bg-card p-3 shadow-subtle hover:border-primary/40 hover:shadow-card transition-all duration-150 cursor-grab active:cursor-grabbing"
                >
                  {/* Top: Company & Warmth */}
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-xs text-foreground truncate group-hover:text-primary transition-colors">
                      {item.company}
                    </span>
                    {item.temperature && (
                      <TemperatureBadge temperature={item.temperature} score={item.score} showScore />
                    )}
                  </div>

                  {/* Contact Person */}
                  {item.contactPerson && (
                    <p className="mt-1 text-[11px] text-muted-foreground truncate flex items-center gap-1">
                      <User className="h-3 w-3 shrink-0" />
                      <span>{item.contactPerson}</span>
                      {item.title && <span className="text-muted-foreground/60 truncate">· {item.title}</span>}
                    </p>
                  )}

                  {/* Value & Product */}
                  <div className="mt-2.5 flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-foreground tabular-nums">
                      {item.dealValue ? `$${Number(item.dealValue).toLocaleString()}` : '—'}
                    </span>
                    {item.product && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground truncate max-w-[110px]">
                        {item.product}
                      </span>
                    )}
                  </div>

                  {/* Next Action Pill */}
                  {item.nextAction && (
                    <div className="mt-2 pt-2 border-t border-border/60 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3 text-primary shrink-0" />
                      <span className="truncate">{item.nextAction}</span>
                    </div>
                  )}
                </div>
              ))}

              {stageItems.length === 0 && (
                <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border/70 text-center p-3">
                  <span className="text-[11px] text-muted-foreground/60">Drag deals here</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default KanbanBoard;
