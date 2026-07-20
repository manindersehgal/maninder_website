import { usePlayer } from "@/lib/player";
import { EpisodeRow } from "@/components/EpisodeRow";
import { ListMusic, Trash2 } from "lucide-react";

export function Queue() {
  const p = usePlayer();

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <ListMusic size={22} className="text-primary" /> Up Next
        </h1>
        {p.queue.length > 0 && (
          <button
            onClick={() => p.clearQueue()}
            className="text-xs font-medium text-muted-foreground hover:text-destructive"
          >
            Clear
          </button>
        )}
      </div>

      {p.queue.length === 0 ? (
        <div className="py-20 text-center text-sm text-muted-foreground">
          Your queue is empty. Search a topic and hit Play all, or paste a
          stream URL.
        </div>
      ) : (
        <div className="space-y-0.5">
          {p.queue.map((ep, i) => (
            <div key={ep.id + i} className="flex items-center gap-1">
              <div className="min-w-0 flex-1">
                <EpisodeRow ep={ep} queue={p.queue} index={i} />
              </div>
              <button
                onClick={() => p.removeFromQueue(i)}
                className="flex-shrink-0 rounded-md p-2 text-muted-foreground hover:text-destructive"
                aria-label="Remove from queue"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
