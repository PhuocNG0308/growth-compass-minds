import type { PostComment } from '../db/repo.ts';

export const SEGMENTS = ['superfan', 'potential', 'newcomer'] as const;
export type Segment = (typeof SEGMENTS)[number];

export const SUPERFAN_COMMENTS = 5;
export const POTENTIAL_COMMENTS = 2;
export const SUPERFAN_TENURE_DAYS = 21;

/** Handed to the SQL side so the ladder is defined once and read in both places. */
export const SEGMENT_THRESHOLDS = {
  superfanComments: SUPERFAN_COMMENTS,
  potentialComments: POTENTIAL_COMMENTS,
  superfanTenureDays: SUPERFAN_TENURE_DAYS,
};

/** Loyalty read from behaviour we already store: how often they come back, and for how long. */
export function segmentOf(comment: Pick<PostComment, 'viewerCommentCount' | 'viewerFirstSeenAt'>): Segment {
  const tenureDays = (Date.now() - new Date(comment.viewerFirstSeenAt).getTime()) / 86_400_000;
  if (comment.viewerCommentCount >= SUPERFAN_COMMENTS && tenureDays >= SUPERFAN_TENURE_DAYS)
    return 'superfan';
  if (comment.viewerCommentCount >= POTENTIAL_COMMENTS) return 'potential';
  return 'newcomer';
}

export function describeComment(comment: PostComment) {
  return {
    ytCommentId: comment.ytCommentId,
    ytAuthorId: comment.ytAuthorId,
    repliedAt: comment.repliedAt,
    replyText: comment.replyText,
    text: comment.text,
    likeCount: comment.likeCount,
    publishedAt: comment.publishedAt,
    triage: comment.triage,
    displayName: comment.displayName,
    viewerCommentCount: comment.viewerCommentCount,
    segment: segmentOf(comment),
  };
}
