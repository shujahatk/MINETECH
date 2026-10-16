# MineTech Component Catalog & API Reference

Every component in the MineTech UI Kit is decoupled from backend dependencies and customizable via props.

---

## 1. MetricCard
Live KPI metric tile with SVG sparkline, count-up animation, trend delta chip, and semantic icon tone.

### Props:
- `title` *(string, required)*: Label of the KPI (e.g. "Total Pipeline Value")
- `value` *(number | string, required)*: Formatted string or raw number (counts up smoothly)
- `delta` *(string)*: Short badge text (e.g. "+14.2%", "Zero bounces")
- `deltaType` *('positive' | 'negative' | 'neutral')*: Chip coloring
- `subtext` *(string)*: Small footer caption
- `tone` *('brand' | 'success' | 'warning' | 'info' | 'danger' | 'neutral')*: Color of icon tile
- `icon` *(ReactNode)*: Lucide icon component
- `sparklineData` *(number[])*: Array of numeric data points for trend curve
- `href` *(string)*: Makes entire card clickable link with hover lift and corner arrow
- `onClick` *(function)*: Click callback

```jsx
<MetricCard
  title="Active Prospects"
  value={1248}
  delta="+86 new"
  tone="info"
  sparklineData={[40, 42, 45, 50, 58, 64]}
/>
```

---

## 2. DonutChart
Lightweight SVG Donut Chart with zero charting library dependencies.

### Props:
- `data` *(Array<{ key, label, value, color }>)*: Segments array
- `size` *(number)*: Diameter in pixels (default: 176)
- `thickness` *(number)*: Ring width (default: 18)
- `centerLabel` *(string)*: Caption beneath center number (default: 'Total')
- `centerValue` *(string | number)*: Value shown in hole (defaults to sum of values)
- `legend` *(boolean)*: Renders interactive legend list (default: true)
- `onSegmentClick` *(function)*: Click callback when segment or legend is clicked

```jsx
<DonutChart
  data={[
    { key: 'new', label: 'New', value: 412, color: 'hsl(var(--chart-6))' },
    { key: 'contacted', label: 'Contacted', value: 328, color: 'hsl(var(--chart-3))' },
  ]}
  centerLabel="Total Leads"
/>
```

---

## 3. BarList
Ranked horizontal bars with animated CSS meters and percentage indicators.

### Props:
- `items` *(Array<{ key, label, value, color?, hint? }>)*: Items to rank
- `max` *(number)*: Max ceiling (defaults to highest value in array)
- `showPercentOfMax` *(boolean)*: Displays percentage badge next to value
- `onItemClick` *(function)*: Click callback on row

```jsx
<BarList
  items={[
    { key: 'hot', label: 'Hot Leads', value: 94, color: 'hsl(var(--chart-1))' },
    { key: 'warm', label: 'Warm Leads', value: 68, color: 'hsl(var(--chart-2))' },
  ]}
  showPercentOfMax
/>
```

---

## 4. DataTable
Full enterprise table with multi-select checkboxes, sort headers, filter selectors, pagination, and bulk actions.

### Props:
- `columns` *(Array<{ key, label, sortable?, render?, className?, cellClassName? }>)*
- `data` *(Array<object>)*
- `onRowClick` *(function)*: Row selection / drawer trigger
- `searchPlaceholder` *(string)*: Placeholder text in search box

```jsx
<DataTable
  columns={[
    { key: 'company', label: 'Account' },
    { key: 'temperature', label: 'Warmth' },
    { key: 'status', label: 'Stage' },
    { key: 'dealValue', label: 'Est. Value', render: (v) => `$${v.toLocaleString()}` }
  ]}
  data={leads}
  onRowClick={(lead) => setSelectedLead(lead)}
/>
```

---

## 5. StatusBadge & TemperatureBadge
Status indicator chips with animated pulsing ping dot.

```jsx
<StatusBadge status="approved_supplier" />
<StatusBadge status="ringing" pulse />
<TemperatureBadge temperature="HOT" score={98} showScore />
```

---

## 6. DialerPad & CallControls
Complete phone dialer with DTMF keypad, call duration timer, and disposition hotkeys.

```jsx
<DialerPad
  initialNumber="+1 (415) 890-2134"
  contactName="Marcus Vance"
  onCallEnded={({ duration }) => console.log('Call duration:', duration)}
/>
<CallControls
  onSaveDisposition={({ disposition, notes }) => console.log(disposition, notes)}
/>
```

---

## 7. AiInsightCard & AiDraftBar
MINE-TECH AI intelligence recommendation tile and composer assistant bar.

```jsx
<AiInsightCard
  title="AI Opportunity Intelligence"
  fitScore={94}
  priority="HOT"
  summary="High-fit prospect detected."
  recommendedAction="Send commercial volume pricing proposal"
  onApplyAction={() => handleApply()}
/>
```
