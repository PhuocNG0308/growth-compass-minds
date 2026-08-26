export type Counts = {
  videos: number;
  running: number;
  settled: number;
  overdue: number;
  tenets: number;
  waiting: number;
};

export type Me = {
  channelId: string;
  ytChannelId: string;
  title: string;
  connectedAt: string;
  reachThrough: string | null;
  lastSyncAt: string | null;
  syncFailing: boolean;
  demo: boolean;
  demoSource: {
    handle: string;
    title: string;
    url: string;
    /** False when no API key is set, which is when the comments are invented too. */
    realComments: boolean;
    modelled: string[];
  } | null;
  mindEnabled: boolean;
  /** Null when no Mind is configured; at or below zero it will take a question and never answer. */
  mindCognition: number | null;
  repliesEnabled: boolean;
  counts: Counts;
};

export type Prediction = Record<string, number>;
export type Verdict = 'confirmed' | 'refuted' | 'inconclusive';

export type VideoRef = { ytVideoId: string; title: string; thumbnailUrl: string | null };

export type Checkpoint = { id: string; kind: string; dueAt: string; overdue: boolean };

export type OpenExperiment = {
  id: string;
  lever: string;
  hypothesis: string;
  prediction: Prediction;
  status: string;
  openedAt: string;
  video: VideoRef | null;
  checkpoints: Checkpoint[];
};

export type SettledExperiment = {
  hypothesis: string;
  lever: string;
  verdict: Verdict | null;
  prediction: Prediction;
  outcome: Record<string, unknown> | null;
  closedAt: string | null;
};

export type Rule = {
  id: string;
  statement: string;
  lever: string | null;
  evidenceCount: number;
  contradictionCount: number;
  confidence: number;
  isTenet: boolean;
  promotable: boolean;
};

export type ScoredExperiment = {
  id: string;
  lever: string;
  hypothesis: string;
  verdict: Verdict | null;
  closedAt: string;
  predictedCtr: number | null;
  actualCtr: number | null;
  ctrDelta: number | null;
};

export type Ledger = {
  scores: ScoredExperiment[];
  channel: { id: string; ytChannelId: string; title: string };
  openExperiments: OpenExperiment[];
  settledExperiments: SettledExperiment[];
  channelRules: { tenets: Rule[]; candidates: Rule[] };
  dataCoverage: { reachThrough: string | null; note: string };
};

export type Activity = {
  checkpointId: string;
  kind: string;
  firedAt: string;
  observedAt: string | null;
  observation: Record<string, unknown> | null;
  lever: string;
  hypothesis: string;
  videoTitle: string | null;
  ytVideoId: string | null;
};

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
  kind: 'title' | 'thumbnail' | 'hook' | 'reply' | 'experiment' | 'community';
  summary: string;
  detail: string;
  rationale: string;
  options: string[];
  payload: ExperimentPayload | null;
  createdAt: string;
  videoTitle: string | null;
  thumbnailUrl: string | null;
  videoPublishedAt: string | null;
};

export type Snapshot = {
  id: string;
  capturedAt: string;
  ageHours: number;
  views: number | null;
  ctr: number | null;
  avgViewPct: number | null;
  avgViewDurationS: number | null;
  subscribersGained: number | null;
};

export type RetentionPoint = { ratio: number; watchRatio: number; relative: number | null };

export type VideoDetail = {
  video: {
    ytVideoId: string;
    title: string;
    publishedAt: string;
    durationS: number | null;
    thumbnailUrl: string | null;
  };
  history: Snapshot[];
  retention: { points: RetentionPoint[]; steepestDropOffs: Array<{ ratio: number; drop: number }> } | null;
};

export type Superfan = {
  ytAuthorId: string;
  displayName: string;
  commentCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  tenureDays: number;
  segment: Segment;
};

export type QueuedComment = {
  ytCommentId: string;
  ytAuthorId: string;
  text: string;
  likeCount: number;
  publishedAt: string;
  videoTitle: string;
  displayName: string;
  viewerCommentCount: number;
  segment: Segment;
};

export type Audience = {
  superfans: Superfan[];
  segmentCounts: Partial<Record<Segment, number>>;
  queue: QueuedComment[];
};

export type Segment = 'superfan' | 'potential' | 'newcomer';

export type TimelineEvent = {
  at: string;
  kind: string;
  automated: boolean;
  refId: string;
  title: string;
  detail: Record<string, unknown>;
};

export type Accuracy = {
  graded: number;
  meanAbsCtrError: number | null;
  meanAbsAvpError: number | null;
  recentAbsCtrError: number | null;
  earlierAbsCtrError: number | null;
};

export type Timeline = {
  events: TimelineEvent[];
  accuracy: Accuracy;
  totals: { sessions: number; automated: number; tenets: number };
};

export type PostComment = {
  ytCommentId: string;
  ytAuthorId: string;
  repliedAt: string | null;
  replyText: string | null;
  text: string;
  likeCount: number;
  publishedAt: string;
  triage: string | null;
  displayName: string;
  viewerCommentCount: number;
  segment: Segment;
};

export type FeedPost = {
  ytVideoId: string;
  title: string;
  thumbnailUrl: string | null;
  publishedAt: string;
  durationS: number | null;
  views: number | null;
  likes: number | null;
  ctrPct: number | null;
  avgViewPct: number | null;
  subscribersGained: number | null;
  commentCount: number;
  trajectory: number[];
  topComments: PostComment[];
};

export type PostDetail = {
  post: FeedPost & { avgViewDurationS: number | null };
  comments: PostComment[];
  retention: { points: RetentionPoint[]; steepestDropOffs: Array<{ ratio: number; drop: number }> } | null;
  history: Snapshot[];
};

export type ChatTurn = { role: 'creator' | 'mind'; text: string; at: string };

export type ChatThreadDigest = {
  id: string;
  subjectKind: 'video' | 'viewer' | 'segment' | 'channel';
  subjectId: string;
  title: string;
  lastMessageAt: string;
  messageCount: number;
  lastBody: string;
};

export type ChatHit = {
  threadId: string;
  title: string;
  subjectKind: 'video' | 'viewer' | 'segment' | 'channel';
  subjectId: string;
  role: 'creator' | 'mind';
  body: string;
  createdAt: string;
};

export type ReplyTarget = PostComment & {
  videoTitle: string;
  ytVideoId: string;
  thumbnailUrl: string | null;
};

export type Mention = { kind: 'viewer' | 'segment' | 'video' | 'experiment'; id: string };
export type Suggestion = { kind: string; id: string; label: string; detail: string };

export type ViewerProfileData = {
  viewer: {
    ytAuthorId: string;
    displayName: string;
    commentCount: number;
    firstSeenAt: string;
    lastSeenAt: string;
    tenureDays: number;
    segment: Segment;
    videosTouched: number;
    totalLikes: number;
  };
  comments: Array<{
    ytCommentId: string;
    text: string;
    likeCount: number;
    publishedAt: string;
    triage: string | null;
    ytVideoId: string;
    videoTitle: string;
    thumbnailUrl: string | null;
  }>;
};

export type Live = {
  ytVideoId: string;
  title: string;
  thumbnailUrl: string;
  channel: string;
  watching: number | null;
  startedAt: string | null;
  /** Null unless the server has a YouTube API key: chat is the one live field that needs one. */
  chat: Array<{ displayName: string; text: string; at: string }> | null;
};
