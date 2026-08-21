import { googleFetch } from './oauth.ts';

const BASE = 'https://www.googleapis.com/youtube/v3';

export type ChannelInfo = { ytChannelId: string; title: string; uploadsPlaylistId: string };

export async function channelInfo(accessToken: string): Promise<ChannelInfo> {
  const res = await googleFetch<{
    items?: Array<{
      id: string;
      snippet: { title: string };
      contentDetails: { relatedPlaylists: { uploads: string } };
    }>;
  }>(accessToken, `${BASE}/channels?part=snippet,contentDetails&mine=true`);

  const item = res.items?.[0];
  if (!item) throw new Error('no channel on this google account');
  return {
    ytChannelId: item.id,
    title: item.snippet.title,
    uploadsPlaylistId: item.contentDetails.relatedPlaylists.uploads,
  };
}

export async function uploadIds(
  accessToken: string,
  playlistId: string,
  limit: number,
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken = '';
  while (ids.length < limit) {
    const url = `${BASE}/playlistItems?part=contentDetails&maxResults=50&playlistId=${playlistId}${pageToken}`;
    const res = await googleFetch<{
      items?: Array<{ contentDetails: { videoId: string } }>;
      nextPageToken?: string;
    }>(accessToken, url);
    ids.push(...(res.items ?? []).map((i) => i.contentDetails.videoId));
    if (!res.nextPageToken) break;
    pageToken = `&pageToken=${res.nextPageToken}`;
  }
  return ids.slice(0, limit);
}

export type VideoDetail = {
  ytVideoId: string;
  title: string;
  thumbnailUrl: string | null;
  durationS: number;
  publishedAt: Date;
  views: number;
  likes: number;
  comments: number;
};

// ISO 8601 durations split on T so PT2M means minutes, not months.
function durationToSeconds(iso: string): number {
  const [, time = ''] = iso.split('T');
  const unit: Record<string, number> = { H: 3600, M: 60, S: 1 };
  let total = 0;
  for (const [, value, key] of time.matchAll(/(\d+)([HMS])/g)) {
    total += Number(value) * unit[key!]!;
  }
  return total;
}

export async function videoDetails(accessToken: string, ids: string[]): Promise<VideoDetail[]> {
  const out: VideoDetail[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50).join(',');
    const res = await googleFetch<{
      items?: Array<{
        id: string;
        snippet: { title: string; publishedAt: string; thumbnails?: Record<string, { url: string }> };
        contentDetails: { duration: string };
        statistics: { viewCount?: string; likeCount?: string; commentCount?: string };
      }>;
    }>(accessToken, `${BASE}/videos?part=snippet,contentDetails,statistics&id=${batch}`);

    for (const item of res.items ?? []) {
      const thumbs = item.snippet.thumbnails ?? {};
      out.push({
        ytVideoId: item.id,
        title: item.snippet.title,
        thumbnailUrl: (thumbs.maxres ?? thumbs.high ?? thumbs.default)?.url ?? null,
        durationS: durationToSeconds(item.contentDetails.duration),
        publishedAt: new Date(item.snippet.publishedAt),
        views: Number(item.statistics.viewCount ?? 0),
        likes: Number(item.statistics.likeCount ?? 0),
        comments: Number(item.statistics.commentCount ?? 0),
      });
    }
  }
  return out;
}

export type CommentRow = {
  ytCommentId: string;
  ytAuthorId: string;
  displayName: string;
  text: string;
  likeCount: number;
  publishedAt: Date;
};

export async function comments(
  accessToken: string,
  ytVideoId: string,
  limit = 100,
): Promise<CommentRow[]> {
  const url =
    `${BASE}/commentThreads?part=snippet&order=time&maxResults=${Math.min(limit, 100)}` +
    `&videoId=${ytVideoId}`;
  const res = await googleFetch<{
    items?: Array<{
      snippet: {
        topLevelComment: {
          id: string;
          snippet: {
            authorDisplayName: string;
            authorChannelId?: { value: string };
            textOriginal: string;
            likeCount: number;
            publishedAt: string;
          };
        };
      };
    }>;
  }>(accessToken, url).catch(() => ({ items: [] }));

  return (res.items ?? []).map((item) => {
    const c = item.snippet.topLevelComment;
    return {
      ytCommentId: c.id,
      ytAuthorId: c.snippet.authorChannelId?.value ?? c.snippet.authorDisplayName,
      displayName: c.snippet.authorDisplayName,
      text: c.snippet.textOriginal,
      likeCount: c.snippet.likeCount,
      publishedAt: new Date(c.snippet.publishedAt),
    };
  });
}

/** The only write this service performs, and only ever from a creator's click. */
export async function replyToComment(
  accessToken: string,
  parentId: string,
  text: string,
): Promise<{ ytCommentId: string }> {
  const res = await fetch(`${BASE}/comments?part=snippet`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ snippet: { parentId, textOriginal: text } }),
  });

  if (!res.ok) throw new Error(`reply ${res.status}: ${await res.text()}`);
  const created = (await res.json()) as { id: string };
  return { ytCommentId: created.id };
}
