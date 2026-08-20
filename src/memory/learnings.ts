import type { Learning } from '../types.ts';

export const TENET_EVIDENCE_THRESHOLD = 3;

export function isPromotable(learning: Learning): boolean {
  return (
    learning.promotedToTenetAt === null &&
    learning.evidenceCount >= TENET_EVIDENCE_THRESHOLD &&
    learning.evidenceCount > learning.contradictionCount * 2
  );
}

export function confidence(learning: Learning): number {
  const total = learning.evidenceCount + learning.contradictionCount;
  return total === 0 ? 0 : Number((learning.evidenceCount / total).toFixed(2));
}

export function describe(learning: Learning) {
  return {
    id: learning.id,
    statement: learning.statement,
    lever: learning.lever,
    evidenceCount: learning.evidenceCount,
    contradictionCount: learning.contradictionCount,
    confidence: confidence(learning),
    isTenet: learning.promotedToTenetAt !== null,
    promotable: isPromotable(learning),
  };
}
