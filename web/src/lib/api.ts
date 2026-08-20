import type {
  Activity,
  Audience,
  ChatThreadDigest,
  ChatTurn,
  FeedPost,
  Ledger,
  Me,
  Mention,
  PostDetail,
  Proposal,
  Suggestion,
  ViewerProfileData,
} from './types';

export class NotConnected extends Error {}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (res.status === 401) throw new NotConnected();
  if (!res.ok) throw new Error(`${path} failed (${res.status})`);
  return res.json() as Promise<T>;
}

type AskResult = { reply: string | null; timedOut: boolean; mindOffline?: boolean };

async function post(path: string, body: unknown): Promise<AskResult> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} failed`);
  return res.json() as Promise<AskResult>;
}

export const api = {
  mode: (): Promise<{ preview: boolean; liveMind?: boolean }> =>
    get<{ preview: boolean; liveMind?: boolean }>('/api/mode').catch(() => ({ preview: false })),
  me: () => get<Me>('/api/me'),
  ledger: () => get<Ledger>('/api/ledger'),
  activity: () => get<Activity[]>('/api/activity'),
  feed: () => get<FeedPost[]>('/api/feed'),
  post: (ytVideoId: string) => get<PostDetail>(`/api/posts/${encodeURIComponent(ytVideoId)}`),
  chat: (ytVideoId: string) => get<ChatTurn[]>(`/api/posts/${encodeURIComponent(ytVideoId)}/chat`),
  ask: (ytVideoId: string, question: string, mentions: Mention[] = []) =>
    post(`/api/posts/${encodeURIComponent(ytVideoId)}/ask`, { question, mentions }),

  chats: () => get<ChatThreadDigest[]>('/api/chats'),
  viewerThreads: (ytAuthorId: string) =>
    get<ChatThreadDigest[]>(`/api/viewers/${encodeURIComponent(ytAuthorId)}/threads`),
  mentions: (q: string) => get<Suggestion[]>(`/api/mentions?q=${encodeURIComponent(q)}`),
  viewer: (ytAuthorId: string) => get<ViewerProfileData>(`/api/viewers/${encodeURIComponent(ytAuthorId)}`),
  viewerChat: (ytAuthorId: string) =>
    get<ChatTurn[]>(`/api/viewers/${encodeURIComponent(ytAuthorId)}/chat`),
  askViewer: (ytAuthorId: string, question: string, mentions: Mention[] = []) =>
    post(`/api/viewers/${encodeURIComponent(ytAuthorId)}/ask`, { question, mentions }),
  audience: () => get<Audience>('/api/audience'),
  proposals: () => get<Proposal[]>('/api/proposals'),
  decide: async (id: string, status: 'approved' | 'dismissed', choice?: string) => {
    const res = await fetch(`/api/proposals/${id}/decide`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status, choice }),
    });
    if (!res.ok) throw new Error('decision failed');
  },
  sync: async () => {
    const res = await fetch('/api/sync', { method: 'POST' });
    if (!res.ok) throw new Error('sync failed');
  },
};
