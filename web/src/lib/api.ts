import type {
  Activity,
  Audience,
  ChatHit,
  ChatLog,
  ChatThreadDigest,
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

type AskResult = { mindOffline: boolean; waitingS: number | null };

// a draft has nowhere to land later, so this one call still waits the Mind out
type Draft = { reply: string | null; timedOut: boolean; mindOffline?: boolean };

async function post<T = AskResult>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} failed`);
  return res.json() as Promise<T>;
}

export type Mode = { demo: boolean; googleConfigured: boolean; liveMind: boolean };

export const MIND_STATES = ['normal', 'empty', 'offline', 'slow'] as const;
export type MindState = (typeof MIND_STATES)[number];

export type Sandbox = {
  mind: MindState;
  live: boolean;
  videos: Array<{ ytVideoId: string; title: string }>;
  next: { kind: string; dueAt: string; videoTitle: string | null; hypothesis: string } | null;
};

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
  fastForward: async () => {
    const res = await fetch('/api/demo/fast-forward', { method: 'POST' });
    if (!res.ok) throw new Error('fast-forward failed');
    return res.json() as Promise<{
      fired: { kind: string; videoTitle: string | null; hypothesis: string } | null;
    }>;
  },
  timeline: (automatedOnly = false, before?: string) =>
    get<Timeline>(
      `/api/timeline?limit=60${automatedOnly ? '&automated=1' : ''}` +
        (before ? `&before=${encodeURIComponent(before)}` : ''),
    ),
  feed: () => get<FeedPost[]>('/api/feed'),
  post: (ytVideoId: string) => get<PostDetail>(`/api/posts/${encodeURIComponent(ytVideoId)}`),
  chat: (ytVideoId: string) => get<ChatLog>(`/api/posts/${encodeURIComponent(ytVideoId)}/chat`),
  ask: (ytVideoId: string, question: string, mentions: Mention[] = []) =>
    post(`/api/posts/${encodeURIComponent(ytVideoId)}/ask`, { question, mentions }),

  chats: () => get<ChatThreadDigest[]>('/api/chats'),
  searchChat: (q: string) => get<ChatHit[]>(`/api/chats/search?q=${encodeURIComponent(q)}`),
  viewerThreads: (ytAuthorId: string) =>
    get<ChatThreadDigest[]>(`/api/viewers/${encodeURIComponent(ytAuthorId)}/threads`),
  mentions: (q: string) => get<Suggestion[]>(`/api/mentions?q=${encodeURIComponent(q)}`),
  viewer: (ytAuthorId: string) => get<ViewerProfileData>(`/api/viewers/${encodeURIComponent(ytAuthorId)}`),
  viewerChat: (ytAuthorId: string) =>
    get<ChatLog>(`/api/viewers/${encodeURIComponent(ytAuthorId)}/chat`),
  askViewer: (ytAuthorId: string, question: string, mentions: Mention[] = []) =>
    post(`/api/viewers/${encodeURIComponent(ytAuthorId)}/ask`, { question, mentions }),
  audience: (segment?: string | null, limit = 40) =>
    get<Audience>(`/api/audience?limit=${limit}${segment ? `&segment=${segment}` : ''}`),
  proposals: () => get<Proposal[]>('/api/proposals'),
  replies: () => get<{ enabled: boolean; queue: ReplyTarget[] }>('/api/replies'),
  draftReply: (ytCommentId: string, ytAuthorId: string) =>
    post<Draft>(`/api/comments/${encodeURIComponent(ytCommentId)}/draft`, { ytAuthorId }),
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
  sandbox: () => get<Sandbox>('/api/sandbox'),
  holdMind: (mind: MindState) => post<{ mind: MindState }>('/api/sandbox/state', { mind }),
  holdLive: (live: boolean) => post<{ live: boolean }>('/api/sandbox/state', { live }),
  injectComments: (body: { flavour: string; count: number; ytVideoId?: string }) =>
    post<{ added: number; people: number; videoTitle: string }>('/api/sandbox/comments', body),
  injectProposal: (body: {
    kind: string;
    ytVideoId?: string;
    summary?: string;
    predictedCtr?: number;
    observedCtr?: number;
  }) => post<{ summary: string }>('/api/sandbox/proposals', body),
  resetSandbox: () =>
    post<{ experiments: number; proposals: number; viewers: number; restored: number }>(
      '/api/sandbox/reset',
      {},
    ),
  sync: async () => {
    const res = await fetch('/api/sync', { method: 'POST' });
    if (res.ok) return;
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? 'sync failed');
  },
};
