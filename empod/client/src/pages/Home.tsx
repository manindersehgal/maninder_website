import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { SearchBar } from "@/components/SearchBar";
import { ShowCard } from "@/components/ShowCard";
import { fetchTopShows } from "@/lib/api";
import { ChevronRight } from "lucide-react";

const CATEGORIES = ["News", "Comedy", "True Crime", "Sports", "Business", "Technology"];

export function Home() {
  const [, navigate] = useLocation();
  const go = (term: string) => navigate(`/browse/${encodeURIComponent(term)}`);
  const topQuery = useQuery({ queryKey: ["/api/top-shows"], queryFn: fetchTopShows });

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 pb-24 md:px-8 md:py-10">
      <header className="mb-8 border-b border-border pb-8">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-primary">Browse</p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Listen to something great.</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">Search millions of public podcasts and play the newest episodes instantly.</p>
        <div className="mt-6 max-w-2xl"><SearchBar large onSubmit={go} placeholder="Search shows, people, or topics" /></div>
      </header>

      <section className="mb-10">
        <div className="mb-4 flex items-end justify-between">
          <div><h2 className="text-xl font-bold tracking-tight">Top Shows</h2><p className="mt-0.5 text-xs text-muted-foreground">What listeners are playing now</p></div>
        </div>
        {topQuery.isLoading ? <TopSkeleton /> : topQuery.data?.length ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
            {topQuery.data.slice(0, 10).map((show) => <ShowCard key={show.id} show={show} fluid />)}
          </div>
        ) : <p className="py-12 text-sm text-muted-foreground">Top shows are unavailable right now.</p>}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold tracking-tight">Browse Categories</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CATEGORIES.map((category) => (
            <button key={category} onClick={() => go(category)} className="flex items-center justify-between rounded-xl bg-card px-4 py-3 text-left text-sm font-semibold hover:bg-accent">
              {category}<ChevronRight size={16} className="text-muted-foreground" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function TopSkeleton() {
  return <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{Array.from({length:10}).map((_,i)=><div key={i}><div className="aspect-square animate-pulse rounded-2xl bg-muted"/><div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-muted"/></div>)}</div>;
}
