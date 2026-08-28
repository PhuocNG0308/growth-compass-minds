export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export type Channel = {
  id: string;
  ytChannelId: string;
  title: string;
  refreshToken: string;
  reportingJobId: string | null;
  reachSyncedThrough: Date | null;
  lastSyncAt: Date | null;
  lastSyncError: string | null;
  createdAt: Date;
};

export type Video = {
  id: string;
  channelId: string;
  ytVideoId: string;
  title: string;
  thumbnailUrl: string | null;
  durationS: number | null;
  publishedAt: Date;
  syncedAt: Date | null;
};

export type Snapshot = {
  id: string;
  videoId: string;
  capturedAt: Date;
  ageHours: number;
  views: number | null;
  likes: number | null;
  comments: number | null;
  impressions: number | null;
  ctr: number | null;
  avgViewDurationS: number | null;
  avgViewPct: number | null;
  subscribersGained: number | null;
};

export type RetentionPoint = { ratio: number; watchRatio: number; relative: number | null };

export type Prediction = Record<string, number>;

export type Experiment = {
  id: string;
  channelId: string;
  videoId: string | null;
  lever: string;
  hypothesis: string;
  prediction: Prediction;
  status: 'open' | 'measuring' | 'closed' | 'abandoned';
  outcome: Record<string, Json> | null;
  verdict: 'confirmed' | 'refuted' | 'inconclusive' | null;
  /** Written by the demo sandbox, and deleted when it is reset. */
  sandbox: boolean;
  openedAt: Date;
  closedAt: Date | null;
};

export const CHECKPOINT_OFFSETS_H = { t24: 24, t72: 72, t7d: 168, t28d: 672 } as const;
export type CheckpointKind = keyof typeof CHECKPOINT_OFFSETS_H;

export type Checkpoint = {
  id: string;
  experimentId: string;
  kind: CheckpointKind;
  dueAt: Date;
  firedAt: Date | null;
  observedAt: Date | null;
  observation: Record<string, Json> | null;
};

export type Learning = {
  id: string;
  channelId: string;
  statement: string;
  lever: string | null;
  evidenceCount: number;
  contradictionCount: number;
  supportingExperiments: string[];
  promotedToTenetAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export const PROPOSAL_KINDS = ['title', 'thumbnail', 'hook', 'reply', 'experiment', 'community'] as const;
export type ProposalKind = (typeof PROPOSAL_KINDS)[number];

/** One concept the Mind is willing to be graded on. */
export type Concept = {
  label: string;
  hypothesis: string;
  prediction: Prediction;
};

export type ExperimentPayload = {
  lever: string;
  ytVideoId: string | null;
  concepts: Concept[];
};

export type Proposal = {
  id: string;
  channelId: string;
  videoId: string | null;
  kind: ProposalKind;
  summary: string;
  detail: string;
  rationale: string;
  options: string[];
  payload: ExperimentPayload | null;
  status: 'pending' | 'approved' | 'dismissed';
  sandbox: boolean;
  decidedAt: Date | null;
  decidedChoice: string | null;
  createdAt: Date;
};

export const CHAT_SUBJECTS = ['video', 'viewer', 'segment', 'channel'] as const;
export type ChatSubject = (typeof CHAT_SUBJECTS)[number];

export type ChatThread = {
  id: string;
  channelId: string;
  subjectKind: ChatSubject;
  subjectId: string;
  alias: string;
  title: string;
  createdAt: Date;
  lastMessageAt: Date;
};

export type ChatMessage = {
  id: string;
  threadId: string;
  role: 'creator' | 'mind';
  body: string;
  createdAt: Date;
};
