import { useDashboard } from './useDashboard.js';
import { cardProps, threadProps } from './cardProps.js';
import GrainOverlay from './GrainOverlay.jsx';
import Header from './Header.jsx';
import { Tabs } from '../../design-system/navigation/Tabs.jsx';
import { PRCard } from './PRCard.jsx';
import { Skeleton } from '../../design-system/feedback/Skeleton.jsx';
import { EmptyState } from '../../design-system/feedback/EmptyState.jsx';
import { Toast } from '../../design-system/feedback/Toast.jsx';
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

// Attach each thread item's presentational props (data + handlers, bound to this PR +
// thread) so PRCard/ThreadRow stay pure renderers — they never touch the state hook.
function wireItems(dash, prId, items) {
  return items.map((it) =>
    it.kind === 'thread'
      ? { ...it, threadProps: threadProps(dash, prId, it.thread.id) }
      : it
  );
}

function Dashboard({ dash }) {
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
                // items it shows here (server placements). The card is a pure renderer:
                // we hand it the items (each thread carrying its own data + handlers)
                // plus this PR's card-level props. One PR can appear in several lanes —
                // as distinct cards — so key by lane+PR to keep them distinct.
                <PRCard
                  key={`${active.key}:${pr.id}`}
                  pr={pr}
                  lane={active.key}
                  items={wireItems(dash, pr.id, items)}
                  {...cardProps(dash, pr.id)}
                />
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

  return (
    <div className={styles.app}>
      <GrainOverlay />
      <div className={styles.column}>
        <Dashboard dash={dash} />
      </div>
      <Toast message={dash.toastMsg} />
    </div>
  );
}
