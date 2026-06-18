import { Badge } from '@ds/components/core/Badge.jsx';
import { pillMeta } from '../meta.js';

// PR signal pill ("N auto-fixable", "behind base", "CI failing: …"), rendered
// with the design-system Badge.
export default function StatusPill({ pill }) {
  const m = pillMeta[pill.kind] || pillMeta.behind;
  return <Badge tone={m.tone} dot={m.dot}>{pill.label}</Badge>;
}
