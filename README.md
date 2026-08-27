# Growth Compass

A persistent YouTube growth strategist built on **Minds by Animoca Brands**.

Submission for **Creative Minds Jam #1: Hong Kong** — track *Audience growth & engagement*.

## The problem

Small and mid-sized YouTubers don't lack data — they lack an organised memory of their own
channel. YouTube Studio, TubeBuddy and VidIQ are dashboards: they show numbers and remember
nothing. Every session starts from zero, so creators repeat experiments they already ran and
miss the 24–72h window where a video's trajectory can still be changed.

## The product

A Mind that runs a **Growth Ledger**:

```
SENSE ──► HYPOTHESIZE ──► COMMIT ──► MEASURE ──► LEARN ──┐
  ▲        3 concepts      creator    T+24h/72h/7d/28d   repeated wins
  │        with numeric    picks one  autonomously       become channel
  └────────predictions                                   Tenets ───────┘
```

It commits to a predicted CTR before you publish, grades itself afterwards without being
asked, and distils repeated wins into rules that live permanently in its Soul. Dashboards
reset. This compounds.

## How the Mind is integral

The Mind is the actor, not a text generator bolted on the side. Two directions of traffic:

**Inbound — the service wakes the Mind.** A checkpoint runner
([`src/mind/checkpoints.ts`](src/mind/checkpoints.ts)) polls for checkpoints that have come
due, refreshes the video from YouTube, computes which committed metric fell short, and sends
the Mind a brief naming the shortfall, the retention drop-offs, and what it is expected to do
about them. Nobody asks it to. The creator is asleep.

**Outbound — the Mind acts through a tool API.** `/v1` ([`src/routes/mind.ts`](src/routes/mind.ts))
is 21 endpoints published to the Mind as an OpenAPI tool
([`GET /v1/openapi.json`](src/openapi.ts)). The Mind decides and writes:

| The Mind calls | To do |
|---|---|
| `POST /v1/experiments` | open a test with a numeric prediction attached |
| `POST /v1/checkpoints/:id/observe` | grade predicted against observed |
| `POST /v1/learnings` | record a pattern it believes it has found |
| `POST /v1/learnings/:id/promoted` | promote it to a channel Tenet |
| `POST /v1/proposals` | put a decision in front of the creator |
| `POST /v1/comments/:id/triage` | classify a comment as question, criticism or praise |
| `GET /v1/channels/:id/context` | read back everything it has learned about this channel |

The judgement stays in the Mind, not in our code. "A pattern needs at least three confirming
experiments before it earns Tenet status" is a rule in its Soul
([`dev/mind-bootstrap.ts`](dev/mind-bootstrap.ts)), not a database constraint — the API only
records the decision the Mind reached. Remove the Mind and the ledger has nobody to write it.

Authentication is a bearer token the Mind holds in **My Connections** on hellominds.ai. It
cannot change anything on YouTube: every action ends as a proposal the creator approves.

## The three required properties

| Property | Where it lives | How to see it |
|---|---|---|
| **Memory** | Tenets and candidate rules, each carrying its evidence count and the experiments that support it | **Tests** screen — rules with `2/3 confirmed`, and the accuracy chart showing prediction error falling as the ledger grows |
| **Continuity** | One conversation per video, held across sessions; the Mind reads its own prior turns and the channel context before answering | **Ask about this video** — the Mind refers back to what it committed to last time, by number |
| **Autonomous follow-up** | The checkpoint runner fires at T+24h/72h/7d/28d with no human trigger; proposals appear in the Inbox unprompted | **Inbox** — decisions that arrived while nobody was looking, and the activity trail beneath them |

### Seeing autonomy in three minutes

The loop runs on YouTube's clock — a checkpoint is due 24 hours after publication. Nobody
evaluating this has 24 hours, so the sample channel carries a **Fast-forward** button in the
banner. It brings the next checkpoint forward and runs it through the same path the runner
uses; the only thing skipped is the wait. The Mind is briefed, reads the numbers, and its
proposal lands in the Inbox.

## What is real and what is modelled

The sample channel mirrors a real one — [Hardware Haven](https://www.youtube.com/@HardwareHaven)
by default, set by `DEMO_SOURCE_CHANNEL`. This split is stated in the app itself, on the
banner and on every affected column:

| Read live from YouTube | Modelled |
|---|---|
| video ids, titles, descriptions, thumbnails, publish dates | impressions, click-through rate |
| view and like counts, refreshed every 10 minutes | average view percentage |
| real durations | the retention curve |
| live broadcast state and concurrent viewers | |
| comments, and live chat messages (with `YOUTUBE_API_KEY`) | |

The modelled figures are the ones YouTube gives **only to the channel's owner** — the
Analytics API answers `UNAUTHENTICATED` to anything but the owner's own OAuth token. They are
derived deterministically from the real counts in [`src/demo.ts`](src/demo.ts), never randomly,
so they track reality as it moves. Connect your own channel and all of them are real.

## Run it

```bash
npm install && npm --prefix web install
docker compose up -d              # PostgreSQL 17
npm run migrate
npm run seed:demo                 # pulls a real channel's public catalogue
DEMO_MODE=on npm run dev
```

Open the app and pick **Explore with sample data**. No Google account needed. With
`MINDS_BUILDER_API_KEY` set, asking the Mind about that channel reaches your real Mind.

To drive a real channel instead, set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and
`GOOGLE_REDIRECT_URI` and connect through Google's consent window. A connected channel is
always synced from the Analytics API; the sample channel is the only one that is not.

Configuration is documented in [`.env.example`](.env.example).

## Docs

- [Hackathon brief & judging criteria](docs/00-hackathon-brief.md)
- [Minds platform cheat sheet](docs/01-minds-platform.md)
- [Builder Tools: CLI, client library, API](docs/02-builder-tools.md)
- [Product spec](docs/03-product-spec.md)
- [Scoring strategy & build plan](docs/04-scoring-and-plan.md)
- [Integration layer & API contract](docs/05-integration.md) — including the verified limits
  of YouTube's public API and how the demo data is sourced
