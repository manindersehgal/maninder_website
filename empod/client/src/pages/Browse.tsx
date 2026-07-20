import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { SearchBar } from "@/components/SearchBar";
import { ShowCard } from "@/components/ShowCard";
import { EpisodeRow } from "@/components/EpisodeRow";
import { searchShows, fetchEpisodes, type Episode } from "@/lib/api";
import { Podcast, AlertCircle } from "lucide-react";

export function Browse() {
  const params = useParams<{ topic?: string }>();
  const [, navigate] = useLocation();
  const topic = params.topic ? decodeURIComponent(params.topic) : "";

  const showsQuery = useQuery({
    queryKey: ["/api/search", topic],
    queryFn: () => searchShows(topic),
    enabled: !!topic,
  });

  const epsQuery = useQuery({
    queryKey: ["/api/episodes", topic],
    queryFn: () => fetchEpisodes(topic),
    enabled: !!topic,
  });

  const episodes: Episode[] = epsQuery.data || [];
  const go = (t: string) => navigate(`/browse/${encodeURIComponent(t)}`);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 pb-24">
      <div className="mb-6">
        <h1 className="mb-4 text-2xl font-bold tracking-tight">Search</h1>
        <SearchBar initial={topic} onSubmit={go} placeholder="Search shows, people, or topics" />
      </div>

      {!topic && (
        <div className="py-20 text-center text-sm text-muted-foreground">
          Search a topic above to find podcasts and episodes.
        </div>
      )}

      {topic && (
        <>
          {/* Shows arrive first so search feels immediate */}
          {showsQuery.isLoading ? (
            <SkeletonRow />
          ) : showsQuery.data && showsQuery.data.length > 0 ? (
            <section className="mb-10">
              <SectionTitle icon={<Podcast size={15} />}>Shows</SectionTitle>
              <div className="flex gap-5 overflow-x-auto pb-2">
                {showsQuery.data.slice(0, 12).map((s) => <ShowCard key={s.id} show={s} />)}
              </div>
            </section>
          ) : null}

          {/* Recent episodes */}
          {epsQuery.isLoading ? (
            <SkeletonList />
          ) : epsQuery.isError ? (
            <ErrorState msg="Couldn't load episodes for this topic." />
          ) : episodes.length === 0 ? (
            <EmptyState msg="No podcast episodes found. Try another search." />
          ) : (
            <section className="mb-10">
              <SectionTitle icon={<Podcast size={15} />}>Latest Episodes</SectionTitle>
              <div className="space-y-0.5">
                {episodes.map((ep, i) => (
                  <EpisodeRow key={ep.id + i} ep={ep} queue={episodes} index={i} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function SectionTitle({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-lg font-bold tracking-tight text-foreground">
      <span className="text-primary">{icon}</span>
      {children}
    </h2>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5">
          <div className="h-14 w-14 animate-pulse rounded-lg bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex gap-5 overflow-hidden">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="w-40 flex-shrink-0">
          <div className="aspect-square w-full animate-pulse rounded-2xl bg-muted" />
          <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-muted" />
          <div className="mt-1.5 h-2.5 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

function ErrorState({ msg }: { msg: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-destructive">
      <AlertCircle size={28} />
      {msg}
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return <div className="py-12 text-center text-sm text-muted-foreground">{msg}</div>;
}
