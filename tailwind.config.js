const plugin = require('tailwindcss/plugin');

/**
 * Tiny, dependency-free replacement for `tailwindcss-animate`.
 * The shared UI primitives (dropdown, select, tooltip, sheet) already use these class names
 * (`animate-in`, `fade-in-0`, `zoom-in-95`, `slide-in-from-*`) but nothing ever defined them, so those
 * transitions silently never ran. Only the classes actually used are emitted by Tailwind's JIT.
 */
const enterExitAnimations = plugin(({ addUtilities }) => {
  const utilities = {
    '.animate-in': {
      animationName: 'enter',
      animationDuration: '150ms',
      animationTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
      animationFillMode: 'backwards',
    },
    '.animate-out': {
      animationName: 'exit',
      animationDuration: '120ms',
      animationTimingFunction: 'ease-in',
      animationFillMode: 'forwards',
    },
    '.fade-in-0': { '--tw-enter-opacity': '0' },
    '.fade-out-0': { '--tw-exit-opacity': '0' },
    '.zoom-in-95': { '--tw-enter-scale': '0.95' },
    '.zoom-out-95': { '--tw-exit-scale': '0.95' },
  };

  // [name, axis, sign] — "from top" starts above (negative Y), "from left" starts to the left (negative X).
  const directions = [
    ['top', 'y', '-'],
    ['bottom', 'y', ''],
    ['left', 'x', '-'],
    ['right', 'x', ''],
  ];
  directions.forEach(([name, axis, sign]) => {
    [['', '100%'], ['-2', '0.5rem']].forEach(([suffix, amount]) => {
      utilities[`.slide-in-from-${name}${suffix}`] = { [`--tw-enter-translate-${axis}`]: `${sign}${amount}` };
      utilities[`.slide-out-to-${name}${suffix}`] = { [`--tw-exit-translate-${axis}`]: `${sign}${amount}` };
    });
  });

  addUtilities(utilities);
});

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Semantic status colours: one class works in both themes (`text-success`, `bg-warning/10` ...)
        success: 'hsl(var(--success) / <alpha-value>)',
        warning: 'hsl(var(--warning) / <alpha-value>)',
        info: 'hsl(var(--info) / <alpha-value>)',
        danger: 'hsl(var(--danger) / <alpha-value>)',
        chart: {
          1: 'hsl(var(--chart-1) / <alpha-value>)',
          2: 'hsl(var(--chart-2) / <alpha-value>)',
          3: 'hsl(var(--chart-3) / <alpha-value>)',
          4: 'hsl(var(--chart-4) / <alpha-value>)',
          5: 'hsl(var(--chart-5) / <alpha-value>)',
          6: 'hsl(var(--chart-6) / <alpha-value>)',
          track: 'hsl(var(--chart-track))',
          grid: 'hsl(var(--chart-grid))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
        'card-border': 'hsl(var(--border))',
        minetech: {
          clay: '#B43C1B',
          'clay-dark': '#922E13',
          'clay-light': '#DE643C',
          terracotta: '#C84C27',
          ochre: '#D97746',
          charcoal: '#161312',
          'charcoal-surface': '#1E1A19',
          'charcoal-elevated': '#262220',
          'warm-white': '#F7F5F2',
          stone: '#DFDBD6',
          'soft-surface': '#ECE9E5',
        },
        brand: {
          DEFAULT: '#B43C1B',
          50: '#FDF6F3',
          100: '#FCEFEA',
          200: '#F7D6CC',
          500: '#B43C1B',
          600: '#922E13',
          700: '#75210B',
        },
      },
      // Tighter radius scale (enterprise look): cards/panels = xl, controls = lg, chips = md.
      borderRadius: {
        '2xl': '0.75rem',
        xl: '0.625rem',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Consolas', 'monospace'],
      },
      // Shadows come from CSS variables so dark mode gets its own (heavier, edge-lit) elevation.
      boxShadow: {
        subtle: 'var(--shadow-subtle)',
        card: 'var(--shadow-card)',
        popover: 'var(--shadow-popover)',
        dialog: 'var(--shadow-dialog)',
        drawer: 'var(--shadow-drawer)',
        hover: 'var(--shadow-hover)',
      },
      keyframes: {
        enter: {
          from: {
            opacity: 'var(--tw-enter-opacity, 1)',
            transform:
              'translate3d(var(--tw-enter-translate-x, 0), var(--tw-enter-translate-y, 0), 0) scale3d(var(--tw-enter-scale, 1), var(--tw-enter-scale, 1), var(--tw-enter-scale, 1))',
          },
        },
        exit: {
          to: {
            opacity: 'var(--tw-exit-opacity, 1)',
            transform:
              'translate3d(var(--tw-exit-translate-x, 0), var(--tw-exit-translate-y, 0), 0) scale3d(var(--tw-exit-scale, 1), var(--tw-exit-scale, 1), var(--tw-exit-scale, 1))',
          },
        },
      },
    },
  },
  plugins: [enterExitAnimations],
};
