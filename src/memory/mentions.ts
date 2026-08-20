import * as repo from '../db/repo.ts';
import { segmentOf, SEGMENTS, type Segment } from './segments.ts';
import type { Channel } from '../types.ts';

export type Mention = { kind: 'viewer' | 'segment' | 'video' | 'experiment'; id: string };

const SEGMENT_LABEL: Record<Segment, string> = {
  superfan: 'Superfans',
  potential: 'Potential fans',
  newcomer: 'First-time commenters',
};

export type Suggestion = { kind: string; id: string; label: string; detail: string };

export async function suggest(channel: Channel, query: string): Promise<Suggestion[]> {
  const needle = query.trim().toLowerCase();

  const segments: Suggestion[] = SEGMENTS.filter(
    (segment) => !needle || SEGMENT_LABEL[segment].toLowerCase().includes(needle),
  ).map((segment) => ({
    kind: 'segment',
    id: segment,
    label: SEGMENT_LABEL[segment],
    detail: 'audience group',
  }));

  const rest = await repo.mentionables(channel.id, needle);
  return [...segments, ...rest];
}

/**
 * A mention becomes a block of evidence appended to the question. The Mind gets the
 * same facts the creator is looking at, instead of guessing who "they" refers to.
 */
export async function resolve(channel: Channel, mentions: Mention[]): Promise<string[]> {
  const blocks: string[] = [];

  for (const mention of mentions.slice(0, 6)) {
    if (mention.kind === 'viewer') {
      const viewer = await repo.getViewer(channel.id, mention.id);
      if (!viewer) continue;
      const comments = await repo.viewerComments(viewer.id, 12);
      blocks.push(
        [
          `VIEWER ${viewer.displayName} — ${segmentOf({
            viewerCommentCount: viewer.commentCount,
            viewerFirstSeenAt: viewer.firstSeenAt,
          })}`,
          `${viewer.commentCount} comments, first seen ${viewer.firstSeenAt.toISOString().slice(0, 10)}`,
          ...comments.map((c) => `- on "${c.videoTitle}": ${c.text.replace(/\s+/g, ' ').slice(0, 200)}`),
        ].join('\n'),
      );
      continue;
    }

    if (mention.kind === 'segment') {
      const people = await repo.segmentCensus(channel.id);
      const members = people.filter(
        (person) =>
          segmentOf({ viewerCommentCount: person.commentCount, viewerFirstSeenAt: person.firstSeenAt }) ===
          mention.id,
      );
      blocks.push(
        [
          `SEGMENT ${SEGMENT_LABEL[mention.id as Segment] ?? mention.id} — ${members.length} people`,
          ...members
            .slice(0, 15)
            .map((person) => `- ${person.displayName}: ${person.commentCount} comments`),
        ].join('\n'),
      );
      continue;
    }

    if (mention.kind === 'video') {
      const video = await repo.getVideo(mention.id);
      if (!video || video.channelId !== channel.id) continue;
      const snapshot = await repo.latestSnapshot(video.id);
      const comments = await repo.commentsForVideo(video.id, 10);
      blocks.push(
        [
          `VIDEO "${video.title}" (${video.ytVideoId})`,
          `metrics: ${JSON.stringify({
            views: snapshot?.views ?? null,
            ctrPct: snapshot?.ctr ?? null,
            avgViewPct: snapshot?.avgViewPct ?? null,
          })}`,
          ...comments.map((c) => `- ${c.displayName}: ${c.text.replace(/\s+/g, ' ').slice(0, 160)}`),
        ].join('\n'),
      );
      continue;
    }

    const experiment = await repo.getExperiment(mention.id);
    if (!experiment || experiment.channelId !== channel.id) continue;
    blocks.push(
      [
        `EXPERIMENT ${experiment.lever} — ${experiment.status}${experiment.verdict ? ` / ${experiment.verdict}` : ''}`,
        `hypothesis: ${experiment.hypothesis}`,
        `predicted: ${JSON.stringify(experiment.prediction)}`,
        experiment.outcome ? `outcome: ${JSON.stringify(experiment.outcome)}` : 'outcome: not settled',
      ].join('\n'),
    );
  }

  return blocks;
}
