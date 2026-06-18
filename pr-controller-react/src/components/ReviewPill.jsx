import { Badge } from '@ds/components/core/Badge.jsx';
import { reviewMeta } from '../meta.js';

// Review-status pill, rendered with the design-system Badge (mono variant).
export default function ReviewPill({ review }) {
  const m = reviewMeta[review] || reviewMeta.REVIEW_REQUIRED;
  return <Badge tone={m.tone} mono>{m.label}</Badge>;
}
