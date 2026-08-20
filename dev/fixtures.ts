const hours = (offset: number) => new Date(Date.now() + offset * 3_600_000).toISOString();
const days = (offset: number) => hours(offset * 24);

// sample thumbnails are generated inline so the preview needs no network
function thumb(title: string, tint: string): string {
  const words = title.split(' ');
  const lines = [words.slice(0, 3).join(' '), words.slice(3, 6).join(' ')].filter(Boolean);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${tint}"/><stop offset="1" stop-color="#1d241f"/>
    </linearGradient></defs>
    <rect width="640" height="360" fill="url(#g)"/>
    ${lines
      .map(
        (line, i) =>
          `<text x="44" y="${168 + i * 58}" font-family="Geist, system-ui, sans-serif" font-size="46" font-weight="600" fill="#f3f6f3">${line.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`,
      )
      .join('')}
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

const claim = (statement: string, evidenceCount: number, contradictionCount: number, isTenet: boolean) => ({
  id: `demo-${statement.length}-${evidenceCount}`,
  statement,
  lever: 'thumbnail',
  evidenceCount,
  contradictionCount,
  confidence: Number((evidenceCount / (evidenceCount + contradictionCount || 1)).toFixed(2)),
  isTenet,
  promotable: !isTenet && evidenceCount >= 3,
});

export const me = {
  channelId: 'preview',
  ytChannelId: 'UC_PREVIEW_ONLY',
  title: 'Deskbound',
  connectedAt: days(-41),
  reachThrough: '2026-08-17',
  mindEnabled: true,
  counts: { videos: 8, running: 3, settled: 4, overdue: 1, tenets: 3, waiting: 2 },
};

type Seed = {
  id: string;
  title: string;
  publishedAt: string;
  durationS: number;
  views: number;
  impressions: number | null;
  ctrPct: number | null;
  avgViewPct: number | null;
  subscribersGained: number | null;
  cliff: number;
  tint: string;
};

const SEEDS: Seed[] = [
  { id: 'desk-rebuild', title: 'I rebuilt my desk for the fourth time', publishedAt: hours(-50), durationS: 743, views: 18420, impressions: 402000, ctrPct: 4.1, avgViewPct: 38.2, subscribersGained: 210, cliff: 0.2, tint: '#4f6b55' },
  { id: 'monitor-arm', title: 'The cheapest good monitor arm', publishedAt: days(-12), durationS: 512, views: 9140, impressions: 188000, ctrPct: 4.9, avgViewPct: 41.6, subscribersGained: 96, cliff: 0.35, tint: '#3f5f6b' },
  { id: 'cable-lie', title: 'Cable management is a lie', publishedAt: days(-26), durationS: 388, views: 41200, impressions: 690000, ctrPct: 6.4, avgViewPct: 52.1, subscribersGained: 880, cliff: 0.6, tint: '#6b5b3f' },
  { id: 'standing-desk', title: 'Six months with a standing desk', publishedAt: days(-38), durationS: 902, views: 12750, impressions: 311000, ctrPct: 3.8, avgViewPct: 31.4, subscribersGained: 145, cliff: 0.12, tint: '#5b4f6b' },
  { id: 'keyboard-tray', title: 'The keyboard tray nobody talks about', publishedAt: days(-54), durationS: 461, views: 7380, impressions: 156000, ctrPct: 4.4, avgViewPct: 44.9, subscribersGained: 71, cliff: 0.4, tint: '#3f6b57' },
  { id: 'lighting-fix', title: 'Fixing my desk lighting for £40', publishedAt: days(-70), durationS: 623, views: 23900, impressions: 428000, ctrPct: 5.6, avgViewPct: 47.3, subscribersGained: 412, cliff: 0.5, tint: '#6b4f4f' },
  { id: 'chair-truth', title: 'You do not need a £1000 chair', publishedAt: days(-88), durationS: 1140, views: 63400, impressions: 980000, ctrPct: 6.9, avgViewPct: 35.8, subscribersGained: 1340, cliff: 0.18, tint: '#47603f' },
  { id: 'desk-tour', title: 'Desk tour 2026 — everything on it', publishedAt: days(-104), durationS: 534, views: 15600, impressions: null, ctrPct: null, avgViewPct: null, subscribersGained: null, cliff: 0.3, tint: '#3f4a6b' },
];

export const videos = SEEDS.map((seed) => ({
  ytVideoId: seed.id,
  title: seed.title,
  thumbnailUrl: thumb(seed.title, seed.tint),
  publishedAt: seed.publishedAt,
  durationS: seed.durationS,
  views: seed.views,
  impressions: seed.impressions,
  ctrPct: seed.ctrPct,
  avgViewPct: seed.avgViewPct,
  avgViewDurationS: seed.avgViewPct == null ? null : Math.round((seed.durationS * seed.avgViewPct) / 100),
  subscribersGained: seed.subscribersGained,
}));

function curve(seed: Seed) {
  const points = [];
  for (let i = 0; i <= 20; i += 1) {
    const ratio = i / 20;
    const decay = 1 - ratio * (1 - seed.avgViewPct! / 100) * 1.35;
    const drop = Math.abs(ratio - seed.cliff) < 0.03 ? 0.14 : 0;
    points.push({ ratio, watchRatio: Math.max(0.1, decay - drop), relative: 0.9 });
  }
  return points;
}

export const videoDetails: Record<string, unknown> = Object.fromEntries(
  SEEDS.map((seed) => {
    const row = videos.find((v) => v.ytVideoId === seed.id)!;
    const ageHours = Math.round((Date.now() - new Date(seed.publishedAt).getTime()) / 3_600_000);

    return [
      seed.id,
      {
        video: {
          id: seed.id,
          channelId: 'preview',
          ytVideoId: seed.id,
          title: seed.title,
          thumbnailUrl: thumb(seed.title, seed.tint),
          durationS: seed.durationS,
          publishedAt: seed.publishedAt,
          syncedAt: hours(-1),
        },
        history: [
          {
            id: `${seed.id}-2`,
            capturedAt: hours(-1),
            ageHours,
            views: row.views,
            ctr: row.ctrPct,
            avgViewPct: row.avgViewPct,
            avgViewDurationS: row.avgViewDurationS,
            subscribersGained: row.subscribersGained,
          },
          {
            id: `${seed.id}-1`,
            capturedAt: hours(-25),
            ageHours: Math.max(1, ageHours - 24),
            views: Math.round(row.views * 0.61),
            ctr: null,
            avgViewPct: row.avgViewPct == null ? null : Number((row.avgViewPct + 0.9).toFixed(1)),
            avgViewDurationS: row.avgViewDurationS,
            subscribersGained:
              row.subscribersGained == null ? null : Math.round(row.subscribersGained * 0.7),
          },
        ],
        retention:
          seed.avgViewPct == null
            ? null
            : {
                points: curve(seed),
                steepestDropOffs: [
                  { ratio: seed.cliff, drop: 0.174 },
                  { ratio: 0.05, drop: 0.088 },
                ],
              },
      },
    ];
  }),
);

export const ledger = {
  channel: { id: 'preview', ytChannelId: 'UC_PREVIEW_ONLY', title: 'Deskbound' },
  recentVideos: [],
  openExperiments: [
    {
      id: 'exp-thumb',
      lever: 'thumbnail',
      hypothesis: 'A single face at 40% frame width beats a product-only thumbnail on this channel.',
      prediction: { ctrPct: 5.2, avgViewPct: 42 },
      status: 'measuring',
      openedAt: hours(-50),
      video: {
        ytVideoId: 'desk-rebuild',
        title: 'I rebuilt my desk for the fourth time',
        thumbnailUrl: thumb('I rebuilt my desk for the fourth time', '#4f6b55'),
      },
      checkpoints: [
        { id: 'cp-1', kind: 't24', dueAt: hours(-26), overdue: true },
        { id: 'cp-2', kind: 't72', dueAt: hours(22), overdue: false },
        { id: 'cp-3', kind: 't7d', dueAt: hours(118), overdue: false },
        { id: 'cp-4', kind: 't28d', dueAt: hours(622), overdue: false },
      ],
    },
    {
      id: 'exp-cadence',
      lever: 'cadence',
      hypothesis: 'Publishing on Tuesday reaches the returning audience before the weekend backlog.',
      prediction: { views: 21000, subscribersGained: 300 },
      status: 'measuring',
      openedAt: days(-12),
      video: {
        ytVideoId: 'monitor-arm',
        title: 'The cheapest good monitor arm',
        thumbnailUrl: thumb('The cheapest good monitor arm', '#3f5f6b'),
      },
      checkpoints: [
        { id: 'cp-5', kind: 't24', dueAt: days(-11), overdue: false },
        { id: 'cp-6', kind: 't72', dueAt: days(-9), overdue: false },
        { id: 'cp-7', kind: 't7d', dueAt: days(-5), overdue: false },
        { id: 'cp-8', kind: 't28d', dueAt: days(16), overdue: false },
      ],
    },
    {
      id: 'exp-hook',
      lever: 'hook',
      hypothesis: 'Opening on the finished build instead of the intro raises the 30-second hold.',
      prediction: { avgViewPct: 47 },
      status: 'open',
      openedAt: hours(-8),
      video: null,
      checkpoints: [],
    },
  ],
  settledExperiments: [
    {
      hypothesis: 'Two-word titles outperform question titles here.',
      lever: 'title',
      verdict: 'refuted',
      prediction: { ctrPct: 6.0, avgViewPct: 44 },
      outcome: { ctrPct: 4.1, avgViewPct: 45.5 },
      closedAt: days(-9),
    },
    {
      hypothesis: 'Publishing Thursday morning beats Sunday evening for first-week views.',
      lever: 'cadence',
      verdict: 'confirmed',
      prediction: { views: 12000 },
      outcome: { views: 15800 },
      closedAt: days(-20),
    },
    {
      hypothesis: 'Cutting the sponsor read to 20 seconds holds the mid-roll audience.',
      lever: 'format',
      verdict: 'confirmed',
      prediction: { avgViewPct: 44 },
      outcome: { avgViewPct: 52.1 },
      closedAt: days(-31),
    },
    {
      hypothesis: 'Price in the title lifts click-through on budget builds.',
      lever: 'title',
      verdict: 'inconclusive',
      prediction: { ctrPct: 5.5 },
      outcome: { ctrPct: 5.6 },
      closedAt: days(-44),
    },
  ],
  channelRules: {
    tenets: [
      claim('Thumbnails with one face and four words or fewer outperform on this channel.', 4, 0, true),
      claim('This audience does not tolerate an intro longer than fifteen seconds.', 3, 0, true),
      claim('Budget builds outperform premium builds by roughly two to one on views.', 5, 1, true),
    ],
    candidates: [
      claim('Videos over 14 minutes lose half the audience before the eight-minute mark.', 2, 1, false),
      claim('Pinned comments asking a question double the reply rate.', 1, 0, false),
      claim('Naming the exact price in the title lifts click-through.', 2, 0, false),
      claim('Shorts published the same day cannibalise the long-form video.', 1, 2, false),
    ],
  },
  dataCoverage: { reachThrough: '2026-08-17', note: 'preview data' },
};

export const activity = [
  {
    checkpointId: 'cp-1',
    kind: 't24',
    dueAt: hours(-26),
    firedAt: hours(-25),
    observedAt: hours(-25),
    observation: { summary: 'CTR 4.1% against a 5.2% call. The face crop is not carrying it.', ctrPct: 4.1 },
    lever: 'thumbnail',
    hypothesis: 'A single face at 40% frame width beats a product-only thumbnail.',
    videoTitle: 'I rebuilt my desk for the fourth time',
    ytVideoId: 'desk-rebuild',
  },
  {
    checkpointId: 'cp-7',
    kind: 't7d',
    dueAt: days(-5),
    firedAt: days(-5),
    observedAt: days(-5),
    observation: { summary: 'Views tracking 12% under the call, but subscribers are ahead. Holding the experiment open.' },
    lever: 'cadence',
    hypothesis: 'Publishing on Tuesday reaches the returning audience first.',
    videoTitle: 'The cheapest good monitor arm',
    ytVideoId: 'monitor-arm',
  },
  {
    checkpointId: 'cp-6',
    kind: 't72',
    dueAt: days(-9),
    firedAt: days(-9),
    observedAt: days(-9),
    observation: { summary: 'CTR came in at 4.9%. Thumbnail is fine; the title is doing the work.' },
    lever: 'cadence',
    hypothesis: 'Publishing on Tuesday reaches the returning audience first.',
    videoTitle: 'The cheapest good monitor arm',
    ytVideoId: 'monitor-arm',
  },
  {
    checkpointId: 'cp-11',
    kind: 't28d',
    dueAt: days(-31),
    firedAt: days(-31),
    observedAt: days(-31),
    observation: { summary: 'Confirmed. Short sponsor reads held 52% average view. Written into memory.' },
    lever: 'format',
    hypothesis: 'Cutting the sponsor read to 20 seconds holds the mid-roll audience.',
    videoTitle: 'Cable management is a lie',
    ytVideoId: 'cable-lie',
  },
  {
    checkpointId: 'cp-12',
    kind: 't7d',
    dueAt: days(-34),
    firedAt: days(-34),
    observedAt: null,
    observation: null,
    lever: 'title',
    hypothesis: 'Price in the title lifts click-through on budget builds.',
    videoTitle: 'Six months with a standing desk',
    ytVideoId: 'standing-desk',
  },
];

export const audience = {
  superfans: [
    { displayName: 'brackets_and_bolts', ytAuthorId: 'a-brackets-and-bolts', commentCount: 14, firstSeenAt: days(-200), lastSeenAt: hours(-30), tenureDays: 200, segment: 'superfan' },
    { displayName: 'Mai', ytAuthorId: 'a-mai', commentCount: 9, firstSeenAt: days(-61), lastSeenAt: hours(-4), tenureDays: 61, segment: 'superfan' },
    { displayName: 'quietdesk', ytAuthorId: 'a-quietdesk', commentCount: 6, firstSeenAt: days(-33), lastSeenAt: hours(-20), tenureDays: 33, segment: 'superfan' },
    { displayName: 'Tobias R.', ytAuthorId: 'a-tobias-r', commentCount: 4, firstSeenAt: days(-118), lastSeenAt: days(-3), tenureDays: 115, segment: 'potential' },
    { displayName: 'no_more_cables', ytAuthorId: 'a-no-more-cables', commentCount: 3, firstSeenAt: days(-9), lastSeenAt: hours(-8), tenureDays: 9, segment: 'potential' },
    { displayName: 'glassdesk_guy', ytAuthorId: 'a-glassdesk-guy', commentCount: 2, firstSeenAt: days(-12), lastSeenAt: days(-10), tenureDays: 2, segment: 'potential' },
  ],
  queue: [
    {
      ytCommentId: 'c1',
      text: 'What arm is that at 6:40? You never said and I have watched this three times looking for it.',
      likeCount: 42,
      publishedAt: hours(-20),
      videoTitle: 'I rebuilt my desk for the fourth time',
      displayName: 'brackets_and_bolts', ytAuthorId: 'a-brackets-and-bolts',
      viewerCommentCount: 14,
      segment: 'superfan' as const,
    },
    {
      ytCommentId: 'c2',
      text: 'The first two minutes are you explaining what you are about to do. Just do it.',
      likeCount: 8,
      publishedAt: hours(-33),
      videoTitle: 'I rebuilt my desk for the fourth time',
      displayName: 'Mai', ytAuthorId: 'a-mai',
      viewerCommentCount: 9,
      segment: 'superfan' as const,
    },
    {
      ytCommentId: 'c3',
      text: 'Please do a follow-up on the lighting one year later. Did the strips hold up?',
      likeCount: 27,
      publishedAt: days(-2),
      videoTitle: 'Fixing my desk lighting for £40',
      displayName: 'quietdesk', ytAuthorId: 'a-quietdesk',
      viewerCommentCount: 6,
      segment: 'superfan' as const,
    },
    {
      ytCommentId: 'c4',
      text: 'Came for the chair rant, stayed for the spreadsheet. More of the spreadsheet please.',
      likeCount: 61,
      publishedAt: days(-4),
      videoTitle: 'You do not need a £1000 chair',
      displayName: 'Tobias R.', ytAuthorId: 'a-tobias-r',
      viewerCommentCount: 4,
      segment: 'potential' as const,
    },
    {
      ytCommentId: 'c5',
      text: 'New here. Algorithm sent me and I stayed for the spreadsheet.',
      likeCount: 5,
      publishedAt: hours(-14),
      videoTitle: 'You do not need a £1000 chair',
      displayName: 'Priya', ytAuthorId: 'a-priya',
      viewerCommentCount: 1,
      segment: 'newcomer' as const,
    },
    {
      ytCommentId: 'c6',
      text: 'That desk is way too small for two monitors, no way this works long term.',
      likeCount: 2,
      publishedAt: hours(-11),
      videoTitle: 'I rebuilt my desk for the fourth time',
      displayName: 'deskskeptic', ytAuthorId: 'a-deskskeptic',
      viewerCommentCount: 1,
      segment: 'newcomer' as const,
    },
  ],
};

export const proposals = [
  {
    id: 'prop-title',
    kind: 'title' as const,
    summary: 'Retitle the desk rebuild — the current one buries the payoff',
    detail: 'I rebuilt my desk for £180 (fourth attempt)',
    rationale:
      'CTR is 4.1% against the 5.2% you predicted. Your channel has confirmed twice that naming the exact price lifts click-through, and the current title hides both the price and the result.',
    options: [
      'I rebuilt my desk for £180 (fourth attempt)',
      'My fourth desk rebuild finally worked',
      'The £180 desk rebuild that stuck',
    ],
    createdAt: hours(-24),
    videoTitle: 'I rebuilt my desk for the fourth time',
    thumbnailUrl: thumb('I rebuilt my desk for the fourth time', '#4f6b55'),
  },
  {
    id: 'prop-reply',
    kind: 'reply' as const,
    summary: 'brackets_and_bolts has asked the same question three times',
    detail:
      'It is the Fully Jarvis arm — I put the exact model in the description now, sorry for making you hunt for it three times.',
    rationale:
      'They have commented 14 times over 200 days, which puts them in the top 1% of this audience. The question is also a video idea: three other comments ask about mounting hardware.',
    options: [],
    createdAt: hours(-19),
    videoTitle: 'I rebuilt my desk for the fourth time',
    thumbnailUrl: thumb('I rebuilt my desk for the fourth time', '#4f6b55'),
  },
];

type SampleComment = {
  ytCommentId: string;
  ytAuthorId: string;
  text: string;
  likeCount: number;
  publishedAt: string;
  triage: string | null;
  displayName: string;
  viewerCommentCount: number;
  segment: 'superfan' | 'potential' | 'newcomer';
};

const COMMENTS: Record<string, SampleComment[]> = {
  'desk-rebuild': [
    { ytCommentId: 'r1', text: 'What arm is that at 6:40? You never said and I have watched this three times looking for it.', likeCount: 42, publishedAt: hours(-20), triage: 'question', displayName: 'brackets_and_bolts', ytAuthorId: 'a-brackets-and-bolts', viewerCommentCount: 14, segment: 'superfan' },
    { ytCommentId: 'r2', text: 'The first two minutes are you explaining what you are about to do. Just do it.', likeCount: 8, publishedAt: hours(-33), triage: 'criticism', displayName: 'Mai', ytAuthorId: 'a-mai', viewerCommentCount: 9, segment: 'superfan' },
    { ytCommentId: 'r3', text: 'Fourth time is the charm honestly. The cable tray fix alone was worth it.', likeCount: 19, publishedAt: hours(-28), triage: null, displayName: 'quietdesk', ytAuthorId: 'a-quietdesk', viewerCommentCount: 6, segment: 'superfan' },
    { ytCommentId: 'r4', text: 'Any chance of a parts list in the description? Would buy the whole thing.', likeCount: 11, publishedAt: hours(-40), triage: 'question', displayName: 'no_more_cables', ytAuthorId: 'a-no-more-cables', viewerCommentCount: 3, segment: 'potential' },
    { ytCommentId: 'r5', text: 'New here. Algorithm sent me and I stayed for the spreadsheet.', likeCount: 5, publishedAt: hours(-14), triage: null, displayName: 'Priya', ytAuthorId: 'a-priya', viewerCommentCount: 1, segment: 'newcomer' },
    { ytCommentId: 'r6', text: 'That desk is way too small for two monitors, no way this works long term.', likeCount: 2, publishedAt: hours(-11), triage: 'criticism', displayName: 'deskskeptic', ytAuthorId: 'a-deskskeptic', viewerCommentCount: 1, segment: 'newcomer' },
    { ytCommentId: 'r7', text: 'Been watching since the chair video. Your builds keep getting cleaner.', likeCount: 23, publishedAt: hours(-44), triage: null, displayName: 'Tobias R.', ytAuthorId: 'a-tobias-r', viewerCommentCount: 4, segment: 'potential' },
  ],
  'monitor-arm': [
    { ytCommentId: 'm1', text: 'Bought it on your word. Holds a 32 inch fine. Thank you.', likeCount: 31, publishedAt: days(-9), triage: null, displayName: 'Mai', ytAuthorId: 'a-mai', viewerCommentCount: 9, segment: 'superfan' },
    { ytCommentId: 'm2', text: 'Does it clamp on a 25mm glass top?', likeCount: 7, publishedAt: days(-10), triage: 'question', displayName: 'glassdesk_guy', ytAuthorId: 'a-glassdesk-guy', viewerCommentCount: 2, segment: 'potential' },
    { ytCommentId: 'm3', text: 'First video of yours. Straight to the point, subscribed.', likeCount: 14, publishedAt: days(-11), triage: null, displayName: 'Hoa', ytAuthorId: 'a-hoa', viewerCommentCount: 1, segment: 'newcomer' },
  ],
  'cable-lie': [
    { ytCommentId: 'c1', text: 'This is the only cable video that admits it never stays tidy. Refreshing.', likeCount: 88, publishedAt: days(-24), triage: null, displayName: 'brackets_and_bolts', ytAuthorId: 'a-brackets-and-bolts', viewerCommentCount: 14, segment: 'superfan' },
    { ytCommentId: 'c2', text: 'Sponsor read was 20 seconds and painless. More of that please.', likeCount: 40, publishedAt: days(-25), triage: null, displayName: 'quietdesk', ytAuthorId: 'a-quietdesk', viewerCommentCount: 6, segment: 'superfan' },
    { ytCommentId: 'c3', text: 'Where did you get the velcro ties?', likeCount: 12, publishedAt: days(-22), triage: 'question', displayName: 'Priya', ytAuthorId: 'a-priya', viewerCommentCount: 1, segment: 'newcomer' },
  ],
};

const CHAT: Record<string, Array<{ role: 'creator' | 'mind'; text: string; at: string }>> = {
  'desk-rebuild': [
    { role: 'creator', text: 'Who is watching this one?', at: hours(-6) },
    {
      role: 'mind',
      text: 'Seven commenters so far: three superfans (brackets_and_bolts, Mai, quietdesk — all with you over 30 days), two potential fans, two first-timers. The superfans are asking for detail, the first-timers are reacting to the format. That split says the video reached beyond your regulars, which the 402k impressions support.',
      at: hours(-6),
    },
    { role: 'creator', text: 'Why did people leave early?', at: hours(-5) },
    {
      role: 'mind',
      text: 'The steepest fall is at 2:29, which is where the sponsor segment starts. Mai said the same thing in the comments without seeing the retention curve. Your channel already has a confirmed rule that this audience will not sit through an intro past fifteen seconds — the same impatience is showing up mid-roll. Sample is one video, so I would test it once more before treating it as settled.',
      at: hours(-5),
    },
  ],
};

export const feed = videos.map((video) => ({
  ytVideoId: video.ytVideoId,
  title: video.title,
  thumbnailUrl: video.thumbnailUrl,
  publishedAt: video.publishedAt,
  durationS: video.durationS,
  views: video.views,
  likes: video.views == null ? null : Math.round(video.views * 0.048),
  ctrPct: video.ctrPct,
  avgViewPct: video.avgViewPct,
  subscribersGained: video.subscribersGained,
  commentCount: (COMMENTS[video.ytVideoId] ?? []).length,
  topComments: (COMMENTS[video.ytVideoId] ?? []).slice(0, 2),
}));

export function postDetail(ytVideoId: string) {
  const post = feed.find((p) => p.ytVideoId === ytVideoId);
  if (!post) return null;
  const detail = videoDetails[ytVideoId] as { retention: unknown } | undefined;

  return {
    post: { ...post, avgViewDurationS: videos.find((v) => v.ytVideoId === ytVideoId)?.avgViewDurationS ?? null },
    comments: COMMENTS[ytVideoId] ?? [],
    retention: detail?.retention ?? null,
  };
}

export const chatFor = (ytVideoId: string) => CHAT[ytVideoId] ?? [];

export const viewers = (() => {
  const seen = new Map<string, { ytAuthorId: string; displayName: string; comments: SampleComment[] }>();
  for (const [videoId, rows] of Object.entries(COMMENTS)) {
    for (const row of rows) {
      const entry = seen.get(row.ytAuthorId) ?? {
        ytAuthorId: row.ytAuthorId,
        displayName: row.displayName,
        comments: [],
      };
      entry.comments.push({ ...row, ytVideoId: videoId } as SampleComment & { ytVideoId: string });
      seen.set(row.ytAuthorId, entry);
    }
  }
  return seen;
})();

export function viewerProfile(ytAuthorId: string) {
  const entry = viewers.get(ytAuthorId);
  if (!entry) return null;

  const rows = entry.comments as Array<SampleComment & { ytVideoId: string }>;
  const stamps = rows.map((row) => new Date(row.publishedAt).getTime());
  const first = new Date(Math.min(...stamps)).toISOString();
  const last = new Date(Math.max(...stamps)).toISOString();
  const count = rows[0]?.viewerCommentCount ?? rows.length;

  return {
    viewer: {
      ytAuthorId,
      displayName: entry.displayName,
      commentCount: count,
      firstSeenAt: count > rows.length ? days(-Math.max(30, count * 14)) : first,
      lastSeenAt: last,
      segment: rows[0]?.segment ?? 'newcomer',
      videosTouched: new Set(rows.map((row) => row.ytVideoId)).size,
      totalLikes: rows.reduce((sum, row) => sum + row.likeCount, 0),
    },
    comments: rows
      .map((row) => ({
        ytCommentId: row.ytCommentId,
        text: row.text,
        likeCount: row.likeCount,
        publishedAt: row.publishedAt,
        triage: row.triage,
        ytVideoId: row.ytVideoId,
        videoTitle: videos.find((v) => v.ytVideoId === row.ytVideoId)?.title ?? row.ytVideoId,
        thumbnailUrl: videos.find((v) => v.ytVideoId === row.ytVideoId)?.thumbnailUrl ?? null,
      }))
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
  };
}

const SEGMENT_LABEL: Record<string, string> = {
  superfan: 'Superfans',
  potential: 'Potential fans',
  newcomer: 'First-time commenters',
};

export function mentionSuggestions(query: string) {
  const needle = query.trim().toLowerCase();
  const match = (text: string) => !needle || text.toLowerCase().includes(needle);

  return [
    ...Object.entries(SEGMENT_LABEL)
      .filter(([, label]) => match(label))
      .map(([id, label]) => ({ kind: 'segment', id, label, detail: 'audience group' })),
    ...[...viewers.values()]
      .filter((entry) => match(entry.displayName))
      .slice(0, 8)
      .map((entry) => ({
        kind: 'viewer',
        id: entry.ytAuthorId,
        label: entry.displayName,
        detail: `${entry.comments.length} comments here`,
      })),
    ...videos
      .filter((video) => match(video.title))
      .slice(0, 6)
      .map((video) => ({
        kind: 'video',
        id: video.ytVideoId,
        label: video.title,
        detail: new Date(video.publishedAt).toISOString().slice(0, 10),
      })),
    ...ledger.openExperiments
      .filter((experiment) => match(experiment.hypothesis))
      .map((experiment) => ({
        kind: 'experiment',
        id: experiment.id,
        label: experiment.hypothesis,
        detail: experiment.status,
      })),
  ];
}
