import { apiRequest } from "./queryClient";

export interface Show {
  id: number;
  title: string;
  author: string;
  artwork: string;
  feedUrl: string;
  chapterStart?: number;
  chapterEnd?: number;
  matchText?: string;
  genres: string[];
  trackCount: number;
}

export interface Episode {
  id: string;
  title: string;
  showTitle: string;
  author: string;
  artwork: string;
  audioUrl: string;
  duration: number;
  pubDate: string;
  description: string;
  feedUrl: string;
}

export async function searchShows(term: string): Promise<Show[]> {
  const r = await apiRequest("GET", `/api/search?term=${encodeURIComponent(term)}`);
  const d = await r.json();
  return d.results as Show[];
}

export async function fetchEpisodes(term: string): Promise<Episode[]> {
  const r = await apiRequest("GET", `/api/episodes?term=${encodeURIComponent(term)}`);
  const d = await r.json();
  return d.episodes as Episode[];
}

export async function fetchTopicStream(term: string): Promise<{ chapters: Episode[]; scannedEpisodes: number; shows: number }> {
  const r = await apiRequest("GET", `/api/topic-stream?term=${encodeURIComponent(term)}`);
  return await r.json();
}

export async function fetchFeed(
  params: { url?: string; id?: string }
): Promise<{ feedUrl: string; episodes: Episode[] }> {
  const qs = params.url
    ? `url=${encodeURIComponent(params.url)}`
    : `id=${encodeURIComponent(params.id || "")}`;
  const r = await apiRequest("GET", `/api/feed?${qs}`);
  return await r.json();
}
