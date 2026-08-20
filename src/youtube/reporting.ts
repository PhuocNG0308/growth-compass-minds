import { googleFetch } from './oauth.ts';

const BASE = 'https://youtubereporting.googleapis.com/v1';
const REPORT_TYPE = 'channel_reach_basic_a1';

type Job = { id: string; reportTypeId: string };
type Report = { id: string; startTime: string; endTime: string; createTime: string; downloadUrl: string };

export async function ensureJob(accessToken: string): Promise<string> {
  const { jobs } = await googleFetch<{ jobs?: Job[] }>(accessToken, `${BASE}/jobs`);
  const existing = jobs?.find((j) => j.reportTypeId === REPORT_TYPE);
  if (existing) return existing.id;

  const res = await fetch(`${BASE}/jobs`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ reportTypeId: REPORT_TYPE, name: 'growth-api reach' }),
  });
  if (!res.ok) throw new Error(`create reporting job ${res.status}: ${await res.text()}`);
  return ((await res.json()) as Job).id;
}

export type Reach = { impressions: number; ctrPct: number };

export async function reachByVideo(
  accessToken: string,
  jobId: string,
  createdAfter: Date,
): Promise<{ reach: Map<string, Reach>; through: string | null }> {
  const { reports } = await googleFetch<{ reports?: Report[] }>(
    accessToken,
    `${BASE}/jobs/${jobId}/reports?createdAfter=${createdAfter.toISOString()}`,
  );

  const totals = new Map<string, { impressions: number; clicks: number }>();
  let through: string | null = null;

  for (const report of reports ?? []) {
    const rows = await downloadCsv(accessToken, report.downloadUrl);
    for (const row of rows) {
      const videoId = row.video_id;
      const impressions = Number(row.video_thumbnail_impressions ?? 0);
      if (!videoId || impressions === 0) continue;
      const acc = totals.get(videoId) ?? { impressions: 0, clicks: 0 };
      acc.impressions += impressions;
      acc.clicks += impressions * (normalizeCtr(row.video_thumbnail_impressions_ctr) / 100);
      totals.set(videoId, acc);
    }
    if (!through || report.endTime > through) through = report.endTime;
  }

  const reach = new Map<string, Reach>();
  for (const [videoId, { impressions, clicks }] of totals) {
    reach.set(videoId, { impressions, ctrPct: (clicks / impressions) * 100 });
  }
  return { reach, through: through ? through.slice(0, 10) : null };
}

// Google does not document whether this column is a ratio or a percentage, and real
// thumbnail CTR never reaches 100%, so a value at or below 1 is treated as a ratio.
function normalizeCtr(raw: string | undefined): number {
  const value = Number(raw ?? 0);
  return value <= 1 ? value * 100 : value;
}

async function downloadCsv(
  accessToken: string,
  url: string,
): Promise<Array<Record<string, string | undefined>>> {
  const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`download report ${res.status}`);

  const [header, ...lines] = (await res.text()).trim().split('\n');
  if (!header) return [];
  const columns = header.trim().split(',');
  return lines.map((line) => {
    const values = line.trim().split(',');
    return Object.fromEntries(columns.map((c, i) => [c, values[i]]));
  });
}
