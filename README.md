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

### Sandbox Studio

Fast-forward is one of several states that otherwise take a day to arrive. **Sandbox Studio**
— the floating control on the sample channel, `DEMO_MODE=on` only — holds the rest:

| Tab | What it does |
|---|---|
| **Time** | Fires the next checkpoint, puts a simulated stream on the feed, or resets the run — every decided proposal back to pending and everything the sandbox added deleted |
| **Mind** | Holds the Mind at *out of cognition*, *offline* or *too slow*, so the three failure paths can be shown instead of described |
| **Data** | Adds people commenting on a chosen video — questions, criticism or regulars, who arrive with the comment history that earns them the tier — and pushes a proposal straight into the Inbox with the figures you type |

Nothing here reaches YouTube. Rows the sandbox writes are marked in the database, so a reset
is an exact delete rather than a guess; rebuilding the channel itself is still
`npm run seed:demo`.

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

## Run it locally

Node 22 or newer, and a PostgreSQL 17 you can reach. The bundled `docker-compose.yml` is the
quickest way to get one; a native install is just as good.

```bash
npm install && npm --prefix web install
cp .env.example .env
```

Three values in `.env` have no sensible default. Everything else can stay as shipped:

| Key | Value |
|---|---|
| `DATABASE_URL` | `postgres://growth:growth@localhost:5432/growth_compass` matches `docker-compose.yml` |
| `ENCRYPTION_KEY` | `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` |
| `GROWTH_API_TOKEN` | the same command again, for a second and different value |

Set `DEMO_MODE=on`, then bring the database up, fill it, and start:

```bash
docker compose up -d      # PostgreSQL 17 on :5432
npm run setup:db          # apply migrations, then pull the sample channel's public catalogue
npm run build:web         # the API serves web/dist
npm run dev               # http://localhost:8080
```

Open it and choose **Explore with sample data**. No Google account and no API keys are needed
to see the whole product, including Fast-forward and Sandbox Studio.

Working on the interface instead of looking at it: leave `npm run dev` running and start Vite
beside it with `npm --prefix web run dev`, which serves the UI on `:5173` with hot reload and
proxies `/api` and `/auth` to the API. `npm run build:web` is then unnecessary.

### Turning on the parts that need keys

Each of these is independent — the app states in its own interface which ones are off.

| To get | Set | Notes |
|---|---|---|
| A Mind that actually answers | `MINDS_BUILDER_API_KEY` | From hellominds.ai. Without it every answer comes back empty and the app says so |
| A Mind that can call back into the ledger | `PUBLIC_BASE_URL`, and `GROWTH_API_TOKEN` in **My Connections** on hellominds.ai | The Mind cannot reach `localhost`. In development, expose the port with an ngrok static domain: `ngrok http 8080 --domain=<domain>.ngrok-free.app` |
| Real comments and live chat on the sample channel | `YOUTUBE_API_KEY` | YouTube Data API v3, public reads only. The sample channel works without it |
| Your own channel instead of the sample one | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Unlocks **Connect YouTube**. A connected channel is synced from the Analytics API, so none of its numbers are modelled |

`npm run mind` prints the Mind's status — cognition balance, equipped skills and apps, and
what is still missing before it can call the ledger; `npm run mind script` lists the bootstrap
turns and `npm run mind send <turn>` sends one. Every key is documented in
[`.env.example`](.env.example).

## Deploy to Vercel

The repository deploys as it stands: [`vercel.json`](vercel.json) builds the frontend to
`web/dist` for the CDN and routes `/api`, `/auth`, `/v1` and `/health` into a single function
at [`api/index.ts`](api/index.ts), which is the same Hono app the local server runs.

Two settings there are load-bearing and neither is obvious, so they are worth stating before
someone tidies them away:

- **`"framework": null`.** Vercel detects any repository with `hono` in its dependencies and a
  Hono import in `src/app.ts` as a Hono backend, then looks for a server entrypoint inside the
  output directory and fails with *No entrypoint found in output directory: "web/dist"*. Pinning
  the framework to `null` leaves `@vercel/node` for the function and `@vercel/static-build` for
  the frontend, which is the intended split.
