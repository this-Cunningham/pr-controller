const mono = "'IBM Plex Mono', monospace";

// Sticky tab strip. `tabs` = [{ key, label, count, needs }]
export default function SectionTabs({ tabs, active, onSelect }) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        background: 'var(--bg)',
        display: 'flex',
        flexWrap: 'wrap',
        borderBottom: '1px solid var(--line)',
        marginTop: 6,
        paddingTop: 8,
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        const accentChip = tab.needs && tab.count > 0;
        return (
          <button
            key={tab.key}
            type="button"
            className="tab"
            onClick={() => onSelect(tab.key)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '14px 0',
              marginRight: 26,
              marginBottom: -1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              font: "600 14.5px 'Hanken Grotesk', sans-serif",
              color: isActive ? 'var(--ink)' : 'var(--ink-2)',
              borderBottom: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
            }}
          >
            {tab.label}
            <span
              style={{
                font: `500 11.5px ${mono}`,
                padding: '1px 8px',
                borderRadius: 10,
                background: accentChip ? 'var(--accent-bg)' : 'var(--surface-2)',
                color: accentChip ? 'var(--accent)' : 'var(--ink-2)',
              }}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
