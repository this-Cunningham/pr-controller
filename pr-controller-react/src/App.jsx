import { useMemo } from 'react';
import { useDashboard } from './useDashboard.js';
import { makeController } from './controller.js';
import GrainOverlay from './components/GrainOverlay.jsx';
import Header from './components/Header.jsx';
import { Tabs } from './components/navigation/Tabs.jsx';
import { PRCard } from './components/pr/PRCard.jsx';
import { Skeleton } from './components/feedback/Skeleton.jsx';
import { EmptyState } from './components/feedback/EmptyState.jsx';
import { Toast } from './components/feedback/Toast.jsx';
import styles from './App.module.css';

const CAPTION = {
  needs: 'Resolve these before the agent continues.',
  progress: 'The agent is working on these — just glance.',
  waiting: 'Addressed — waiting on the reviewer.',
};
const EMPTY = {
  needs: 'Nothing needs you right now.',
  progress: 'Nothing in progress.',
  waiting: 'Nothing waiting on a reviewer.',
};

function Dashboard({ dash, controller }) {
  const lanes = dash.lanes;
  const active = lanes.find((s) => s.key === dash.tab) || lanes[0];
  const tabs = lanes.map((s) => ({
    key: s.key,
    label: s.title,
    count: s.prs.length,
    emphasize: s.key === 'needs',
  }));

  return (
    <>
      <Header dash={dash} />
      {dash.loading || !active ? (
        <Skeleton />
      ) : (
        <>
          <Tabs tabs={tabs} active={active.key} onChange={dash.setTab} />
          <div className={styles.caption}>
            {CAPTION[active.key]}
          </div>
          <div className={styles.cards}>
            {active.prs.length > 0 ? (
              active.prs.map(({ pr, items }) => (
                // The daemon already decided this PR belongs in this lane and which
                // items it shows here (server placements). The card is a pure
                // renderer of `items`. One PR can still appear in several lanes — as
                // distinct cards — so key by lane+PR to keep them distinct.
                <PRCard key={`${active.key}:${pr.id}`} pr={pr} lane={active.key} items={items} controller={controller} />
              ))
            ) : (
              <EmptyState label={EMPTY[active.key]} />
            )}
          </div>
        </>
      )}
    </>
  );
}

export default function App() {
  const dash = useDashboard();
  const controller = useMemo(() => makeController(dash), [dash]);

  return (
    <div className={styles.app}>
      <GrainOverlay />
      <div className={styles.column}>
        <Dashboard dash={dash} controller={controller} />
      </div>
      <Toast message={dash.toastMsg} />
    </div>
  );
}
