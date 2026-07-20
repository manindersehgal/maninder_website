import { useState, type FormEvent } from "react";
import { Search } from "lucide-react";

export function SearchBar({
  initial = "",
  onSubmit,
  placeholder = "Search a topic — true crime, AI, climate…",
  large = false,
}: {
  initial?: string;
  onSubmit: (term: string) => void;
  placeholder?: string;
  large?: boolean;
}) {
  const [term, setTerm] = useState(initial);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = term.trim();
    if (t) onSubmit(t);
  };

  return (
    <form onSubmit={submit} className="relative w-full" role="search">
      <Search
        size={large ? 20 : 16}
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <input
        type="search"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder={placeholder}
        data-testid="input-search"
        className={`w-full rounded-full border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 ${
          large ? "py-3.5 pl-11 pr-28 text-base" : "py-2.5 pl-9 pr-4 text-sm"
        }`}
      />
      {large && (
        <button
          type="submit"
          data-testid="button-search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Search
        </button>
      )}
    </form>
  );
}

/** Parse the query string that lives after the hash, e.g. #/browse?topic=ai */
export function useHashQuery(key: string): string {
  const hash = window.location.hash || "";
  const qIndex = hash.indexOf("?");
  if (qIndex === -1) return "";
  const params = new URLSearchParams(hash.slice(qIndex + 1));
  return params.get(key) || "";
}

/** Read both hash query and real query (deep-link stream support) */
export function readQueryParam(key: string): string {
  const hash = window.location.hash || "";
  const qIndex = hash.indexOf("?");
  if (qIndex !== -1) {
    const v = new URLSearchParams(hash.slice(qIndex + 1)).get(key);
    if (v) return v;
  }
  const real = new URLSearchParams(window.location.search).get(key);
  return real || "";
}
