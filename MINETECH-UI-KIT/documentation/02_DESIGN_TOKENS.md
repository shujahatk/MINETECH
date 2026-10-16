# MineTech Design Tokens & Color System

MineTech's visual identity combines high-contrast enterprise clarity with warm, organic materials inspired by mineral geology: rich terracotta clay, warm white porcelain, and deep neutral charcoal.

---

## 1. Surface Ladder Architecture

Unlike inverted dark modes, MineTech designs light and dark themes independently:

### Light Theme
- **Canvas / Background**: `hsl(30 18% 96%)` (`#F7F5F2` warm porcelain)
- **Cards & Surfaces**: `hsl(0 0% 100%)` (Pure white for maximum readability)
- **Sidebar & Wells**: `hsl(30 14% 94%)` (Warm stone tint)
- **Borders**: `hsl(30 10% 86%)`

### Dark Theme
- **Sidebar**: `hsl(20 8% 6.5%)` (`#121110` deep backdrop)
- **Canvas / Background**: `hsl(20 7% 8%)` (`#161413` charcoal)
- **Cards & Surfaces**: `hsl(20 6% 11%)` (`#1D1B1A` raised surface)
- **Popovers / Modals**: `hsl(20 6% 13.5%)` (`#232120` elevated layer)
- **Borders**: `hsl(20 5% 19%)` (`#313030`)

---

## 2. Brand Color Palette

| Token | CSS Variable | Hex Equivalent | Description |
|---|---|---|---|
| Primary Clay (Light) | `hsl(var(--primary))` | `#B43C1B` | Terracotta Brand Clay |
| Primary Clay (Dark) | `hsl(var(--primary))` | `#E06A42` | Luminous Glowing Terracotta |
| Terracotta | `colors.minetech.terracotta` | `#C84C27` | Medium clay accent |
| Ochre | `colors.minetech.ochre` | `#D97746` | Warm earth accent |
| Charcoal | `colors.minetech.charcoal` | `#161312` | Dark foundation |
| Warm White | `colors.minetech.warm-white`| `#F7F5F2` | Porcelain base |

---

## 3. Semantic Status Tones

Use these utility classes anywhere; they adapt automatically to light and dark:

- `.tone-success`: `border-success/25 bg-success/10 text-success` (Emerald green)
- `.tone-warning`: `border-warning/30 bg-warning/10 text-warning` (Warm amber)
- `.tone-info`: `border-info/25 bg-info/10 text-info` (Deep sky teal)
- `.tone-danger`: `border-danger/25 bg-danger/10 text-danger` (Ruby rose)
- `.tone-brand`: `border-primary/25 bg-primary/10 text-primary` (Terracotta clay)
- `.tone-neutral`: `border-border bg-muted/60 text-muted-foreground` (Neutral stone)

---

## 4. Elevation & Shadows

In dark mode, shadows receive higher opacity and a subtle 1px top highlight highlight:

- `--shadow-subtle`: Flat borders, buttons, pills
- `--shadow-card`: Enterprise data widgets and KPI tiles
- `--shadow-popover`: Dropdowns and search results
- `--shadow-dialog`: Center stage modal windows
- `--shadow-drawer`: Right-side slide-out panels

---

## 5. Animation Rules

- **Timing**: 140ms (fast) to 320ms (slow).
- **Easing**: `cubic-bezier(0.22, 1, 0.36, 1)` (snappy entry, gentle settle).
- **Scale**: Never exceed 0.98 -> 1.0 (no bouncy cartoon feel).
- **Reduced Motion**: Full support via `@media (prefers-reduced-motion: reduce)`.
