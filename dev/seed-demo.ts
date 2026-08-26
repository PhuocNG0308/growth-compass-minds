import { sql } from '../src/db/client.ts';
import * as chat from '../src/db/chat.ts';
import * as repo from '../src/db/repo.ts';
import { encrypt } from '../src/crypto.ts';
import { DEMO_YT_CHANNEL_ID } from '../src/demo.ts';
import { env } from '../src/env.ts';
import { pullPublicChannel, resolveSource } from '../src/youtube/public-sync.ts';

// The PRNG is seeded so the shape of the channel — which videos, who comments where, every
// metric — is identical on every run. Timestamps are the deliberate exception: they are
// anchored to the moment you seed, because a fixed anchor turns "2 hours ago" into "9 days
// ago" a week later and the demo stops looking like a live channel.
function prng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = prng(20260821);
const pick = <T>(items: readonly T[]) => items[Math.floor(rand() * items.length)]!;
const between = (low: number, high: number) => low + rand() * (high - low);
const wobble = (value: number, spread: number) => value * (1 + between(-spread, spread));

const HOUR = 3_600_000;
const NOW = Date.now();
const at = (hoursAgo: number) => new Date(NOW - hoursAgo * HOUR);
const ageHours = (published: Date) => Math.round((NOW - published.getTime()) / HOUR);

const NAMES = [
  'brackets_and_bolts', 'Mai', 'quietdesk', 'Tobias R.', 'no_more_cables', 'glassdesk_guy',
  'Priya', 'deskskeptic', 'wiremonkey', 'Sam O.', 'the_tidy_one', 'Hoang', 'benchtop',
  'Ana Lu', 'cable_gremlin', 'Rin', 'monitorstand', 'Jules', 'flatpack_fan', 'Devi',
  'oakandsteel', 'Kwame', 'shelfhelp', 'Noor', 'plugsocket', 'Théo', 'deskrat', 'Yuki',
  'clamp_life', 'Marcus B.', 'roomtone', 'Sena', 'boltcutter', 'Liv', 'undermount',
  'Ibrahim', 'greenscreen_guy', 'Chi', 'twoscreens', 'Petra',
];

const HANDLE_PARTS = [
  ['quiet', 'flat', 'oak', 'steel', 'cable', 'bolt', 'shelf', 'desk', 'wire', 'lamp', 'monitor', 'clamp'],
  ['pack', 'works', 'bench', 'stack', 'corner', 'tray', 'arm', 'nerd', 'life', 'club', 'lab', 'notes'],
] as const;

/** The named people plus enough handles to make the long tail behave like a real channel. */
function audience(): string[] {
  const generated = HANDLE_PARTS[0].flatMap((head) =>
    HANDLE_PARTS[1].map((tail) => `${head}${tail}`),
  );
  return [...NAMES, ...generated];
}

const COMMENTS = [
  'What is the part you used at 6:40? You never said and I have watched this three times looking for it.',
  'The first two minutes are you explaining what you are about to do. Just do it.',
  'Please do a follow-up on this one in a year. Did it hold up?',
  'Came for the rant, stayed for the spreadsheet. More of the spreadsheet please.',
  'New here. Algorithm sent me and I stayed.',
  'No way this works long term, but I want to be proved wrong.',
  'Finally someone measured it instead of guessing.',
  'I bought the cheap one on your advice and it has been fine for eight months.',
  'The bit at the end where you admit it did not work is why I subscribe.',
  'Could you show the inside? That is the part nobody films.',
  'This is the third video where you mention it in passing. Just review it already.',
  'Disagree on this one. Mine was worth every penny.',
  'Watched at 2x and still got everything. Good pacing.',
  'What is the actual model number? The description does not say.',
  'You have talked me out of buying something for the fourth time. Thank you.',
  'The lighting in this one looks noticeably better than the last.',
  'Honestly the intro music is too loud compared to your voice.',
  'Came back to say I did this and it took me two hours, not forty minutes.',
  'Any chance of a version of this for a smaller budget?',
  'The price comparison at 4:10 is the most useful thing on this channel.',
];

