import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Rewind,
  FastForward,
  Volume2,
  VolumeX,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { usePlayer, fmtTime } from "@/lib/player";
import { Artwork } from "./Artwork";

const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];

export function PlayerBar() {
  const p = usePlayer();
  const [muted, setMuted] = useState(false);
  const [vol, setVol] = useState(1);
  const [rateOpen, setRateOpen] = useState(false);

  const onVol = (v: number) => {
    setVol(v);
    setMuted(v === 0);
    const a = (window as any).__audio as HTMLAudioElement | undefined;
    if (a) a.volume = v;
  };

  // expose audio for volume — re-grab from a hidden ref instead
  const chapterStart = p.current?.chapterStart || 0;
  const chapterEnd = p.current?.chapterEnd || p.duration;
  const chapterDuration = Math.max(0, chapterEnd - chapterStart);
  const chapterTime = Math.max(0, p.currentTime - chapterStart);
  const pct = chapterDuration ? (chapterTime / chapterDuration) * 100 : 0;

  if (!p.current) {
    return (
      <div className="border-t border-border bg-sidebar/60 backdrop-blur px-4 py-3 text-center text-sm text-muted-foreground">
        Nothing playing — search a topic or choose a podcast to begin.
      </div>
    );
  }

  return (
    <div className="border-t border-border bg-sidebar/80 backdrop-blur-xl">
      {/* scrubber */}
      <div className="group relative h-1.5 w-full bg-border/60 cursor-pointer">
        <div
          className="absolute inset-y-0 left-0 bg-primary"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={chapterStart}
          max={chapterEnd || 0}
          step={0.1}
          value={p.currentTime}
          onChange={(e) => p.seek(parseFloat(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label="Seek"
        />
      </div>

      <div className="flex items-center gap-4 px-4 py-2.5">
        {/* now playing meta */}
        <Link
          href="/queue"
          className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80"
        >
          <Artwork
            src={p.current.artwork}
            alt={p.current.showTitle}
            className="h-12 w-12 flex-shrink-0 shadow-md"
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-foreground">
              {p.current.title}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {p.current.showTitle}
            </div>
          </div>
        </Link>

        {/* center controls */}
        <div className="flex flex-1 items-center justify-center gap-3">
          <button
            onClick={() => p.skip(-15)}
            className="hidden text-muted-foreground hover:text-foreground sm:block"
            aria-label="Back 15 seconds"
            title="Back 15s"
          >
            <Rewind size={18} />
          </button>
          <button
            onClick={p.prev}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Previous"
            title="Previous"
          >
            <SkipBack size={20} className="fill-current" />
          </button>
          <button
            onClick={p.toggle}
            data-testid="button-playpause"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:opacity-90"
            aria-label={p.isPlaying ? "Pause" : "Play"}
          >
            {p.loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : p.isPlaying ? (
              <Pause size={20} className="fill-current" />
            ) : (
              <Play size={20} className="fill-current translate-x-0.5" />
            )}
          </button>
          <button
            onClick={p.next}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Next"
            title="Next"
          >
            <SkipForward size={20} className="fill-current" />
          </button>
          <button
            onClick={() => p.skip(15)}
            className="hidden text-muted-foreground hover:text-foreground sm:block"
            aria-label="Forward 15 seconds"
            title="Forward 15s"
          >
            <FastForward size={18} />
          </button>
        </div>

        {/* right: time + speed + volume */}
        <div className="hidden min-w-0 flex-1 items-center justify-end gap-3 md:flex">
          <span className="tabular-nums text-xs text-muted-foreground">
            {fmtTime(chapterTime)} / {fmtTime(chapterDuration)}
          </span>

          <div className="relative">
            <button
              onClick={() => setRateOpen((v) => !v)}
              className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
              data-testid="button-speed"
            >
              {p.rate}x
            </button>
            {rateOpen && (
              <div className="absolute bottom-full right-0 mb-2 flex flex-col rounded-lg border border-border bg-popover p-1 shadow-lg">
                {RATES.map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      p.setRate(r);
                      setRateOpen(false);
                    }}
                    className={`rounded px-3 py-1 text-left text-xs hover:bg-accent ${r === p.rate ? "font-bold text-primary" : "text-foreground"}`}
                  >
                    {r}x
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                const next = !muted;
                setMuted(next);
                p.setVolume(next ? 0 : p.volume || 1);
              }}
              className="text-muted-foreground hover:text-foreground"
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : p.volume}
              onChange={(e) => onVol(parseFloat(e.target.value))}
              className="empod-vol w-20"
              aria-label="Volume"
            />
          </div>
        </div>
      </div>

      {p.error && (
        <div className="flex items-center justify-center gap-2 bg-destructive/10 px-4 py-1 text-xs text-destructive">
          <AlertCircle size={12} />
          {p.error}
        </div>
      )}
    </div>
  );
}
