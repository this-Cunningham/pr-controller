import { useDashboard } from './useDashboard.js';
import { sectionCaption, emptyLabel } from './data.js';
import GrainOverlay from './components/GrainOverlay.jsx';
import Header from './components/Header.jsx';
import SectionTabs from './components/SectionTabs.jsx';
import PRCard from './components/PRCard.jsx';
import Skeleton from './components/Skeleton.jsx';
import EmptyState from './components/EmptyState.jsx';
import Toast from './components/Toast.jsx';

function Dashboard({ dash }) {
  const sections = dash.sections;
  const tabs = sections.map((s) => ({
    key: s.key,
    label: s.title,
    count: s.prs.length,
    needs: s.key === 'needs',
  }));
  const active = sections.find((s) => s.key === dash.tab) || sections[0];

  return (
    <>
      <Header dash={dash} />
      {dash.loading || !active ? (
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
        <Dashboard dash={dash} />
      </div>
      <Toast message={dash.toastMsg} />
    </div>
  );
}