const HYPOTHESES = [
  ['thumbnail', 'A single face at 40% frame width beats a product-only thumbnail on this channel.'],
  ['cadence', 'Publishing on Tuesday reaches the returning audience before the weekend backlog.'],
  ['hook', 'Opening on the finished build instead of the intro raises the 30-second hold.'],
  ['title', 'Naming the exact price in the title lifts click-through on budget builds.'],
  ['format', 'Cutting the sponsor read to 20 seconds holds the mid-roll audience.'],
  ['format', 'Keeping the video under nine minutes protects average view percentage.'],
] as const;

const TENETS = [
  'Thumbnails with one face and four words or fewer outperform on this channel.',
  'This audience does not tolerate an intro longer than fifteen seconds.',
  'Budget builds outperform premium builds by roughly two to one on views.',
];

const CANDIDATES = [
  'Videos over 14 minutes lose half the audience before the eight-minute mark.',
  'Pinned comments asking a question double the reply rate.',
  'Shorts published the same day cannibalise the long-form video.',
];

async function main() {
  const source = await resolveSource(env.DEMO_SOURCE_CHANNEL);
  console.log(`seeding ${DEMO_YT_CHANNEL_ID} from ${source.title} (${source.handle}) …`);

  // cascade clears videos, comments, experiments, chat and everything hanging off them
  await sql`delete from channels where yt_channel_id = ${DEMO_YT_CHANNEL_ID}`;

  const channel = await repo.upsertChannel({
    ytChannelId: DEMO_YT_CHANNEL_ID,
    title: source.title,
    refreshToken: encrypt('demo-channel-has-no-google-token'),
  });
  await repo.setReachSyncedThrough(channel.id, new Date(NOW - 2 * 24 * HOUR).toISOString().slice(0, 10));

  const pulled = await pullPublicChannel(channel.id, source, { backfill: true });
  if (pulled.videos.length === 0) {
    throw new Error(
      `no videos came back for ${source.handle}. The feed edge fails intermittently — run it again.`,
    );
  }

  // newest first, the way every screen in the app orders a catalogue
  const videos = [...pulled.videos].sort(
    (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime(),
  );

  // a key buys real comments from real people; without one the audience has to be invented,
  // and saying which of the two happened is the whole point of the banner
  if (pulled.comments === 0) await seedComments(channel.id, videos);
  console.log(
    pulled.comments > 0
      ? `  ${pulled.comments} real comments from YouTube`
      : '  comments are modelled — set YOUTUBE_API_KEY for real ones',
  );
  const experiments = await seedExperiments(channel.id, videos);
  await seedLearnings(channel.id, experiments);
  await seedProposals(channel.id, videos);
  await seedChat(channel.id, videos);

  const [tally] = await sql<Array<Record<string, string>>>`
    select
      (select count(*) from videos where channel_id = ${channel.id}) as videos,
      (select count(*) from snapshots s join videos v on v.id = s.video_id
        where v.channel_id = ${channel.id}) as snapshots,
      (select count(*) from viewers where channel_id = ${channel.id}) as viewers,
      (select count(*) from comments c join videos v on v.id = c.video_id
        where v.channel_id = ${channel.id}) as comments,
      (select count(*) from experiments where channel_id = ${channel.id}) as experiments,
      (select count(*) from checkpoints cp join experiments e on e.id = cp.experiment_id
        where e.channel_id = ${channel.id}) as checkpoints,
      (select count(*) from learnings where channel_id = ${channel.id}) as learnings,
      (select count(*) from proposals where channel_id = ${channel.id}) as proposals,
      (select count(*) from chat_messages m join chat_threads th on th.id = m.thread_id
        where th.channel_id = ${channel.id}) as messages`;

  console.log(Object.entries(tally!).map(([key, value]) => `  ${value} ${key}`).join('\n'));
  console.log('\n  Set DEMO_MODE=on and open the app — "Explore with sample data".\n');
  await sql.end();
}

type SeededVideo = { id: string; ytVideoId: string; title: string; publishedAt: Date; durationS: number };

async function seedComments(channelId: string, videos: SeededVideo[]) {
  const people = audience().map((displayName, index) => ({
    displayName,
    ytAuthorId: `demo-viewer-${index.toString().padStart(3, '0')}`,
    // a real channel is a long tail: a dozen regulars carry most of the comment volume
    appetite: index < 12 ? between(0.5, 0.85) : index < 45 ? between(0.12, 0.32) : between(0.02, 0.09),
  }));

  const batch: Parameters<typeof repo.upsertComments>[1] = [];
  let serial = 0;

  for (const video of videos) {
    for (const person of people) {
      if (rand() > person.appetite) continue;
      batch.push({
        ytAuthorId: person.ytAuthorId,
        displayName: person.displayName,
        ytCommentId: `demo-comment-${(serial += 1).toString().padStart(4, '0')}`,
        videoId: video.id,
        text: pick(COMMENTS),
        likeCount: Math.round(between(0, 70)),
        // comments trail the upload, but a video published two days ago cannot have
        // comments from next week
        publishedAt: new Date(
          Math.min(NOW - between(0.5, 6) * HOUR, video.publishedAt.getTime() + between(1, 240) * HOUR),
        ),
      });
    }
  }

  await repo.upsertComments(channelId, batch);

  // a few already answered, so the reply queue is not the whole comment list
  await sql`
    update comments set replied_at = least(now(), published_at + interval '6 hours'),
                        reply_text = 'Good spot — it is in the description now.',
                        triage = 'answered'
    where yt_comment_id in (
      select c.yt_comment_id from comments c
        join videos v on v.id = c.video_id
      where v.channel_id = ${channelId}
      order by c.published_at desc offset 8 limit 40
    )`;
}

async function seedExperiments(channelId: string, videos: SeededVideo[]) {
  const created: Array<{ id: string; closed: boolean }> = [];

  for (const [index, [lever, hypothesis]] of HYPOTHESES.entries()) {
    const video = videos[index]!;
    const closed = index >= 3;
    const predictedCtr = Number(between(4.2, 6.8).toFixed(1));
    const predictedAvp = Number(between(34, 49).toFixed(1));

    const experiment = await repo.createExperiment({
      channelId,
      videoId: index === 2 ? null : video.id,
      lever,
      hypothesis,
      prediction: { ctrPct: predictedCtr, avgViewPct: predictedAvp },
    });

    const openedAt = at(closed ? 900 + index * 240 : 40 + index * 60);
    await sql`update experiments set opened_at = ${openedAt} where id = ${experiment.id}`;

    if (closed) {
      // Two things have to hold at once. The verdict must follow the numbers — a "refuted"
      // row next to an outcome that beat its prediction is incoherence a creator spots
      // instantly. And the error has to shrink as the experiments get more recent, because
      // a ledger that never gets better at its own channel is not worth keeping.
      // index 5 is the oldest of the closed three, index 3 the newest.
      const verdict = (['inconclusive', 'confirmed', 'refuted'] as const)[index - 3]!;
      const shift =
        verdict === 'confirmed'
          ? between(0.07, 0.13)
          : verdict === 'refuted'
            ? -between(0.18, 0.28)
            : between(-0.02, 0.02);

      await sql`
        update experiments
        set status = 'closed', verdict = ${verdict},
            outcome = ${sql.json({
              ctrPct: Number((predictedCtr * (1 + shift)).toFixed(2)),
              avgViewPct: Number((predictedAvp * (1 + shift * 0.7)).toFixed(2)),
            })},
            closed_at = ${at(200 + index * 90)}
        where id = ${experiment.id}`;
    }

    if (index !== 2) await seedCheckpoints(experiment.id, openedAt, closed, predictedCtr);
    created.push({ id: experiment.id, closed });
  }

  return created;
}

async function seedCheckpoints(
  experimentId: string,
  openedAt: Date,
  closed: boolean,
  predictedCtr: number,
) {
  const kinds = [
    ['t24', 24],
    ['t72', 72],
    ['t7d', 168],
    ['t28d', 672],
  ] as const;

  const rows = await repo.createCheckpoints(
    experimentId,
    kinds.map(([kind, offset]) => ({
      kind,
      dueAt: new Date(openedAt.getTime() + offset * HOUR),
    })),
  );

  for (const row of rows) {
    const due = row.dueAt.getTime();
    if (due > NOW) continue;

    // an overdue checkpoint on a live experiment is what "the Mind still owes you a reading"
    // looks like on the dashboard, so leave the newest one unobserved
    const overdue = !closed && due > NOW - 48 * HOUR;
    if (overdue) continue;

    await sql`
      update checkpoints
      set fired_at = ${new Date(due + 6 * 60_000)},
          observed_at = ${new Date(due + 11 * 60_000)},
          observation = ${sql.json({
            summary: `Read at ${row.kind}: click-through ${wobble(predictedCtr, 0.16).toFixed(1)}%, tracking ${rand() > 0.45 ? 'above' : 'below'} the prediction.`,
            ctrPct: Number(wobble(predictedCtr, 0.16).toFixed(2)),
          })}
      where id = ${row.id}`;
  }
}

async function seedLearnings(channelId: string, experiments: Array<{ id: string; closed: boolean }>) {
  const settled = experiments.filter((item) => item.closed).map((item) => item.id);

  for (const [index, statement] of TENETS.entries()) {
    const learning = await repo.upsertLearning({
      channelId,
      statement,
      lever: 'thumbnail',
      experimentId: settled[index % settled.length]!,
    });
    await sql`
      update learnings
      set evidence_count = ${3 + index}, contradiction_count = ${index === 2 ? 1 : 0},
          supporting_experiments = ${settled}::uuid[],
          promoted_to_tenet_at = ${at(120 + index * 200)},
          created_at = ${at(900 + index * 200)}
      where id = ${learning.id}`;
  }

  for (const [index, statement] of CANDIDATES.entries()) {
    const learning = await repo.upsertLearning({
      channelId,
      statement,
      lever: 'format',
      experimentId: settled[index % settled.length]!,
    });
    await sql`
      update learnings set evidence_count = ${index === 0 ? 2 : 1}, contradiction_count = ${index === 2 ? 2 : 0}
      where id = ${learning.id}`;
  }
}

/**
 * Every proposal names a video the creator can open and check. The numbers quoted come back
 * out of the database rather than being written here, because a proposal that cites a drop
 * the retention chart does not show is the fastest way to lose a creator's trust.
 */
async function seedProposals(channelId: string, videos: SeededVideo[]) {
  const [newest, second] = videos;
  const drop = await steepestDrop(second!.id, second!.durationS);
  const asked = await openQuestion(videos);

  const drafts = [
    {
      kind: 'title' as const,
      videoId: newest!.id,
      summary: `Retitle "${newest!.title}" \u2014 click-through is under what I predicted`,
      detail:
        'Put the number or the outcome in the first four words. This title asks the viewer to guess what they get.',
      rationale:
        'This channel has confirmed twice that a concrete claim early in the title lifts click-through. The current one names neither the result nor the cost.',
      options: ['Lead with the number', 'Lead with the outcome', 'Lead with the question it answers'],
    },
    {
      kind: 'hook' as const,
      videoId: second!.id,
      summary: `Move the payoff forward in "${second!.title}"`,
      detail: 'Open on the result, then cut back to the setup.',
      rationale: drop
        ? `The steepest drop on this video is at ${drop.at}, and it costs ${drop.lost} points in one step. Two earlier videos improved when the payoff came first.`
        : 'Two earlier videos improved when the payoff came first, and nothing in this one arrives before the two-minute mark.',
      options: [],
    },
    {
      kind: 'experiment' as const,
      videoId: null,
      summary: 'Open a test on video length before the next upload',
      detail: 'Hold everything else constant and let length be the only thing that moves.',
      rationale:
        'Three videos over 14 minutes lost half the audience before minute eight. That is two confirmations short of a rule, and one clean test would settle it.',
      options: [],
      payload: {
        lever: 'format',
        ytVideoId: null,
        concepts: [
          {
            label: 'Under nine minutes',
            hypothesis: 'Cutting the next video under nine minutes protects average view percentage.',
            prediction: { avgViewPct: 47.5, ctrPct: 5.4 },
          },
          {
            label: 'Under twelve minutes',
            hypothesis: 'Twelve minutes is the real ceiling, not nine.',
            prediction: { avgViewPct: 44, ctrPct: 5.4 },
          },
          {
            label: 'No length constraint',
            hypothesis: 'Length is not what moves retention on this channel; the hook is.',
            prediction: { avgViewPct: 41, ctrPct: 5.4 },
          },
        ],
      },
    },
    ...(asked
      ? [
          {
            kind: 'reply' as const,
            videoId: asked.videoId,
            summary: `Answer ${asked.comment.displayName} \u2014 the same thing has been asked more than once`,
            detail: 'It is in the description now, sorry \u2014 answering once publicly closes the rest.',
            rationale: `They asked: "${asked.comment.text}" Returning viewers who get an answer come back at roughly twice the rate.`,
            options: [],
          },
        ]
      : []),
  ];

  for (const draft of drafts) {
    // the route mirrors concept labels into options; going straight through the repo has to
    // do the same or the creator has nothing to pick between
    const options = draft.payload ? draft.payload.concepts.map((c) => c.label) : draft.options;
    await repo.createProposal({ channelId, ...draft, options });
  }
}

/** Read back what the retention chart will draw, so the proposal and the chart agree. */
async function steepestDrop(
  videoId: string,
  durationS: number,
): Promise<{ at: string; lost: string } | null> {
  const curve = await repo.latestRetention(videoId);
  if (!curve || curve.length < 2) return null;

  const worst = curve
    .slice(1)
    .map((point, index) => ({ ratio: point.ratio, drop: curve[index]!.watchRatio - point.watchRatio }))
    .sort((a, b) => b.drop - a.drop)[0];
  if (!worst || worst.drop <= 0) return null;

  const seconds = Math.round(worst.ratio * durationS);
  return {
    at: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`,
    lost: (worst.drop * 100).toFixed(1),
  };
}

/**
 * A question the creator can go and read beats an invented one. Which video it sits on is
 * not something to force: the proposal follows the question, newest video first.
 */
async function openQuestion(videos: SeededVideo[]) {
  for (const video of videos) {
    const rows = await repo.commentsForVideo(video.id, 60);
    const comment = rows.find((row) => row.repliedAt == null && row.text.includes('?'));
    if (comment) return { videoId: video.id, comment };
  }
  return null;
}

async function seedChat(channelId: string, videos: SeededVideo[]) {
  const [newest, second] = videos;

  const conversations = [
    {
      video: newest!,
      turns: [
        ['creator', `Why is click-through down on "${newest!.title}" compared to the one before it?`],
        [
          'mind',
          'Two things separate them. The one before named a concrete claim in four words; this title is longer and names no outcome. The other difference is the thumbnail \u2014 the earlier one had a face at roughly 40% of the frame, this one is product-only. That pairing has now cost you click-through three times, which is why it is a Tenet and not a hunch.',
        ],
        ['creator', 'So retitle it?'],
        [
          'mind',
          'Retitle it, and leave the thumbnail alone this week \u2014 changing both at once means neither result tells you anything. I have written the title proposal; it is waiting for you.',
        ],
      ],
    },
    {
      video: second!,
      turns: [
        ['creator', `Pick up where we left off on "${second!.title}".`],
        [
          'mind',
          'Last time we agreed to hold the intro to fifteen seconds and watch the 30-second hold. It landed within half a point of what I predicted, and I am not claiming credit for that \u2014 it was close enough to be luck. The drop in the opening stretch is still there, which is the third video in a row showing it.',
        ],
      ],
    },
  ];

  for (const conversation of conversations) {
    const thread = await chat.ensureThread({
      channelId,
      subjectKind: 'video',
      subjectId: conversation.video.ytVideoId,
      alias: `post-${conversation.video.ytVideoId}`,
      title: conversation.video.title,
    });

    for (const [role, body] of conversation.turns) {
      await chat.appendMessage(thread.id, role as 'creator' | 'mind', body!);
    }

    // spread the turns back over two weeks so "remembered across sessions" is visible
    await sql`
      update chat_messages set created_at = ${at(340)} + (row_number * interval '3 days')
      from (
        select id, row_number() over (order by created_at) as row_number
        from chat_messages where thread_id = ${thread.id}
      ) ordered
      where chat_messages.id = ordered.id`;
    await sql`
      update chat_threads set last_message_at = (
        select max(created_at) from chat_messages where thread_id = ${thread.id}
      ), created_at = ${at(340)} where id = ${thread.id}`;
  }
}

await main();