- **`typescript` is held at `5.x`.** Vercel's Node builder compiles the function with whichever
  TypeScript the repository provides. On 7.x it emits nothing and the build fails with
  *TypeScript did not emit an output*. Local type checking is unaffected either way.
- **`rewriteRelativeImportExtensions` in [`tsconfig.json`](tsconfig.json).** Every import in
  `src/` carries a `.ts` extension, which `tsx` resolves directly. Vercel's builder emits real
  `.js` files instead, and without this option it copies the `.ts` specifiers into them
  verbatim — the function then builds cleanly and dies on its first request with
  `ERR_MODULE_NOT_FOUND: .../src/app.ts`. Nothing local depends on it.

**1. Provision Postgres** anywhere that speaks the wire protocol — Neon, Vercel Postgres and
Supabase all work. Copy the **pooled** connection string.

**2. Create the schema and the sample channel from your machine**, because the seed pulls a
real channel's catalogue from YouTube and takes longer than a build should:

```bash
# bash
DATABASE_URL='postgres://...pooled...' npm run setup:db

# PowerShell
$env:DATABASE_URL='postgres://...pooled...'; npm run setup:db
```

Environment variables beat `.env`, so this is safe to run beside a local setup.

Or run it from GitHub instead, which needs no machine of yours to be switched on: add
`DATABASE_URL` and `ENCRYPTION_KEY` as repository secrets (Settings → Secrets and variables →
Actions), then trigger **Seed the demo database** from the Actions tab. It applies migrations
and seeds the sample channel against whatever `DATABASE_URL` points at
([`.github/workflows/seed-demo.yml`](.github/workflows/seed-demo.yml)). Use it to reseed
before a demo, too — the sample channel anchors its timestamps to the moment it is seeded, so
a fresh run is what keeps *2 hours ago* saying two hours.

**3. Import the repository** at [vercel.com/new](https://vercel.com/new) and set:

| Variable | Value |
|---|---|
| `DATABASE_URL` | the pooled connection string from step 1 |
| `ENCRYPTION_KEY` | **the same value the seed in step 2 ran under**, and the same on every deploy — the seed encrypts a stored credential with it, and regenerating it signs everyone out |
| `GROWTH_API_TOKEN` | the bearer token the Mind holds in **My Connections** |
| `DEMO_MODE` | `on` |
| `MINDS_BUILDER_API_KEY` | optional; without it the Mind answers nothing |
| `YOUTUBE_API_KEY` | optional; real comments on the sample channel |
| `CRON_SECRET` | any long random string — see below |

Leave `PUBLIC_BASE_URL` unset: the deployment fills it in from its own production domain, so
`GET /v1/openapi.json` already advertises the right host to the Mind. Google's three keys can
be left out entirely; that only hides **Connect YouTube**.

**4. Deploy**, then open the URL and choose **Explore with sample data**. To let the Mind write
back, paste `https://<your-domain>/v1/openapi.json` and the `GROWTH_API_TOKEN` into **My
Connections** on hellominds.ai.

### What differs from the long-running server

A serverless function has no process to hold a timer in, so the checkpoint runner, the nurture
runner and the sample channel's refresher are driven by a scheduled request to
`GET /api/cron/tick`, authenticated with `Authorization: Bearer $CRON_SECRET`. `vercel.json`
registers it as a daily cron, which is the most a Hobby plan allows; on Pro, raise it to
`*/10 * * * *` to match the local poll interval.

This does not affect a demo. **Fast-forward** is a request the browser makes, so it fires a
checkpoint through the same path on Vercel as it does locally. Two Sandbox Studio switches do
depend on process memory and may not survive between requests: the **Mind** tab's failure
states, and the simulated live strip. Everything else in the sandbox — firing checkpoints,
adding commenters, pushing a proposal, resetting the run — is written to the database and
behaves identically.

Set the function's region near the database in **Project → Settings → Functions**; a European
database with a US function pays for the distance on every query.

## Docs

- [Product spec](docs/03-product-spec.md)
- [Integration layer & API contract](docs/05-integration.md) — including the verified limits
  of YouTube's public API and how the demo data is sourced
