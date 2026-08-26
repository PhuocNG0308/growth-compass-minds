import type {
  Activity,
  Audience,
  ChatHit,
  ChatThreadDigest,
  ChatTurn,
  FeedPost,
  Ledger,
  Live,
  Me,
  Mention,
  PostDetail,
  Proposal,
  ReplyTarget,
  Suggestion,
  Timeline,
  ViewerProfileData,
} from './types';

export class NotConnected extends Error {}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (res.status === 401) throw new NotConnected();
  if (!res.ok) throw new Error(`${path} failed (${res.status})`);
  return res.json() as Promise<T>;
}

type AskResult = {
  reply: string | null;
  timedOut: boolean;
  mindOffline?: boolean;
  outOfCognition?: boolean;
};

export type AskStage =
  | { stage: 'reading' }
  | { stage: 'briefed'; comments: number }
  | { stage: 'sent' }
  | { stage: 'waiting'; elapsedS: number };

async function post(path: string, body: unknown): Promise<AskResult> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} failed`);
  return res.json() as Promise<AskResult>;
}

/**
 * The Mind has no token stream to forward, so this carries the one thing that is actually
 * happening: which step the answer is on, and how long it has been on it.
 */
async function postStreamed(
  path: string,
  body: unknown,
  onStage: (update: AskStage) => void,
): Promise<AskResult> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) throw new Error(`${path} failed`);

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  let answer: AskResult | null = null;

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;

    let cut = buffer.indexOf('\n\n');
    for (; cut !== -1; cut = buffer.indexOf('\n\n')) {
      const frame = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);

      const name = /^event:\s*(.+)$/m.exec(frame)?.[1]?.trim();
      const data = frame
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .join('');

      if (name === 'stage') onStage(JSON.parse(data) as AskStage);
      else if (name === 'done') answer = JSON.parse(data) as AskResult;
      else if (name === 'failed') throw new Error(`${path} failed`);
    }
  }

  if (!answer) throw new Error(`${path} ended without an answer`);
  return answer;
}

export type Mode = { demo: boolean; googleConfigured: boolean; liveMind: boolean };

export const api = {
  mode: () => get<Mode>('/api/mode').catch(() => null),
  demoSignIn: async () => {
    const res = await fetch('/auth/demo', { method: 'POST' });
    if (!res.ok) throw new Error('demo sign-in failed');
  },
  me: () => get<Me>('/api/me'),
  ledger: () => get<Ledger>('/api/ledger'),
  activity: () => get<Activity[]>('/api/activity'),
  // null when nothing is on air, which is most of the time — not an error
  live: () => get<Live | null>('/api/live').catch(() => null),
  timeline: (automatedOnly = false, before?: string) =>
    get<Timeline>(
      `/api/timeline?limit=60${automatedOnly ? '&automated=1' : ''}` +
        (before ? `&before=${encodeURIComponent(before)}` : ''),
    ),
  feed: () => get<FeedPost[]>('/api/feed'),
  post: (ytVideoId: string) => get<PostDetail>(`/api/posts/${encodeURIComponent(ytVideoId)}`),
  chat: (ytVideoId: string) => get<ChatTurn[]>(`/api/posts/${encodeURIComponent(ytVideoId)}/chat`),
  ask: (
    ytVideoId: string,
    question: string,
    mentions: Mention[] = [],
    onStage?: (update: AskStage) => void,
  ) => {
    const path = `/api/posts/${encodeURIComponent(ytVideoId)}/ask`;
    const body = { question, mentions };
    return onStage ? postStreamed(path, body, onStage) : post(path, body);
  },

  chats: () => get<ChatThreadDigest[]>('/api/chats'),
  searchChat: (q: string) => get<ChatHit[]>(`/api/chats/search?q=${encodeURIComponent(q)}`),
  viewerThreads: (ytAuthorId: string) =>
    get<ChatThreadDigest[]>(`/api/viewers/${encodeURIComponent(ytAuthorId)}/threads`),
  mentions: (q: string) => get<Suggestion[]>(`/api/mentions?q=${encodeURIComponent(q)}`),
  viewer: (ytAuthorId: string) => get<ViewerProfileData>(`/api/viewers/${encodeURIComponent(ytAuthorId)}`),
  viewerChat: (ytAuthorId: string) =>
    get<ChatTurn[]>(`/api/viewers/${encodeURIComponent(ytAuthorId)}/chat`),
  askViewer: (ytAuthorId: string, question: string, mentions: Mention[] = []) =>
    post(`/api/viewers/${encodeURIComponent(ytAuthorId)}/ask`, { question, mentions }),
  audience: (segment?: string | null, limit = 40) =>
    get<Audience>(`/api/audience?limit=${limit}${segment ? `&segment=${segment}` : ''}`),
  proposals: () => get<Proposal[]>('/api/proposals'),
  replies: () => get<{ enabled: boolean; queue: ReplyTarget[] }>('/api/replies'),
  draftReply: (ytCommentId: string, ytAuthorId: string) =>
    post(`/api/comments/${encodeURIComponent(ytCommentId)}/draft`, { ytAuthorId }),
  sendReply: (ytCommentId: string, text: string) =>
    post(`/api/comments/${encodeURIComponent(ytCommentId)}/reply`, { text }),
  signOut: () => post('/api/signout', {}),
  decide: async (id: string, status: 'approved' | 'dismissed', choice?: string) => {
    const res = await fetch(`/api/proposals/${id}/decide`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status, choice }),
    });
    if (!res.ok) throw new Error('decision failed');
    return res.json() as Promise<{ opened: { experimentId: string; checkpoints: number } | null }>;
  },
  sync: async () => {
    const res = await fetch('/api/sync', { method: 'POST' });
    if (res.ok) return;
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? 'sync failed');
  },
};
