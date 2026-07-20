import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { fetchFeed } from "@/lib/api";
import { EpisodeRow } from "@/components/EpisodeRow";
import { Artwork } from "@/components/Artwork";
import { usePlayer } from "@/lib/player";
import { Play, Loader2, AlertCircle } from "lucide-react";

export function Show() {
  const params = useParams();
  const id = params.id || "";
  const p = usePlayer();

  const q = useQuery({
    queryKey: ["/api/feed", id],
    queryFn: () => fetchFeed({ id }),
    enabled: !!id,
  });

  const episodes = q.data?.episodes || [];
  const title = episodes[0]?.showTitle || "Podcast";
  const author = episodes[0]?.author || "";
  const artwork = episodes[0]?.artwork || "";

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      {q.isLoading ? (
        <div className="flex items-center gap-2 py-20 justify-center text-sm text-muted-foreground">
          <Loader2 size={18} className="animate-spin" /> Loading show…
        </div>
      ) : q.isError ? (
        <div className="flex flex-col items-center gap-2 py-20 text-center text-sm text-destructive">
          <AlertCircle size={28} />
          Couldn't load this show's feed.
        </div>
      ) : (
        <>
          <div className="mb-8 flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
            <Artwork
              src={artwork}
              alt={title}
              className="h-36 w-36 flex-shrink-0 shadow-xl"
              rounded="rounded-2xl"
            />
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wider text-primary">
                Podcast
              </div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
                {title}
              </h1>
              {author && (
                <div className="mt-1 text-sm text-muted-foreground">
                  {author}
                </div>
              )}
              {episodes.length > 0 && (
                <button
                  onClick={() => p.playQueue(episodes, 0)}
                  data-testid="button-play-show"
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md hover:opacity-90"
                >
                  <Play size={15} className="fill-current" /> Play all
                </button>
              )}
            </div>
          </div>

          <h2 className="mb-3 text-lg font-bold tracking-tight text-foreground">
            Episodes
          </h2>
          <div className="space-y-0.5">
            {episodes.map((ep, i) => (
              <EpisodeRow key={ep.id + i} ep={ep} queue={episodes} index={i} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
