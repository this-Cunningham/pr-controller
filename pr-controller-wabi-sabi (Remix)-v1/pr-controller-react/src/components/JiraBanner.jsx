import { useState } from 'react';
import Button from './Button.jsx';

// JIRA-needed compliance banner. Pending → input + Set ticket.
// Linked → confirmation with the ticket key.
export default function JiraBanner({ prId, dash }) {
  const [value, setValue] = useState('');
  const state = dash.jiraState(prId);

  if (state?.status === 'set') {
    return (
      <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
        <div style={{ fontSize: 12.5, color: 'var(--auto-fg)', animation: 'appear .3s ease' }}>
          ✓ Linked to {state.value} — compliance check cleared.
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
      <div
        style={{
          background: 'var(--accent-soft)',
          border: '1px solid var(--accent-bg)',
          borderRadius: 5,
          padding: '13px 14px',
        }}
      >
        <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--accent)', fontSize: 12, lineHeight: 1.5 }}>◆</span>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--ink)' }}>
            This PR’s title is missing a ticket key — the compliance check failed. Add one to
            continue.
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 11 }}>
          <input
            className="input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="ABC-123"
            style={{
              font: "13px 'IBM Plex Mono', monospace",
              textTransform: 'uppercase',
              padding: '8px 11px',
              width: 140,
              border: '1px solid var(--line-2)',
              borderRadius: 5,
              background: 'var(--surface)',
              color: 'var(--ink)',
            }}
          />
          <Button variant="primary" onClick={() => dash.setTicket(prId, value)}>
            Set ticket
          </Button>
        </div>
      </div>
    </div>
  );
}
