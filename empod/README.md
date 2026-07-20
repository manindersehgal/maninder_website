# em.pod

An Apple Podcasts–style podcast player that plays every podcast about a topic you choose, plus deep-link audio streams.

## Features

- **Topic listening** — type any topic; em.pod searches podcasts (iTunes API), fetches each show's RSS feed, ranks episodes that actually mention your topic, and queues them up. Hit **Play all** to listen back-to-back.
- **Deep-link streams** — paste any direct audio URL (mp3, m4a, aac…) to play instantly. Share `?stream=<url>` to auto-load. Falls back to a Range-aware stream proxy if a host blocks cross-origin audio.
- **Player** — play/pause, seek, skip ±15s, speed (0.75–2×), volume, up-next queue, live equalizer.
- **Apple Podcasts look** — purple accent, sidebar + now-playing bar, dark/light mode, mobile tab nav.

## Stack

React + Vite + Tailwind (frontend) / Express (backend) / iTunes Search API + RSS parsing / HTML5 audio.

## Run locally

```bash
npm install
npm run dev      # starts Express + Vite on http://localhost:5000
```

## Build

```bash
npm run build           # outputs dist/ (server) + dist/public (static)
NODE_ENV=production node dist/index.cjs
```

## How it works

- `GET /api/search?term=<topic>` — iTunes podcast search (no API key needed).
- `GET /api/episodes?term=<topic>` — searches shows, fetches their RSS feeds server-side, parses episodes, ranks by topic relevance, returns a cross-show queue.
- `GET /api/feed?url=<rss>&id=<itunesId>` — fetch + parse a single feed.
- `GET /api/stream?url=<audio>` — Range-aware audio proxy for CORS-blocked hosts.

Topic search is capped (top ~18 shows, up to 60 ranked episodes) for speed.
