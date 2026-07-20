import { useLocation } from "wouter";
import { SearchBar } from "@/components/SearchBar";
import { TrendingUp, Podcast, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

const TOPICS = [
  "Artificial Intelligence",
  "True Crime",
  "Climate Change",
  "Startup Founders",
  "NBA",
  "Personal Finance",
  "History",
  "Space",
  "Mental Health",
  "Film & TV",
];

export function Home() {
  const [, navigate] = useLocation();
  const go = (t: string) => navigate(`/browse/${encodeURIComponent(t)}`);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 md:py-16">
      <div className="mb-8 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles size={12} className="text-primary" />
          Topic-driven listening
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-[28px]">
          Search a word. Hear every recent moment about it.
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          em.pod reads timestamped transcripts from the past week, turns every
          spoken match into a short chapter, and plays them back to back.
        </p>
      </div>

      <SearchBar large onSubmit={go} />

      <div className="mt-8">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <TrendingUp size={13} /> Trending topics
        </div>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((t) => (
            <button
              key={t}
              onClick={() => go(t)}
              data-testid={`button-topic-${t}`}
              className="rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-medium text-foreground hover:border-primary hover:text-primary"
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        <Feature
          icon={<Podcast size={18} />}
          title="Public podcast feeds"
          desc="Discover shows and stream episodes directly from their public RSS feeds."
          href="/browse"
          cta="Find podcasts"
        />
        <Feature
          icon={<Sparkles size={18} />}
          title="Transcript-powered chapters"
          desc="One topic, many shows. Hear only the moments that mention it."
          href="/browse"
          cta="Browse topics"
        />
      </div>
    </div>
  );
}

function Feature({
  icon,
  title,
  desc,
  href,
  cta,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  href: string;
  cta: string;
}) {
  return (
    <a
      href={`#${href}`}
      className="block rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
    >
      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="text-sm font-semibold text-foreground">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{desc}</div>
      <div className="mt-3 text-xs font-semibold text-primary">{cta} →</div>
    </a>
  );
}
