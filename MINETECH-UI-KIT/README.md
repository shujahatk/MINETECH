# MineTech UI Kit

A standalone, production-ready, highly polished Design System and Component Library extracted directly from **MineTech Outbound Workstation**.

Designed for high-performance enterprise applications, AI dialers, CRM platforms, analytics dashboards, and B2B SaaS products.

---

## Highlights

- **MineTech Visual Identity**: Terracotta clay brand accents, warm porcelain surfaces, and deep charcoal elevations.
- **Zero Production Backend Coupling**: No Supabase, Twilio, Resend, or Anthropic secrets. Fully driven by props, callbacks, and mock adapters.
- **Interactive Component Gallery**: Run the local interactive gallery to test every component, switch between Desktop/Tablet/Mobile viewports, and toggle Dark/Light themes.
- **5 Complete Prebuilt Dashboard Templates**:
  1. **CRM Dashboard** (KPIs, Donut chart, BarList, DataTable, Drag & Drop Kanban)
  2. **Analytics Dashboard** (Outbound Funnel, stage conversion table, date range filters)
  3. **AI Dialer Dashboard** (Predictive call queue, live DTMF keypad, call duration timer, disposition hotkeys 1-6, AI intelligence)
  4. **Admin Panel** (Database/Email/AI cloud telemetry cards, team access table, sending settings)
  5. **SaaS Dashboard** (ARR/MRR metrics, subscription tier breakdown, API quota progress meters)
- **4 Application Layouts**:
  - `DashboardLayout`: Collapsible desktop sidebar + top navigation + responsive mobile drawer.
  - `AuthLayout`: Centered brand login layout with SSL telemetry footer.
  - `SidebarLayout`: High-focus layout with full-height canvas.
  - `WorkstationLayout`: Signature 3-pane high-velocity sales cockpit.

---

## Directory Structure

```text
MINETECH-UI-KIT/
├── README.md
├── package.json
├── tailwind.config.js
├── postcss.config.js
├── vite.config.js
├── index.html
├── index.js                     <-- Main library entry point
│
├── components/
│   ├── buttons/                 <-- Button, ActionButton
│   ├── cards/                   <-- Card, MetricCard, SectionCard, AmbientCard
│   ├── charts/                  <-- DonutChart, BarList, ConversionFunnel
│   ├── navigation/              <-- Sidebar, TopNav, Breadcrumb, SegmentedControl
│   ├── tables/                  <-- DataTable, Table primitives
│   ├── forms/                   <-- Input, GlowInput, Textarea, Select, Checkbox
│   ├── modals/                  <-- ModalFrame, Dialog, AlertDialog, Sheet
│   ├── feedback/                <-- StatusBadge, TemperatureBadge, Badge, Skeletons
│   ├── kanban/                  <-- KanbanBoard (Drag & Drop)
│   ├── dialer/                  <-- DialerPad, CallControls
│   ├── ai/                      <-- AiInsightCard, AiDraftBar
│   └── common/                  <-- AnimatedNumber, PageHeader, Tabs, Progress, Tooltip
│
├── layouts/
│   ├── DashboardLayout.jsx
│   ├── AuthLayout.jsx
│   ├── SidebarLayout.jsx
│   └── WorkstationLayout.jsx
│
├── templates/
│   ├── CRM-Dashboard/
│   ├── Analytics-Dashboard/
│   ├── AI-Dialer-Dashboard/
│   ├── Admin-Panel/
│   └── SaaS-Dashboard/
│
├── themes/
│   ├── ThemeProvider.jsx
│   ├── ThemeToggle.jsx
│   └── theme-tokens.js
│
├── styles/
│   ├── globals.css
│   ├── minetech-tokens.css
│   └── animations.css
│
├── hooks/
│   ├── useMediaQuery.js
│   └── useAnimatedCounter.js
│
├── utils/
│   ├── cn.js
│   ├── format.js
│   └── mockData.js
│
├── preview/
│   ├── GalleryApp.jsx           <-- Full interactive component explorer
│   └── index.jsx                <-- Preview entry point
│
└── documentation/
    ├── 01_GETTING_STARTED.md
    ├── 02_DESIGN_TOKENS.md
    ├── 03_COMPONENT_CATALOG.md
    ├── 04_LAYOUTS_AND_TEMPLATES.md
    ├── 05_AI_DIALER_REUSE_GUIDE.md
    └── 06_ORIGINAL_TO_EXTRACTED_MAPPING.md
```

---

## Quickstart & Launching the Component Gallery

1. Navigate to the `MINETECH-UI-KIT` folder:
```bash
cd MINETECH-UI-KIT
```

2. Install dependencies:
```bash
npm install
```

3. Launch the interactive gallery locally:
```bash
npm run dev
```

The gallery will open locally (default port `http://localhost:3333`), allowing you to test:
- Light and dark themes
- Responsive viewports (Desktop, Tablet, Mobile)
- Live interactive components with live states
- Full dashboard templates

---

## How to Import into Future Projects

```jsx
import {
  MetricCard,
  DataTable,
  DonutChart,
  DialerPad,
  DashboardLayout,
  CRMDashboard,
} from './MINETECH-UI-KIT';
```

See [documentation/01_GETTING_STARTED.md](./documentation/01_GETTING_STARTED.md) for complete details.
