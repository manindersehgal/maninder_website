import type { Express } from "express";
import type { Server } from "node:http";
import { XMLParser } from "fast-xml-parser";

/* ------------------------------------------------------------------ *
 * em.pod backend
 *  - /api/search        : iTunes podcast search (no key)
 *  - /api/feed          : fetch + parse a single RSS feed (by url or id)
 *  - /api/episodes      : topic -> shows -> recent episodes (ranked)
 *  - /api/stream        : audio proxy w/ Range support (CORS fallback)
 * ------------------------------------------------------------------ */

const ITUNES = "https://itunes.apple.com";
const APPLE_TOP = "https://rss.marketingtools.apple.com/api/v2/us/podcasts/top/20/podcasts.json";

export interface PodShow {
  id: number;
  title: string;
  author: string;
  artwork: string;
  feedUrl: string;
  genres: string[];
  trackCount: number;
}

export interface PodEpisode {
  id: string;
  title: string;
  showTitle: string;
  author: string;
  artwork: string;
  audioUrl: string;
  duration: number; // seconds
  pubDate: string;
  description: string;
  feedUrl: string;
  score?: number;
  transcriptUrls?: string[];
  chapterStart?: number;
  chapterEnd?: number;
  matchText?: string;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  trimValues: true,
  parseAttributeValue: false,
});

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function firstNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function stripHtml(s: unknown): string {
  if (typeof s !== "string") return "";
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchText(url: string, timeoutMs = 12000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "em.pod/1.0 (podcast player; +https://perplexity.ai)",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`feed fetch ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

function parseDuration(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return 0;
  const s = v.trim();
  if (/^\d+$/.test(s)) return parseInt(s, 10) || 0;
  // HH:MM:SS or MM:SS
  const parts = s.split(":").map((p) => parseInt(p, 10) || 0);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

function parseRss(xml: string, showHint?: Partial<PodShow>): PodEpisode[] {
  const parsed = xmlParser.parse(xml);
  const rss = parsed?.rss;
  const channel = rss?.channel;
  if (!channel) return [];

  const showTitle =
    stripHtml(channel.title) || showHint?.title || "Untitled show";
  const author =
    stripHtml(channel["itunes:author"]) ||
    stripHtml(channel.author) ||
    showHint?.author ||
    "";
  const channelArt =
    channel["itunes:image"]?.["@href"] ||
    channel.image?.url ||
    showHint?.artwork ||
    "";

  const items = asArray(channel.item);
  const eps: PodEpisode[] = [];

  for (const item of items) {
    let audioUrl = "";
    if (item.enclosure?.["@url"]) audioUrl = item.enclosure["@url"];
    else if (typeof item.enclosure === "string") audioUrl = item.enclosure;
    if (!audioUrl) continue;

    const title = stripHtml(item.title) || "Untitled episode";
    const pubDate = item.pubDate || "";
    const duration = parseDuration(
      item["itunes:duration"] ?? item.duration ?? 0
    );
    const description =
      stripHtml(item["itunes:summary"]) ||
      stripHtml(item.description) ||
      "";
    const artwork =
      item["itunes:image"]?.["@href"] ||
      item.image?.url ||
      channelArt;
    const transcriptUrls = asArray(item["podcast:transcript"])
      .map((entry: any) =>
        typeof entry === "string" ? entry : entry?.["@url"] || entry?.["#text"] || ""
      )
      .filter((url: string) => /^https?:\/\//i.test(url));

    eps.push({
      id: `${showTitle}::${title}`.slice(0, 200),
      title,
      showTitle,
      author,
      artwork,
      audioUrl,
      duration,
      pubDate,
      description: description.slice(0, 600),
      feedUrl: showHint?.feedUrl || "",
      transcriptUrls,
    });
  }
  return eps;
}

type TranscriptCue = { start: number; end: number; text: string };

function parseClock(value: string): number {
  const parts = value.replace(",", ".").split(":").map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

function parseTranscript(raw: string, contentType: string): TranscriptCue[] {
  if (contentType.includes("json") || raw.trim().startsWith("{")) {
    try {
      const data = JSON.parse(raw);
      const rows = Array.isArray(data) ? data : data.body || data.segments || data.results || [];
      return rows.map((row: any) => ({
        start: Number(row.startTime ?? row.start ?? row.start_time ?? 0),
        end: Number(row.endTime ?? row.end ?? row.end_time ?? 0),
        text: stripHtml(row.body ?? row.text ?? row.content ?? ""),
      })).filter((cue: TranscriptCue) => cue.text && cue.end > cue.start);
    } catch { return []; }
  }

  const cues: TranscriptCue[] = [];
  const blocks = raw.replace(/\r/g, "").split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.split("\n").filter(Boolean);
    const timingIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingIndex < 0) continue;
    const [startRaw, endRaw] = lines[timingIndex].split("-->").map((s) => s.trim().split(/\s+/)[0]);
    const text = stripHtml(lines.slice(timingIndex + 1).join(" "));
    const start = parseClock(startRaw);
    const end = parseClock(endRaw);
    if (text && end > start) cues.push({ start, end, text });
  }
  return cues;
}

async function transcriptCues(url: string): Promise<TranscriptCue[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const response = await fetch(url, { signal: ctrl.signal, redirect: "follow" });
    if (!response.ok) return [];
    return parseTranscript(await response.text(), response.headers.get("content-type") || "");
  } finally { clearTimeout(timer); }
}

function matchingChapters(ep: PodEpisode, cues: TranscriptCue[], term: string): PodEpisode[] {
  const words = term.toLowerCase().split(/\s+/).filter(Boolean);
  const matches: PodEpisode[] = [];
  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    const normalized = cue.text.toLowerCase();
    if (!words.every((word) => normalized.includes(word))) continue;
    const previous = matches[matches.length - 1];
    const start = Math.max(0, cue.start - 8);
    const end = Math.min(ep.duration || cue.end + 25, Math.max(cue.end + 15, cue.start + 35));
    if (previous && start <= (previous.chapterEnd || 0) + 10) {
      previous.chapterEnd = Math.max(previous.chapterEnd || 0, end);
      previous.matchText = `${previous.matchText} ${cue.text}`.slice(0, 320);
      continue;
    }
    matches.push({
      ...ep,
      id: `${ep.id}::${Math.floor(start)}`,
      title: `${term}: ${cue.text}`.slice(0, 110),
      chapterStart: start,
      chapterEnd: end,
      matchText: cue.text.slice(0, 320),
    });
    if (matches.length >= 3) break;
  }
  return matches;
}

function rankEpisodes(eps: PodEpisode[], terms: string[]): PodEpisode[] {
  if (!terms.length) return eps;
  const scored = eps.map((ep) => {
    const hay = `${ep.title} ${ep.description} ${ep.showTitle}`.toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (!t) continue;
      const idx = hay.indexOf(t);
      if (idx === -1) continue;
      score += t.length >= 4 ? 3 : 2;
      if (idx < 80) score += 1; // appears early (likely in title)
      if (ep.title.toLowerCase().includes(t)) score += 2;
    }
    return { ep: { ...ep, score }, score };
  });
  // Keep episodes that match, but also keep a few unmatched recent ones so
  // there's always something to play if matches are sparse.
  const matched = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
  const unmatched = scored
    .filter((s) => s.score === 0)
    .sort(
      (a, b) =>
        new Date(b.ep.pubDate || 0).getTime() -
        new Date(a.ep.pubDate || 0).getTime()
    )
    .slice(0, 4);
  return [...matched, ...unmatched].map((s) => s.ep);
}

export async function registerRoutes(
  _httpServer: Server,
  app: Express
): Promise<Server> {
  /* ---- iTunes search ---- */
  app.get("/api/search", async (req, res) => {
    try {
      const term = String(req.query.term || "").trim();
      if (!term) return res.json({ results: [] as PodShow[] });
      const limit = Math.min(Number(req.query.limit) || 24, 50);
      const url = `${ITUNES}/search?media=podcast&term=${encodeURIComponent(
        term
      )}&limit=${limit}`;
      const r = await fetch(url, { headers: { "User-Agent": "em.pod/1.0" } });
      const data: any = await r.json();
      const results: PodShow[] = (data.results || [])
        .filter((x: any) => x.feedUrl)
        .map((x: any) => ({
          id: x.collectionId,
          title: x.collectionName,
          author: x.artistName,
          artwork:
            x.artworkUrl600 ||
            x.artworkUrl300 ||
            x.artworkUrl100 ||
            "",
          feedUrl: x.feedUrl,
          genres: x.genres || [],
          trackCount: x.trackCount || 0,
        }));
      res.json({ results });
    } catch (e: any) {
      res.status(502).json({ message: e.message });
    }
  });

  /* ---- Apple Podcasts top shows ---- */
  app.get("/api/top-shows", async (_req, res) => {
    try {
      const response = await fetch(APPLE_TOP, { headers: { "User-Agent": "em.pod/1.0" } });
      if (!response.ok) throw new Error(`top shows fetch ${response.status}`);
      const data: any = await response.json();
      const results: PodShow[] = (data.feed?.results || []).map((show: any) => ({
        id: Number(show.id),
        title: show.name || "Untitled show",
        author: show.artistName || "",
        artwork: show.artworkUrl100?.replace("100x100", "600x600") || show.artworkUrl100 || "",
        feedUrl: "",
        genres: (show.genres || []).map((genre: any) => genre.name).filter(Boolean),
        trackCount: 0,
      }));
      res.setHeader("Cache-Control", "public, max-age=900");
      res.json({ results });
    } catch (e: any) {
      res.status(502).json({ message: e.message });
    }
  });

  /* ---- single feed parse ---- */
  app.get("/api/feed", async (req, res) => {
    try {
      let feedUrl = String(req.query.url || "").trim();
      const id = String(req.query.id || "").trim();
      const hint: Partial<PodShow> = {};
      if (!feedUrl && id) {
        // resolve feedUrl from itunes lookup
        const lr = await fetch(
          `${ITUNES}/lookup?id=${encodeURIComponent(id)}`
        );
        const ld: any = await lr.json();
        const x = ld.results?.[0];
        if (!x?.feedUrl)
          return res.status(404).json({ message: "feed not found" });
        feedUrl = x.feedUrl;
        hint.title = x.collectionName;
        hint.author = x.artistName;
        hint.artwork =
          x.artworkUrl600 || x.artworkUrl300 || x.artworkUrl100 || "";
        hint.feedUrl = feedUrl;
      }
      if (!feedUrl) return res.status(400).json({ message: "url or id required" });
      const xml = await fetchText(feedUrl);
      const episodes = parseRss(xml, { feedUrl, ...hint });
      res.json({ feedUrl, episodes });
    } catch (e: any) {
      res.status(502).json({ message: e.message });
    }
  });

  /* ---- topic -> ranked episode queue ---- */
  app.get("/api/episodes", async (req, res) => {
    try {
      const term = String(req.query.term || "").trim();
      if (!term) return res.json({ episodes: [] as PodEpisode[], shows: 0 });
      const limit = Math.min(Number(req.query.limit) || 8, 12);

      const sr = await fetch(
        `${ITUNES}/search?media=podcast&term=${encodeURIComponent(
          term
        )}&limit=${limit}`
      );
      const sd: any = await sr.json();
      const shows: PodShow[] = (sd.results || []).filter((x: any) => x.feedUrl);

      // fetch feeds in parallel (cap concurrency)
      const concurrency = 6;
      const epsPerShow = 8;
      const all: PodEpisode[] = [];
      let idx = 0;
      const worker = async () => {
        while (idx < shows.length) {
          const i = idx++;
          const s = shows[i];
          try {
            const xml = await fetchText(s.feedUrl, 10000);
            let eps = parseRss(xml, {
              feedUrl: s.feedUrl,
              title: s.title,
              author: s.author,
              artwork: s.artwork,
            });
            eps = eps.slice(0, epsPerShow);
            for (const e of eps) {
              e.artwork = e.artwork || s.artwork;
              e.author = e.author || s.author;
            }
            all.push(...eps);
          } catch {
            /* skip broken feed */
          }
        }
      }
      await Promise.all(Array.from({ length: concurrency }, worker));

      const recent = all
        .sort((a, b) => new Date(b.pubDate || 0).getTime() - new Date(a.pubDate || 0).getTime())
        .slice(0, 40);
      res.setHeader("Cache-Control", "public, max-age=300");
      res.json({ episodes: recent, shows: shows.length });
    } catch (e: any) {
      res.status(502).json({ message: e.message });
    }
  });

  /* ---- recent transcript matches -> timestamped chapter stream ---- */
  app.get("/api/topic-stream", async (req, res) => {
    try {
      const term = String(req.query.term || "").trim();
      if (!term) return res.json({ chapters: [], scannedEpisodes: 0 });
      const search = await fetch(`${ITUNES}/search?media=podcast&term=${encodeURIComponent(term)}&limit=16`);
      const data: any = await search.json();
      const shows: PodShow[] = (data.results || []).filter((x: any) => x.feedUrl).map((x: any) => ({
        id: x.collectionId, title: x.collectionName, author: x.artistName,
        artwork: x.artworkUrl600 || x.artworkUrl300 || "", feedUrl: x.feedUrl,
        genres: x.genres || [], trackCount: x.trackCount || 0,
      }));
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const recent: PodEpisode[] = [];
      let showIndex = 0;
      const feedWorker = async () => {
        while (showIndex < shows.length) {
          const show = shows[showIndex++];
          try {
            const eps = parseRss(await fetchText(show.feedUrl, 9000), show)
              .filter((ep) => ep.transcriptUrls?.length && new Date(ep.pubDate).getTime() >= cutoff)
              .slice(0, 3);
            recent.push(...eps);
          } catch { /* skip unavailable feeds */ }
        }
      };
      await Promise.all(Array.from({ length: 6 }, feedWorker));

      const chapters: PodEpisode[] = [];
      let episodeIndex = 0;
      const transcriptWorker = async () => {
        while (episodeIndex < recent.length) {
          const ep = recent[episodeIndex++];
          try {
            const cues = await transcriptCues(ep.transcriptUrls![0]);
            chapters.push(...matchingChapters(ep, cues, term));
          } catch { /* skip malformed transcripts */ }
        }
      };
      await Promise.all(Array.from({ length: 5 }, transcriptWorker));
      chapters.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
      res.json({ chapters: chapters.slice(0, 40), scannedEpisodes: recent.length, shows: shows.length, windowDays: 7 });
    } catch (e: any) {
      res.status(502).json({ message: e.message });
    }
  });

  /* ---- audio stream proxy (Range-aware, CORS fallback) ---- */
  app.get("/api/stream", async (req, res) => {
    let target = String(req.query.url || "").trim();
    if (!target || !/^https?:\/\//i.test(target))
      return res.status(400).json({ message: "valid url required" });

    try {
      const range = req.headers.range;
      const upstream = await fetch(target, {
        headers: {
          "User-Agent": "em.pod/1.0",
          ...(range ? { Range: range } : {}),
          Accept: "audio/*,*/*",
        },
        redirect: "follow",
      });

      const status = upstream.status;
      res.status(status);
      res.setHeader(
        "Content-Type",
        upstream.headers.get("content-type") || "audio/mpeg"
      );
      const cl = upstream.headers.get("content-length");
      if (cl) res.setHeader("Content-Length", cl);
      const cr = upstream.headers.get("content-range");
      if (cr) res.setHeader("Content-Range", cr);
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Access-Control-Allow-Origin", "*");

      if (upstream.body) {
        const reader = upstream.body.getReader();
        const onClose = () => reader.cancel().catch(() => {});
        req.on("close", onClose);
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!res.write(value)) {
              await new Promise<void>((r) => res.once("drain", r));
            }
          }
        } finally {
          res.off("close", onClose);
          res.end();
        }
      } else {
        res.end();
      }
    } catch (e: any) {
      if (!res.headersSent) res.status(502).json({ message: e.message });
    }
  });

  return _httpServer;
}
