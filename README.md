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
screens — overview, experiments, videos with retention curves, audience, and the rules
the channel has taught the Mind. No CLI in the end-user path. Skills and the Telegram
surface are next.

## Look at it

```bash
npm install && npm --prefix web install
npm run preview
```

Opens straight into the dashboard on sample data — no database, no Google, no Mind.

## Docs

- [Hackathon brief & judging criteria](docs/00-hackathon-brief.md)
- [Minds platform cheat sheet](docs/01-minds-platform.md)
- [Builder Tools: CLI, client library, API](docs/02-builder-tools.md)
- [Product spec](docs/03-product-spec.md)
- [Scoring strategy & build plan](docs/04-scoring-and-plan.md)
- [Integration layer & API contract](docs/05-integration.md)
