const base = {
  cursor: 'pointer',
  font: "500 13px 'Hanken Grotesk', sans-serif",
  padding: '8px 14px',
  borderRadius: 5,
};

const variants = {
  primary: {
    className: 'btn-primary',
    style: { background: 'var(--ink)', color: 'var(--bg)', border: '1px solid var(--ink)' },
  },
  outline: {
    className: 'btn-outline',
    style: { background: 'transparent', color: 'var(--ink)', border: '1px solid var(--line-2)' },
  },
  ghost: {
    className: 'btn-ghost',
    style: { background: 'transparent', color: 'var(--ink-2)', border: '1px solid transparent' },
  },
};

export default function Button({ variant = 'primary', onClick, children }) {
  const v = variants[variant] || variants.primary;
  return (
    <button type="button" className={v.className} onClick={onClick} style={{ ...base, ...v.style }}>
      {children}
    </button>
  );
}
