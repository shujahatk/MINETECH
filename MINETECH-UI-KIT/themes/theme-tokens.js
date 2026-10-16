/**
 * MINETECH THEME CONSTANTS & JAVASCRIPT TOKENS
 * Can be imported into Tailwind configs, CSS-in-JS, or chart configs
 */

export const brandColors = {
  clay: '#B43C1B',
  clayDark: '#922E13',
  clayLight: '#DE643C',
  terracotta: '#C84C27',
  ochre: '#D97746',
  charcoal: '#161312',
  charcoalSurface: '#1E1A19',
  charcoalElevated: '#262220',
  warmWhite: '#F7F5F2',
  stone: '#DFDBD6',
  softSurface: '#ECE9E5',
};

export const chartPalette = [
  'hsl(var(--chart-1))', // clay #B43C1B
  'hsl(var(--chart-2))', // amber #D97746
  'hsl(var(--chart-3))', // deep teal
  'hsl(var(--chart-4))', // emerald
  'hsl(var(--chart-5))', // violet
  'hsl(var(--chart-6))', // stone
];

export const semanticTones = {
  success: {
    bg: 'bg-success/10',
    border: 'border-success/25',
    text: 'text-success',
  },
  warning: {
    bg: 'bg-warning/10',
    border: 'border-warning/30',
    text: 'text-warning',
  },
  info: {
    bg: 'bg-info/10',
    border: 'border-info/25',
    text: 'text-info',
  },
  danger: {
    bg: 'bg-danger/10',
    border: 'border-danger/25',
    text: 'text-danger',
  },
  brand: {
    bg: 'bg-primary/10',
    border: 'border-primary/25',
    text: 'text-primary',
  },
  neutral: {
    bg: 'bg-muted/60',
    border: 'border-border',
    text: 'text-muted-foreground',
  },
};

export const motion = {
  fast: '140ms',
  normal: '200ms',
  dialog: '220ms',
  slow: '320ms',
  ease: 'cubic-bezier(0.22, 1, 0.36, 1)',
};
