const bar = (w, mt = 0) => ({
  height: 13,
  width: w,
  background: 'var(--surface-2)',
  borderRadius: 4,
  marginTop: mt,
  animation: 'shimmer 1.4s ease-in-out infinite',
});

const card = (opacity = 1) => ({
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 5,
  padding: 20,
  opacity,
});

export default function Skeleton() {
  return (
    <div style={{ marginTop: 30 }}>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: 'var(--ink-3)', marginBottom: 16 }}>
        Fetching your open pull requests…
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={card(1)}>
          <div style={bar(150)} />
          <div style={{ ...bar('62%', 13), height: 16 }} />
          <div style={{ ...bar('100%', 15), height: 46 }} />
        </div>
        <div style={card(0.8)}>
          <div style={bar(130)} />
          <div style={{ ...bar('48%', 13), height: 16 }} />
        </div>
        <div style={card(0.6)}>
          <div style={bar(140)} />
          <div style={{ ...bar('55%', 13), height: 16 }} />
        </div>
      </div>
    </div>
  );
}
