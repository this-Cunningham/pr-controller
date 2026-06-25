import { useDashboard } from './useDashboard.js';
import { cardProps, wireItems } from './cardProps.js';
import GrainOverlay from './GrainOverlay.jsx';
import Header from './Header.jsx';
import Settings from './Settings.jsx';
import SwimlaneBoard from './SwimlaneBoard.jsx';
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

// When the whole board is empty AND the scan didn't error, an empty lane usually means the
// scope matched nothing (wrong gh account, mistyped owner/onlyPRs) rather than a true all-clear.
// Say so — with the account PR discovery actually ran as — instead of the calm "nothing needs you".
function emptyLabel(dash, active) {
  const boardEmpty = dash.openCount === 0 && !dash.lastPollError;
  if (!boardEmpty) return EMPTY[active.key];
  const who = dash.account ? ` — scanned as @${dash.account}` : '';
  return dash.scope?.length
    ? `No PRs in scope${who}. Check config.onlyPRs and that those PRs are open.`
    : `No open PRs found${who}. Check \`gh auth status\` and your config (owner / login).`;
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
              <EmptyState label={emptyLabel(dash, active)} />
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
      {dash.viewMode === 'swimlanes' ? (
        <SwimlaneBoard dash={dash} />
      ) : (
        <div className={styles.column}>
          <Dashboard dash={dash} />
        </div>
      )}
      <Toast message={dash.toastMsg} />
      {dash.settingsOpen && (
        <Settings
          settings={dash.settings}
          sensitivityLevels={dash.sensitivityLevels}
          saveConfig={dash.saveConfig}
          onClose={dash.closeSettings}
          viewMode={dash.viewMode}
          onSetViewMode={dash.setViewMode}
        />
      )}
    </div>
  );
}
