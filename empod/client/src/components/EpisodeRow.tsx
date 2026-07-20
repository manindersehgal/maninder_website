import { Play, Pause, ListPlus, Clock } from "lucide-react";
import { usePlayer, fmtTime, type Episode } from "@/lib/player";
import { Artwork } from "./Artwork";

export function EpisodeRow({
  ep,
  queue,
  index,
}: {
  ep: Episode;
  queue: Episode[];
  index?: number;
}) {
  const p = usePlayer();
  const isCurrent = p.current?.id === ep.id;
  const playing = isCurrent && p.isPlaying;

  return (
    <div
      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-accent/50 ${
        isCurrent ? "bg-accent/60" : ""
      }`}
    >
      <button
        onClick={() => {
          if (isCurrent) p.toggle();
          else p.playEpisode(ep, queue);
        }}
        data-testid={`button-play-${index ?? ep.id}`}
        className="relative flex-shrink-0"
        aria-label={playing ? "Pause" : "Play"}
      >
        <Artwork
          src={ep.artwork}
          alt={ep.showTitle}
          className="h-14 w-14 shadow-sm"
        />
        <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          {playing ? (
            <Pause size={20} className="fill-white text-white" />
          ) : (
            <Play size={20} className="fill-white text-white translate-x-0.5" />
          )}
        </span>
        {playing && (
          <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50">
            <EqualizerBars active />
          </span>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div
          className={`truncate text-sm font-semibold ${isCurrent ? "text-primary" : "text-foreground"}`}
        >
          {ep.title}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {ep.showTitle}
        </div>
        {(ep.matchText || ep.description) && (
          <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground/80">
            {ep.matchText ? `“${ep.matchText}”` : ep.description}
          </div>
        )}
      </div>

      <div className="flex flex-shrink-0 items-center gap-3 text-muted-foreground">
        <button
          onClick={() => p.playEpisode(ep, [...queue, ep])}
          className="opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
          aria-label="Play next"
          title="Play"
        >
          <ListPlus size={16} />
        </button>
        <span className="hidden items-center gap-1 text-xs tabular-nums sm:flex">
          <Clock size={12} />
          {ep.chapterEnd
            ? fmtTime(ep.chapterEnd - (ep.chapterStart || 0))
            : ep.duration ? fmtTime(ep.duration) : "—"}
        </span>
      </div>
    </div>
  );
}

function EqualizerBars({ active }: { active: boolean }) {
  return (
    <div className="flex items-end gap-0.5" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`w-1 rounded-full bg-primary ${active ? "empod-eq" : ""}`}
          style={{
            height: active ? undefined : 6,
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </div>
  );
}
