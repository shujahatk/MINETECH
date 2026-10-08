'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Monitor, Check } from 'lucide-react';
import { useTheme } from '@/components/theme/ThemeProvider';

export default function ThemeToggle({ showLabel = false, align = 'right' }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const options = [
    { key: 'light', label: 'Light', icon: Sun },
    { key: 'dark', label: 'Dark', icon: Moon },
    { key: 'system', label: 'System', icon: Monitor },
  ];

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle theme mode"
        aria-expanded={isOpen}
        className="flex h-8 items-center gap-1.5 px-2 rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-colors duration-100 shadow-subtle focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
      >
        {resolvedTheme === 'dark' ? (
          <Moon className="h-4 w-4 text-primary transition-transform duration-200" />
        ) : (
          <Sun className="h-4 w-4 text-primary transition-transform duration-200" />
        )}
        {showLabel && (
          <span className="text-xs font-medium capitalize hidden sm:inline">
            {theme}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="menu"
          className={`absolute ${
            align === 'left' ? 'left-0' : 'right-0'
          } mt-1.5 w-36 origin-top-right rounded-lg border border-border bg-popover p-1 shadow-popover z-50 text-popover-foreground animate-in fade-in zoom-in-95 duration-150`}
        >
          {options.map((opt) => {
            const Icon = opt.icon;
            const isSelected = theme === opt.key;
            return (
              <button
                key={opt.key}
                role="menuitem"
                onClick={() => {
                  setTheme(opt.key);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors duration-100 ${
                  isSelected
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-foreground hover:bg-muted'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5" />
                  <span>{opt.label}</span>
                </div>
                {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
