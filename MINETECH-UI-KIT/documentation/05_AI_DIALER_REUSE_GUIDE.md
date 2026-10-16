# Reusing MineTech UI in RM AI Dialer & Future SaaS Applications

This guide provides step-by-step instructions for implementing the extracted MineTech UI system directly into **RM AI Dialer**, CRM systems, and call-center platforms.

---

## 1. Why MineTech UI Fits RM AI Dialer Perfectly

MineTech's UI was engineered specifically for high-velocity outbound sales and communications:
1. **WorkstationLayout (3-Pane Architecture)**: Allows agents to cycle through lead queues without ever changing pages or losing focus.
2. **Keyboard-Driven Dispositions (Hotkeys 1-6)**: Agents log outcomes in under a second using number keys.
3. **Pulsing Status Badges**: Visual indicators for ringing, initiating, connected, and completed calls.
4. **Lightweight SVG Visualizations**: Instant rendering with zero JS lag during high-frequency calling.
5. **Dark Mode by Default**: Tailored for all-day operational stamina with deep warm charcoal surfaces.

---

## 2. Implementing the AI Dialer Workstation

Here is how to wire the extracted components to your telephony backend (e.g. Twilio, LiveKit, Vapi, or Asterisk):

```jsx
import React, { useState } from 'react';
import {
  WorkstationLayout,
  DialerPad,
  CallControls,
  AiInsightCard,
  TemperatureBadge,
  StatusBadge,
} from './MINETECH-UI-KIT';

export function RMAIDialerScreen() {
  const [activeLead, setActiveLead] = useState({
    id: 'lead-1',
    name: 'Marcus Vance',
    phone: '+1 (415) 890-2134',
    company: 'Apex Industries',
    score: 94,
    temperature: 'HOT',
  });

  const handleCallState = (state) => {
    // Connect to your WebRTC / SIP device here
    console.log('Dialer state transitioned to:', state);
  };

  const handleSaveDisposition = ({ disposition, notes }) => {
    // Send disposition to your backend API
    fetch('/api/dialer/disposition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId: activeLead.id, disposition, notes }),
    });
  };

  return (
    <WorkstationLayout
      leftPane={
        <div className="p-3">
          <h4 className="text-xs font-semibold mb-2">Outbound Call Queue</h4>
          {/* Map through pending leads */}
        </div>
      }
      centerPane={
        <div className="space-y-3">
          <AiInsightCard
            title="Real-Time Call Intel"
            fitScore={activeLead.score}
            priority={activeLead.temperature}
            summary="Prospect expressed interest in trial batch last Thursday."
            recommendedAction="Confirm delivery address and trial volume"
          />
          <div className="grid grid-cols-2 gap-3">
            <DialerPad
              initialNumber={activeLead.phone}
              contactName={activeLead.name}
              contactCompany={activeLead.company}
              onCallStateChange={handleCallState}
            />
            <CallControls onSaveDisposition={handleSaveDisposition} />
          </div>
        </div>
      }
      rightPane={
        <div className="p-3">
          <h4 className="text-xs font-semibold mb-2">Call Recording & Transcript</h4>
          {/* Audio player & live transcript stream */}
        </div>
      }
    />
  );
}
```

---

## 3. Customizing Branding & Colors

If RM AI Dialer needs a different accent color (for example, Electric Cobalt Blue or Emerald Green instead of Terracotta Clay):

In your project's CSS:
```css
:root {
  /* Change Brand Primary to Blue or your desired brand color */
  --primary: 217 91% 60%;
  --ring: 217 91% 60%;
}

.dark {
  --primary: 217 91% 65%;
  --ring: 217 91% 65%;
}
```
All components—buttons, active indicator rails, sparklines, badges, and progress bars—automatically update!
