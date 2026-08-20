import { googleFetch } from './oauth.ts';
import type { RetentionPoint } from '../types.ts';

const BASE = 'https://youtubeanalytics.googleapis.com/v2/reports';

type QueryResult = { columnHeaders: Array<{ name: string }>; rows?: Array<Array<string | number>> };

async function query(
  accessToken: string,
  params: Record<string, string>,
): Promise<Array<Record<string, string | number>>> {
  const res = await googleFetch<QueryResult>(
    accessToken,
    `${BASE}?${new URLSearchParams({ ids: 'channel==MINE', ...params })}`,
  );
  const names = res.columnHeaders.map((h) => h.name);
  return (res.rows ?? []).map((row) => Object.fromEntries(names.map((n, i) => [n, row[i]!])));
}

export type VideoMetrics = {
  views: number;
  estimatedMinutesWatched: number;
  avgViewDurationS: number;
  avgViewPct: number;
  subscribersGained: number;
};

export async function videoMetrics(
  accessToken: string,
  ytVideoIds: string[],
  startDate: string,
  endDate: string,
): Promise<Map<string, VideoMetrics>> {
  const out = new Map<string, VideoMetrics>();
  for (let i = 0; i < ytVideoIds.length; i += 200) {
    const rows = await query(accessToken, {
      startDate,
      endDate,
      dimensions: 'video',
      filters: `video==${ytVideoIds.slice(i, i + 200).join(',')}`,
      metrics: 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained',
    });
    for (const row of rows) {
      out.set(String(row.video), {
        views: Number(row.views ?? 0),
        estimatedMinutesWatched: Number(row.estimatedMinutesWatched ?? 0),
        avgViewDurationS: Number(row.averageViewDuration ?? 0),
        avgViewPct: Number(row.averageViewPercentage ?? 0),
        subscribersGained: Number(row.subscribersGained ?? 0),
      });
    }
  }
  return out;
}

export async function retentionCurve(
  accessToken: string,
  ytVideoId: string,
  startDate: string,
  endDate: string,
): Promise<RetentionPoint[]> {
  const rows = await query(accessToken, {
    startDate,
    endDate,
    dimensions: 'elapsedVideoTimeRatio',
    filters: `video==${ytVideoId}`,
    metrics: 'audienceWatchRatio,relativeRetentionPerformance',
  });
  return rows
    .map((row) => ({
      ratio: Number(row.elapsedVideoTimeRatio ?? 0),
      watchRatio: Number(row.audienceWatchRatio ?? 0),
      relative: row.relativeRetentionPerformance == null ? null : Number(row.relativeRetentionPerformance),
    }))
    .sort((a, b) => a.ratio - b.ratio);
}

export type DropOff = { ratio: number; drop: number };

export function steepestDropOffs(points: RetentionPoint[], top = 3): DropOff[] {
  return points
    .slice(1)
    .map((point, i) => ({ ratio: point.ratio, drop: points[i]!.watchRatio - point.watchRatio }))
    .filter((d) => d.drop > 0)
    .sort((a, b) => b.drop - a.drop)
    .slice(0, top);
}
