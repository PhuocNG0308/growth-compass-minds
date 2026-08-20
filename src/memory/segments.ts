import type { PostComment } from '../db/repo.ts';

export const SEGMENTS = ['superfan', 'potential', 'newcomer'] as const;
export type Segment = (typeof SEGMENTS)[number];

const SUPERFAN_COMMENTS = 5;
const POTENTIAL_COMMENTS = 2;

/** Loyalty read from behaviour we already store: how often they come back, and for how long. */
export function segmentOf(comment: Pick<PostComment, 'viewerCommentCount' | 'viewerFirstSeenAt'>): Segment {
  const tenureDays = (Date.now() - new Date(comment.viewerFirstSeenAt).getTime()) / 86_400_000;
  if (comment.viewerCommentCount >= SUPERFAN_COMMENTS && tenureDays >= 21) return 'superfan';
  if (comment.viewerCommentCount >= POTENTIAL_COMMENTS) return 'potential';
  return 'newcomer';
}

export function describeComment(comment: PostComment) {
  return {
    ytCommentId: comment.ytCommentId,
    ytAuthorId: comment.ytAuthorId,
    text: comment.text,
    likeCount: comment.likeCount,
    publishedAt: comment.publishedAt,
    triage: comment.triage,
    displayName: comment.displayName,
    viewerCommentCount: comment.viewerCommentCount,
    segment: segmentOf(comment),
  };
}
