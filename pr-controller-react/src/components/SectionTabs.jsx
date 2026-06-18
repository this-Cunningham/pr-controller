import { Tabs } from '@ds/components/navigation/Tabs.jsx';

// Thin adapter onto the design-system Tabs. Keeps the app's existing call shape
// ({ tabs:[{key,label,count,needs}], active, onSelect }) and maps it to the DS
// contract (onChange + per-tab `emphasize` for the accent count chip).
export default function SectionTabs({ tabs, active, onSelect }) {
  const dsTabs = tabs.map((t) => ({ key: t.key, label: t.label, count: t.count, emphasize: t.needs }));
  return <Tabs tabs={dsTabs} active={active} onChange={onSelect} />;
}
