export default function Toast({ message }) {
  if (!message) return null;
  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 28,
        transform: 'translateX(-50%)',
        background: 'var(--ink)',
        color: 'var(--bg)',
        fontSize: 13,
        padding: '11px 17px',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        boxShadow: '0 8px 24px rgba(0,0,0,.18)',
        animation: 'fadeup .28s ease',
        zIndex: 50,
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />
      {message}
    </div>
  );
}
