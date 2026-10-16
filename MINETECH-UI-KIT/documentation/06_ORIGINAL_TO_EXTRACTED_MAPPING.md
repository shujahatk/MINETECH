# Original-to-Extracted Component Mapping

This table maps every original MineTech application file to its corresponding extracted component in the `MINETECH-UI-KIT` library.

---

| Category | Original MineTech Source Path | Extracted Library Component | Decoupled Enhancements |
|---|---|---|---|
| **Buttons** | `components/ui/button.jsx` | `components/buttons/Button.jsx` | Removed Next.js routing coupling, active press animation preserved |
| **Buttons** | `components/ui/ActionButton.jsx` | `components/buttons/ActionButton.jsx` | Standalone icon action button with size props |
| **Cards** | `components/ui/MetricCard.jsx` | `components/cards/MetricCard.jsx` | Configurable AnimatedNumber, sparkline SVG, tone chips, click/href props |
| **Cards** | `components/ui/section-card.jsx` | `components/cards/SectionCard.jsx` | Header/action slots, flush table padding toggle |
| **Cards** | `components/ui/card.jsx` | `components/cards/Card.jsx` | Card, CardHeader, CardTitle, CardContent primitives |
| **Cards** | `components/ui/AmbientBackground.jsx` | `components/cards/AmbientCard.jsx` | Atmospheric blurred gradient container |
| **Charts** | `components/charts/DonutChart.jsx` | `components/charts/DonutChart.jsx` | Zero-dependency SVG donut, CSS arc transition, legend |
| **Charts** | `components/charts/BarList.jsx` | `components/charts/BarList.jsx` | Animated horizontal ranked meters with percentage calculation |
| **Charts** | `components/analytics/AnalyticsView.jsx` | `components/charts/ConversionFunnel.jsx` | Extracted standalone conversion funnel visualizer |
| **Tables** | `components/leads/LeadTable.jsx` | `components/tables/DataTable.jsx` | Decoupled from Supabase endpoints; props for columns, data, sorting, bulk actions |
| **Tables** | `components/ui/table.jsx` | `components/tables/Table.jsx` | Table, TableHeader, TableBody, TableHead, TableRow, TableCell |
| **Forms** | `components/ui/input.jsx` | `components/forms/Input.jsx` | Standard styled input |
| **Forms** | `components/ui/GlowInput.jsx` | `components/forms/GlowInput.jsx` | Input with left icon and optional right clear/action icon |
| **Forms** | `components/ui/textarea.jsx` | `components/forms/Textarea.jsx` | Resizable styled textarea |
| **Forms** | `components/ui/select.jsx` | `components/forms/Select.jsx` | Radix Select primitives with custom trigger and popover |
| **Forms** | `components/ui/checkbox.jsx` | `components/forms/Checkbox.jsx` | Radix Checkbox with check icon |
| **Modals** | `components/ui/modal-frame.jsx` | `components/modals/ModalFrame.jsx` | Accessible modal frame with scrim backdrop & drawer option |
| **Modals** | `components/ui/dialog.jsx` | `components/modals/Dialog.jsx` | Radix Dialog primitives |
| **Modals** | `components/ui/alert-dialog.jsx` | `components/modals/AlertDialog.jsx` | Radix Alert Dialog for confirmations |
| **Modals** | `components/ui/sheet.jsx` | `components/modals/Sheet.jsx` | Side-sheet drawer primitives |
| **Feedback** | `components/ui/StatusBadge.jsx` | `components/feedback/StatusBadge.jsx` | Comprehensive status matching + pulsing ping animation |
| **Feedback** | `components/leads/TemperatureBadge.jsx` | `components/feedback/TemperatureBadge.jsx` | HOT, WARM, COLD chips with numeric score pill |
| **Feedback** | `components/ui/badge.jsx` | `components/feedback/Badge.jsx` | Semantic variant tags |
| **Feedback** | `components/ui/loading-state.jsx` | `components/feedback/LoadingState.jsx` | Card skeletons, list row skeletons, table row skeletons |
| **Feedback** | `components/ui/empty-state.jsx` | `components/feedback/EmptyState.jsx` | Centered icon, title, description, and action button |
| **Feedback** | `components/ui/error-state.jsx` | `components/feedback/ErrorState.jsx` | Destructive banner with retry callback |
| **Kanban** | `components/leads/PipelineKanban.jsx` | `components/kanban/KanbanBoard.jsx` | Drag-and-drop board with stage totals and card details |
| **Dialer** | `components/twilio/DialerModal.jsx` | `components/dialer/DialerPad.jsx` | Decoupled DTMF keypad, call duration timer, live states |
| **Dialer** | `components/workstation/SalesCockpit.jsx` | `components/dialer/CallControls.jsx` | Disposition buttons (1-6 hotkeys) and notes box |
| **AI** | `components/ai/LeadAiBrain.jsx` | `components/ai/AiInsightCard.jsx` | Recommendation card, reasoning bullets, action trigger |
| **AI** | `components/ai/AiDraftBar.jsx` | `components/ai/AiDraftBar.jsx` | Prompt tone selector and insert draft action bar |
| **Navigation** | `components/layout/AppShell.jsx` (Sidebar) | `components/navigation/Sidebar.jsx` | Collapsible sidebar, grouped items, active indicator rail |
| **Navigation** | `components/layout/AppShell.jsx` (Header) | `components/navigation/TopNav.jsx` | Breadcrumbs, search pill with `/`, theme toggle, notifications |
| **Navigation** | `components/ui/SegmentedControl.jsx` | `components/navigation/SegmentedControl.jsx` | Segmented pill switcher |
| **Theme** | `components/theme/ThemeProvider.jsx` | `themes/ThemeProvider.jsx` | SSR-safe theme context (light, dark, system) |
| **Theme** | `components/theme/ThemeToggle.jsx` | `themes/ThemeToggle.jsx` | Sun/Moon/Monitor dropdown switcher |
| **Layouts** | `components/layout/AppShell.jsx` | `layouts/DashboardLayout.jsx` | Full application shell with mobile drawer and desktop sidebar |
| **Layouts** | `app/login/page.jsx` | `layouts/AuthLayout.jsx` | Centered login/signup layout with brand crest and SSL footer |
| **Layouts** | `components/workstation/SalesCockpit.jsx` | `layouts/WorkstationLayout.jsx` | 3-pane high-velocity sales cockpit layout |
| **Templates** | `components/dashboard/PersonalDashboard.jsx` | `templates/CRM-Dashboard/CRMDashboard.jsx` | Full CRM dashboard with KPIs, Donut, BarList, Table, Kanban |
| **Templates** | `components/analytics/AnalyticsView.jsx` | `templates/Analytics-Dashboard/AnalyticsDashboard.jsx` | Deep analytics with conversion funnel and stage velocity |
| **Templates** | `components/workstation/SalesCockpit.jsx` | `templates/AI-Dialer-Dashboard/AIDialerDashboard.jsx` | Complete predictive dialer workstation |
| **Templates** | `app/command-center/page.jsx` | `templates/Admin-Panel/AdminPanel.jsx` | Infrastructure telemetry and admin settings |
| **Templates** | Composite SaaS patterns | `templates/SaaS-Dashboard/SaaSDashboard.jsx` | MRR metrics, subscriptions table, API quota progress |
