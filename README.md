# Channel Compass *(working title)*

A persistent YouTube growth strategist built on **Minds by Animoca Brands**.

Submission for **Creative Minds Jam #1: Hong Kong** — track *Audience growth & engagement*.

## The problem

Small and mid-sized YouTubers don't lack data — they lack an organised memory of their own channel. YouTube Studio, TubeBuddy and VidIQ are dashboards: they show numbers and remember nothing. Every session starts from zero, so creators repeat experiments they already ran and miss the 24–48h window where a video's trajectory can still be changed.

## The product

A Mind that runs a **Growth Ledger**:

```
SENSE ──► HYPOTHESIZE ──► COMMIT ──► MEASURE ──► LEARN ──┐
  ▲        3 concepts      creator    T+24h/7d/28d   repeated wins
  │        with numeric    picks one  autonomously   become channel
  └────────predictions                               Tenets ────────┘
```

It commits to a predicted CTR before you publish, grades itself afterwards without being asked, and distils repeated wins into rules that live permanently in its Soul. Dashboards reset. This compounds.

## Status

The integration layer between the Mind, YouTube, and the long-term memory store is
implemented in [src/](src/), with a creator-facing frontend in [web/](web/) built on
React, Tailwind and shadcn/ui:
connect a channel through Google's own consent window, then read the ledger across five
screens — feed, inbox, tests, memory, and audience: the videos with their retention curves,
the proposals waiting on you, the ledger of predictions graded against reality, and the
trail of everything the Mind has remembered. No CLI in the end-user path. Skills and the Telegram
surface are next.

## Look at it

```bash
npm install && npm --prefix web install
docker compose up -d              # PostgreSQL 17
npm run migrate
npm run seed:demo                 # a generated channel: 24 videos, 146 viewers, 552 comments
DEMO_MODE=on npm run dev
```

Open the app and pick **Explore with sample data**. It signs you into a generated channel
that runs through the same code path as a real one — same queries, same screens — with
syncing and comment replies locked. No Google account needed. If `MINDS_BUILDER_API_KEY` is
set, asking the Mind about that sample data reaches your real Mind.

## Docs

- [Hackathon brief & judging criteria](docs/00-hackathon-brief.md)
- [Minds platform cheat sheet](docs/01-minds-platform.md)
- [Builder Tools: CLI, client library, API](docs/02-builder-tools.md)
- [Product spec](docs/03-product-spec.md)
- [Scoring strategy & build plan](docs/04-scoring-and-plan.md)
- [Integration layer & API contract](docs/05-integration.md)
