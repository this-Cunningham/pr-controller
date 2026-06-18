import { useState } from 'react';
import { useDashboard } from './useDashboard.js';
import { SECTIONS, sectionCaption, emptyLabel } from './data.js';
import GrainOverlay from './components/GrainOverlay.jsx';
import Header from './components/Header.jsx';
import SectionTabs from './components/SectionTabs.jsx';
import PRCard from './components/PRCard.jsx';
import Skeleton from './components/Skeleton.jsx';
import EmptyState from './components/EmptyState.jsx';
import Toast from './components/Toast.jsx';
import ComponentsGallery from './components/ComponentsGallery.jsx';

function ViewSwitcher({ view, setView }) {
  const seg = (key, label) => {
    const active = view === key;
    return active ? (
      <span
        key={key}
        style={{
          padding: '6px 15px',
          font: "500 13px 'Hanken Grotesk', sans-serif",
          background: 'var(--surface)',
          color: 'var(--ink)',
          borderRadius: 6,
          boxShadow: '0 1px 2px rgba(0,0,0,.05)',
        }}
      >
        {label}
      </span>
    ) : (
      <button
        key={key}
        type="button"
        className="switch-btn"
        onClick={() => setView(key)}
        style={{
          padding: '6px 15px',
          font: "500 13px 'Hanken Grotesk', sans-serif",
          background: 'none',
          border: 'none',
          color: 'var(--ink-2)',
          borderRadius: 6,
          cursor: 'pointer',
        }}
      >
        {label}
      </button>
    );
  };
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 22 }}>
      <div
        style={{
          display: 'inline-flex',
          background: 'var(--surface-2)',
          border: '1px solid var(--line)',
          borderRadius: 8,
          padding: 3,
          gap: 3,
        }}
      >
        {seg('dashboard', 'Dashboard')}
        {seg('components', 'Components')}
      </div>
    </div>
  );
}

function Dashboard({ dash }) {
  const tabs = SECTIONS.map((s) => ({
    key: s.key,
    label: s.title,
    count: s.prs.length,
    needs: s.key === 'needs',
  }));
  const active = SECTIONS.find((s) => s.key === dash.tab) || SECTIONS[0];

  return (
    <>
      <Header dash={dash} />
      {dash.loading ? (
        <Skeleton />
      ) : (
        <>
          <SectionTabs tabs={tabs} active={dash.tab} onSelect={dash.setTab} />
          <div style={{ marginTop: 34 }}>
            <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
              {sectionCaption(active.key, dash.mode)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
              {active.prs.length > 0 ? (
                active.prs.map((pr) => (
                  <PRCard key={pr.id} pr={pr} needsYou={active.needsYou} dash={dash} />
                ))
              ) : (
                <EmptyState label={emptyLabel(active.key)} />
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default function App() {
  const [view, setView] = useState('dashboard');
  const dash = useDashboard();

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: 'var(--bg)' }}>
      <GrainOverlay />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 900,
          margin: '0 auto',
          padding: '34px 28px 120px',
        }}
      >
        <ViewSwitcher view={view} setView={setView} />
        {view === 'dashboard' ? <Dashboard dash={dash} /> : <ComponentsGallery />}
      </div>
      <Toast message={dash.toastMsg} />
    </div>
  );
}
