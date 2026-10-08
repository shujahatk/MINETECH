# 🌌 80/20 Outbound System — Master Design System

## 1. Design Philosophy & UI Tone

### The Aesthetic: *"Mission-Control / Enterprise Dark Glassmorphism"*
* **Vibe:** High-precision, high-throughput financial/sales terminal (Bloomberg meets Linear + Vercel).
* **Atmosphere:** Deep obsidian space canvas (`#090d16` / `#0a0c12`), ultra-subtle translucent card layers with `1px` borders, vivid cyan & indigo gradient accents, and live telemetry pulses.
* **Tone of Voice:**
  * **Direct & Authoritative:** *"Access Workspace"*, *"Launch Dispatch Queue"*, *"Real-time Telemetry"*, *"Idempotent Safeguard"*.
  * **Status-Aware:** Real-time pulsing dots (`animate-ping`) for active connections, mono timestamps for precision.
  * **Zero Clutter:** High data density without visual noise.

---

## 2. Color Palette & Tokens

### Canvas & Surfaces
| Token | Hex / Value | Purpose |
| :--- | :--- | :--- |
| **Canvas Background** | `#090d16` or `#0a0c12` | Main page background |
| **Card Surface** | `#121524` or `#121624` | Default card / section container |
| **Glass Panel** | `rgba(17, 25, 40, 0.65)` | Frosted glass modals / sidebars |
| **Subtle Border** | `rgba(255, 255, 255, 0.06)` | Standard card/divider border |
| **Focus / Active Border**| `rgba(255, 255, 255, 0.15)` | Hover state on containers |

### Primary Brand Accents
| Accent | Tailwind Classes | Purpose |
| :--- | :--- | :--- |
| **Cyan Glow** | `from-cyan-500 to-indigo-500` | Primary buttons, brand icons, active tabs |
| **Cyan Accent** | `#06b6d4` (`text-cyan-400`) | Key highlights, links, active borders |
| **Indigo Accent**| `#6366f1` (`text-indigo-400`) | Secondary brand accents, subtle gradient blends |

### Status Indicators
| Status | Background | Text | Border |
| :--- | :--- | :--- | :--- |
| **Active / Online** | `bg-emerald-500/10` | `text-emerald-400` | `border-emerald-500/30` |
| **Warning / Paused**| `bg-amber-500/10` | `text-amber-400` | `border-amber-500/30` |
| **Critical / Error** | `bg-rose-500/10` | `text-rose-400` | `border-rose-500/30` |
| **Neutral / Idle** | `bg-white/5` | `text-slate-400` | `border-white/10` |

---

## 3. Master CSS & Tailwind Configuration

### `tailwind.config.js`
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: 'var(--card)',
        'card-border': 'var(--card-border)',
        obsidian: {
          950: '#090d16',
          900: '#0a0c12',
          800: '#121524',
          700: '#121624',
        },
        surface: {
          50: '#1e293b',
          100: '#161f30',
          200: '#10131e',
          300: '#0d101a',
          card: '#121624',
          hover: '#181d30',
        },
        brand: {
          DEFAULT: '#6366f1',
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          cyan: '#06b6d4',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [require('daisyui')],
};
```

---

## 4. Core Component Blueprints

### 1. Ambient Background Glow Wrappers
```jsx
<div className="relative min-h-screen bg-[#090d16] text-slate-100 overflow-hidden">
  {/* Ambient Background Glows */}
  <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 blur-3xl rounded-full pointer-events-none" />
  <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-indigo-500/10 blur-3xl rounded-full pointer-events-none" />
  
  {/* Page Content */}
  <div className="relative z-10">{/* Children */}</div>
</div>
```

### 2. Primary Gradient Action Button
```jsx
<button
  className="py-3 px-6 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white font-semibold rounded-xl shadow-lg shadow-cyan-500/20 focus:outline-none transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
>
  <span>Access Workspace</span>
  <span className="text-lg">→</span>
</button>
```

### 3. Glass Metric / KPI Card
```jsx
<div className="bg-[#121624] border border-white/6 hover:border-white/15 rounded-2xl p-4 transition-all duration-200 shadow-lg shadow-black/20 flex flex-col justify-between">
  <div className="flex items-center justify-between">
    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
      CALLS CONNECTED
    </span>
    <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    </div>
  </div>

  <div className="mt-3">
    <div className="text-2xl font-black text-white tracking-tight">1,428</div>
    <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1 mt-1">
      <span>↑ 14.2%</span> <span className="text-slate-400 font-normal">vs yesterday</span>
    </div>
  </div>

  <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between">
    <span className="text-[10px] text-slate-600 font-mono">24h pace</span>
    <svg className="w-16 h-4 text-cyan-400" viewBox="0 0 60 15" fill="none">
      <path d="M0 12 L10 9 L20 11 L30 5 L40 7 L50 2 L60 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  </div>
</div>
```

### 4. Status Badges
```jsx
{/* Live Online Badge */}
<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-500/10">
  <span className="relative flex h-2 w-2">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
  </span>
  Connected (Live)
</span>
```
