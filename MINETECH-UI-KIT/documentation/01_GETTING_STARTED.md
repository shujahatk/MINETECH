# Getting Started with MineTech UI Kit

This guide walks you through integrating the **MineTech UI Kit** into your new or existing React, Next.js, or Vite application.

---

## 1. Installation & Dependencies

Ensure your project has the required peer dependencies installed:

```bash
npm install lucide-react class-variance-authority clsx tailwind-merge sonner
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-tabs @radix-ui/react-tooltip @radix-ui/react-checkbox @radix-ui/react-select @radix-ui/react-alert-dialog @radix-ui/react-progress @radix-ui/react-scroll-area @radix-ui/react-separator
```

For styling with Tailwind CSS:
```bash
npm install -D tailwindcss postcss autoprefixer
```

---

## 2. Tailwind CSS Configuration

Copy the MineTech design extensions into your `tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './MINETECH-UI-KIT/**/*.{js,jsx,ts,tsx}',
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
          hover: 'hsl(var(--primary-hover, var(--primary)) / <alpha-value>)',
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
      },
      borderRadius: {
        '2xl': '0.75rem',
        xl: '0.625rem',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        subtle: 'var(--shadow-subtle)',
        card: 'var(--shadow-card)',
        popover: 'var(--shadow-popover)',
        dialog: 'var(--shadow-dialog)',
        drawer: 'var(--shadow-drawer)',
        hover: 'var(--shadow-hover)',
      },
    },
  },
};
```

---

## 3. Global CSS & Fonts

Import the tokens and animations into your `globals.css`:

```css
@import 'MINETECH-UI-KIT/styles/globals.css';
```

Add Google Fonts in your `<head>` or HTML root:
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
  rel="stylesheet"
/>
```

---

## 4. Theme Provider Setup

Wrap your application root with `<ThemeProvider>`:

```jsx
import { ThemeProvider } from './MINETECH-UI-KIT/themes/ThemeProvider';

export default function App({ children }) {
  return (
    <ThemeProvider defaultTheme="system">
      {children}
    </ThemeProvider>
  );
}
```

---

## 5. Quick Usage Example

```jsx
import { MetricCard, DataTable, DonutChart } from './MINETECH-UI-KIT';

export function DashboardExample() {
  return (
    <div className="space-y-4">
      <MetricCard
        title="Total Pipeline Value"
        value="$1,482,000"
        delta="+14.2%"
        tone="brand"
        sparklineData={[20, 25, 30, 38, 45, 52]}
      />
    </div>
  );
}
```
