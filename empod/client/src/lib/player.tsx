import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

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
  chapterStart?: number;
  chapterEnd?: number;
  matchText?: string;
}

interface PlayerState {
  queue: Episode[];
  index: number;
  current: Episode | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  rate: number;
  loading: boolean;
  error: string | null;
  usingProxy: boolean;
  playEpisode: (ep: Episode, queue?: Episode[]) => void;
  playQueue: (eps: Episode[], startIndex?: number) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (t: number) => void;
  skip: (delta: number) => void;
  setRate: (r: number) => void;
  setVolume: (v: number) => void;
  volume: number;
  removeFromQueue: (i: number) => void;
  clearQueue: () => void;
  jumpTo: (i: number) => void;
}

const Ctx = createContext<PlayerState | null>(null);

export function usePlayer() {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePlayer outside provider");
  return v;
}

function proxyUrl(u: string) {
  return `/api/stream?url=${encodeURIComponent(u)}`;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [queue, setQueue] = useState<Episode[]>([]);
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRateState] = useState(1);
  const [volume, setVolumeState] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingProxy, setUsingProxy] = useState(false);

  const triedProxyRef = useRef(false);

  // init audio element once
  if (!audioRef.current && typeof Audio !== "undefined") {
    audioRef.current = new Audio();
    audioRef.current.preload = "metadata";
  }

  const current = queue[index] || null;

  // load a source
  const load = (ep: Episode, proxy: boolean, autoplay: boolean) => {
    const a = audioRef.current;
    if (!a) return;
    setError(null);
    setUsingProxy(proxy);
    setLoading(true);
    triedProxyRef.current = proxy;
    a.src = proxy ? proxyUrl(ep.audioUrl) : ep.audioUrl;
    const seekToChapter = () => {
      if (ep.chapterStart !== undefined) a.currentTime = ep.chapterStart;
      a.removeEventListener("loadedmetadata", seekToChapter);
    };
    a.addEventListener("loadedmetadata", seekToChapter);
    a.playbackRate = rate;
    if (autoplay) {
      a.play().catch(() => {
        // Autoplay blocked (no user gesture yet) — leave paused & ready to play.
        setIsPlaying(false);
        setLoading(false);
      });
    }
  };

  const playEpisode = (ep: Episode, q?: Episode[]) => {
    if (q && q.length) {
      const startIdx = Math.max(
        0,
        q.findIndex((x) => x.id === ep.id)
      );
      setQueue(q);
      setIndex(startIdx >= 0 ? startIdx : 0);
      load(q[startIdx >= 0 ? startIdx : 0], false, true);
    } else {
      // single / ad-hoc stream
      setQueue([ep]);
      setIndex(0);
      load(ep, false, true);
    }
  };

  const playQueue = (eps: Episode[], startIndex = 0) => {
    if (!eps.length) return;
    setQueue(eps);
    setIndex(startIndex);
    load(eps[startIndex], false, true);
  };

  const jumpTo = (i: number) => {
    if (i < 0 || i >= queue.length) return;
    setIndex(i);
    load(queue[i], false, true);
  };

  const next = () => {
    if (index + 1 < queue.length) {
      setIndex(index + 1);
      load(queue[index + 1], false, true);
    }
  };
  const prev = () => {
    // if >3s in, restart; else previous track
    const a = audioRef.current;
    if (a && a.currentTime > 3) {
      a.currentTime = current?.chapterStart || 0;
      return;
    }
    if (index > 0) {
      setIndex(index - 1);
      load(queue[index - 1], false, true);
    }
  };

  const toggle = () => {
    const a = audioRef.current;
    if (!a || !current) return;
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  };

  const seek = (t: number) => {
    const a = audioRef.current;
    if (a) a.currentTime = t;
  };
  const skip = (delta: number) => {
    const a = audioRef.current;
    if (a) a.currentTime = Math.max(0, Math.min(a.duration || 0, a.currentTime + delta));
  };
  const setRate = (r: number) => {
    setRateState(r);
    if (audioRef.current) audioRef.current.playbackRate = r;
  };
  const setVolume = (v: number) => {
    setVolumeState(v);
    if (audioRef.current) audioRef.current.volume = v;
  };
  const removeFromQueue = (i: number) => {
    setQueue((q) => q.filter((_, idx) => idx !== i));
    if (i < index) setIndex((x) => x - 1);
  };
  const clearQueue = () => {
    setQueue([]);
    setIndex(0);
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.src = "";
    }
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  };

  // wire events
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => {
      setCurrentTime(a.currentTime);
      if (current?.chapterEnd && a.currentTime >= current.chapterEnd) next();
    };
    const onDur = () => setDuration(a.duration || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setLoading(true);
    const onCanPlay = () => setLoading(false);
    const onEnded = () => next();
    const onError = () => {
      // fallback: try proxy once if direct failed
      if (!triedProxyRef.current && current) {
        load(current, true, true);
      } else {
        setError("This episode can't be played. Try another.");
        setLoading(false);
        setIsPlaying(false);
      }
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("durationchange", onDur);
    a.addEventListener("loadedmetadata", onDur);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("waiting", onWaiting);
    a.addEventListener("canplay", onCanPlay);
    a.addEventListener("playing", onCanPlay);
    a.addEventListener("ended", onEnded);
    a.addEventListener("error", onError);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("durationchange", onDur);
      a.removeEventListener("loadedmetadata", onDur);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("waiting", onWaiting);
      a.removeEventListener("canplay", onCanPlay);
      a.removeEventListener("playing", onCanPlay);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("error", onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, index, queue]);

  const value = useMemo<PlayerState>(
    () => ({
      queue,
      index,
      current,
      isPlaying,
      currentTime,
      duration,
      rate,
      loading,
      error,
      usingProxy,
      playEpisode,
      playQueue,
      toggle,
      next,
      prev,
      seek,
      skip,
      setRate,
      setVolume,
      volume,
      removeFromQueue,
      clearQueue,
      jumpTo,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queue, index, isPlaying, currentTime, duration, rate, volume, loading, error, usingProxy]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function fmtTime(s: number): string {
  if (!s || !Number.isFinite(s)) return "0:00";
  const sec = Math.floor(s % 60);
  const min = Math.floor((s / 60) % 60);
  const hr = Math.floor(s / 3600);
  if (hr > 0) return `${hr}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${min}:${String(sec).padStart(2, "0")}`;
}
