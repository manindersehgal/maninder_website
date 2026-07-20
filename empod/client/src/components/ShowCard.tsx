import { Link } from "wouter";
import { Artwork } from "./Artwork";
import type { Show } from "@/lib/api";

export function ShowCard({ show, fluid = false }: { show: Show; fluid?: boolean }) {
  return (
    <Link
      href={`/show/${show.id}`}
      data-testid={`link-show-${show.id}`}
      className={`group block ${fluid ? "min-w-0" : "w-40 flex-shrink-0"}`}
    >
      <Artwork
        src={show.artwork}
        alt={show.title}
        className="aspect-square w-full shadow-md transition-transform group-hover:scale-[1.02]"
        rounded="rounded-2xl"
      />
      <div className="mt-2 truncate text-sm font-semibold text-foreground">
        {show.title}
      </div>
      <div className="truncate text-xs text-muted-foreground">
        {show.author}
      </div>
    </Link>
  );
}
