import * as repo from '../db/repo.ts';
import { SEGMENT_THRESHOLDS } from '../memory/segments.ts';
import { mindEnabled, notifyMind } from './client.ts';

// A crossing is worth one conversation, not a stream of them: the Mind is paid for in
// cognition, and a creator who gets six nurture cards an hour stops reading any of them.
const PER_TICK = 2;
const DAILY_CAP = 6;
const POLL_MS = 5 * 60_000;
const COMMENTS_IN_BRIEF = 6;

const LADDER: Record<string, string> = {
  potential: 'they have come back more than once',
  superfan: 'they keep coming back and have been around long enough to count as a regular',
};

export async function fireCrossings(): Promise<void> {
  await repo.seedSegments(SEGMENT_THRESHOLDS);
  if (!mindEnabled) return;

  for (const crossing of await repo.segmentCrossings(SEGMENT_THRESHOLDS, {
    limit: PER_TICK,
    dailyCap: DAILY_CAP,
  })) {
    const comments = await repo.viewerComments(crossing.viewerId, COMMENTS_IN_BRIEF);
    await notifyMind(brief(crossing, comments));
    await repo.markNurtured(crossing.viewerId, crossing.currentSegment);
  }
}

function brief(crossing: repo.Crossing, comments: repo.ViewerComment[]): string {
  const untagged = comments.filter((comment) => comment.triage == null);

  return [
    `AUDIENCE CROSSING — channel "${crossing.channelTitle}"`,
    `channelId: ${crossing.channelId}`,
    `viewer: ${crossing.displayName} (ytAuthorId ${crossing.ytAuthorId})`,
    `moved: ${crossing.previousSegment} -> ${crossing.currentSegment}, because ${LADDER[crossing.currentSegment] ?? 'the ladder was recalculated'}`,
    `history: ${crossing.commentCount} comments over ${crossing.tenureDays} days, ` +
      `first seen ${crossing.firstSeenAt.toISOString().slice(0, 10)}, ` +
      `last seen ${crossing.lastSeenAt.toISOString().slice(0, 10)}`,
    // whether the creator has ever answered them is the difference between "say thank you"
    // and "say something at last", and the Mind cannot tell which from the comments alone
    crossing.repliesSent === 0
      ? 'the creator has never replied to this person'
      : `the creator has replied to them ${crossing.repliesSent} time(s)`,
    '',
    'their most recent comments:',
    ...comments.map(
      (comment) =>
        `- [${comment.ytCommentId}] ${comment.publishedAt.toISOString().slice(0, 10)} on ` +
        `"${comment.videoTitle}" — ${comment.text.replace(/\s+/g, ' ').slice(0, 240)} ` +
        `(tone: ${comment.triage ?? 'untagged'})`,
    ),
    '',
    'Do now:',
    untagged.length
      ? `1. Tag the tone of the ${untagged.length} untagged comment(s) above: POST ` +
        `/v1/comments/{ytCommentId}/triage with "superfan", "question", "criticism" or "noise". ` +
        `The creator reads this on the viewer's profile to decide how to talk to them.`
      : '1. Every comment above is already tagged; leave them alone.',
    `2. POST /v1/proposals with channelId "${crossing.channelId}", ytAuthorId ` +
      `"${crossing.ytAuthorId}" and kind "reply", carrying two or three replies the creator ` +
      `could send today, in the options list. Point them at something this person actually ` +
      `said, not at the fact that they crossed a threshold — nobody wants to be thanked for ` +
      `a metric.`,
    '3. If what they keep asking about is a video worth making, POST /v1/proposals with kind',
    '   "experiment" instead, and say in the rationale which comments led you there.',
    'Say plainly when there is nothing worth acting on and propose nothing.',
    'You cannot reply on the channel. Propose; the creator sends it.',
  ].join('\n');
}

export function startNurtureRunner(): () => void {
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await fireCrossings();
    } catch (err) {
      console.error('[nurture]', err);
    } finally {
      running = false;
    }
  };

  const timer = setInterval(tick, POLL_MS);
  void tick();
  return () => clearInterval(timer);
}
