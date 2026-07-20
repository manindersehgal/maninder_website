import { useEffect, useState } from "react";
import { usePlayer } from "@/lib/player";
import { readQueryParam } from "@/components/SearchBar";
import { Radio, Play, Link2, Info } from "lucide-react";

export function Stream() {
  const p = usePlayer();
  const [url, setUrl] = useState("");
  const [touched, setTouched] = useState(false);

  // deep-link: ?stream=URL  (works from the hash or real query string)
  useEffect(() => {
    const s = readQueryParam("stream");
    if (s && /^https?:\/\//i.test(s)) {
      setUrl(s);
      setTouched(true);
      p.playEpisode(makeEp(s), [makeEp(s)]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = url.trim();
    if (!/^https?:\/\//i.test(u)) {
      setTouched(true);
      return;
    }
    p.playEpisode(makeEp(u), [makeEp(u)]);
  };

  const invalid = touched && url.length > 0 && !/^https?:\/\//i.test(url);

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-purple-600 shadow-lg">
          <Radio size={22} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Deep-link stream player
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Paste a direct audio URL (mp3, m4a, aac…) and em.pod plays it
          instantly. If the host blocks cross-origin playback, em.pod routes it
          through its own stream proxy automatically.
        </p>
      </div>

      <form onSubmit={submit} className="relative">
        <Link2
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/episode.mp3"
          data-testid="input-stream"
          className={`w-full rounded-xl border bg-card py-3 pl-10 pr-28 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 ${
            invalid
              ? "border-destructive focus:ring-destructive/40"
              : "border-border focus:ring-primary/60"
          }`}
        />
        <button
          type="submit"
          data-testid="button-stream-play"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <span className="flex items-center gap-1.5">
            <Play size={14} className="fill-current" /> Play
          </span>
        </button>
      </form>
      {invalid && (
        <p className="mt-2 pl-1 text-xs text-destructive">
          Enter a full URL starting with http:// or https://
        </p>
      )}

      <div className="mt-6 flex items-start gap-2 rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
        <Info size={14} className="mt-0.5 flex-shrink-0 text-primary" />
        <div>
          <p className="font-medium text-foreground">Shareable deep links</p>
          <p className="mt-1">
            Add <code className="rounded bg-muted px-1 py-0.5">?stream=URL</code> to
            this app's address to auto-play on load — share it and the stream
            starts the moment the page opens.
          </p>
        </div>
      </div>
    </div>
  );
}

function makeEp(url: string) {
  const name = url.split("/").pop()?.split("?")[0] || "Stream";
  return {
    id: `stream::${url}`,
    title: name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]/g, " ") || "Live Stream",
    showTitle: "Deep-link stream",
    author: "",
    artwork: "",
    audioUrl: url,
    duration: 0,
    pubDate: "",
    description: url,
    feedUrl: "",
  };
}
