# MineTech Layouts & Dashboard Templates

The kit includes 4 reusable application layouts and 5 complete prebuilt dashboard templates.

---

## 1. Reusable Layouts

### `DashboardLayout`
Full enterprise application shell with collapsible desktop sidebar, top header, breadcrumb navigation, quick actions, notification bell, theme toggle, and responsive slide-out mobile drawer.

```jsx
import { DashboardLayout } from './MINETECH-UI-KIT';

export default function AppLayout({ children }) {
  return (
    <DashboardLayout
      brandName="RM AI Dialer"
      brandSubtitle="Enterprise Telephony"
      brandLogoText="RM"
      activeId="dialer"
      onSelectNav={(id) => navigate(`/${id}`)}
    >
      {children}
    </DashboardLayout>
  );
}
```

### `AuthLayout`
Centered authentication shell with brand crest, password visibility toggle, SSL encryption footer, and theme toggle.

```jsx
import { AuthLayout, Input, Button } from './MINETECH-UI-KIT';

export function LoginPage() {
  return (
    <AuthLayout brandName="RM Dialer" brandSuffix="Portal">
      <form className="space-y-4">
        <Input type="email" placeholder="agent@company.com" required />
        <Input type="password" placeholder="Password" required />
        <Button className="w-full">Sign In</Button>
      </form>
    </AuthLayout>
  );
}
```

### `WorkstationLayout`
3-Pane high-velocity sales cockpit:
- **Left Column**: Prioritized Queue / Call List
- **Center Column**: Active Prospect Intelligence / Dialer / Actions
- **Right Column**: Touchpoint History / Timeline / Notes

---

## 2. Prebuilt Dashboard Templates

### 1. `CRMDashboard`
- **Use Case**: Outbound sales, deal tracking, lead qualification.
- **Includes**: 4 KPI cards with sparklines, Deal Distribution Donut, Stage Progress BarList, Tabbed switch between DataTable and Drag & Drop Kanban board.

### 2. `AnalyticsDashboard`
- **Use Case**: Marketing, email deliverability, sales funnel analysis.
- **Includes**: Date Range selector, Outbound Funnel breakdown, Lead Warmth donut, Stage Conversion velocity table.

### 3. `AIDialerDashboard`
- **Use Case**: Cloud call center, AI predictive dialer, SDR workstation.
- **Includes**: Queue list with local time calculation, Live DialerPad with DTMF keypad & call timer, CallControls with disposition hotkeys (1-6), AI Insight Card for objection handling, and Touchpoint history.

### 4. `AdminPanel`
- **Use Case**: System health, infrastructure telemetry, user administration.
- **Includes**: PostgreSQL cluster telemetry, Email Gateway reputation cards, MINE-TECH AI status, Team member table with role badges, and Workstation sending configuration form.

### 5. `SaaSDashboard`
- **Use Case**: B2B SaaS platform, tenant management, subscription billing.
- **Includes**: MRR / ARR metrics, Churn rate, Plan distribution donut, API quota progress meters, and Active subscriptions table.
