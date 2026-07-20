import { Link, useLocation } from "wouter";
import { Home, Compass, Radio, ListMusic, Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/", label: "Now", icon: Home },
  { href: "/browse", label: "Browse", icon: Compass },
  { href: "/stream", label: "Stream", icon: Radio },
  { href: "/queue", label: "Queue", icon: ListMusic },
];

export function MobileNav({ queueCount }: { queueCount: number }) {
  const [loc] = useLocation();
  const [dark, setDark] = useState(true);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  };
  return (
    <div className="md:hidden">
      {/* top bar with logo */}
      <div className="flex items-center justify-between border-b border-border bg-background px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-purple-600">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 3v18M8 6v12M16 6v12M4 9v6M20 9v6"
                stroke="white"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <span className="text-sm font-bold tracking-tight">em.pod</span>
        </div>
        <div className="flex items-center gap-2">
          {queueCount > 0 && (
            <Link
              href="/queue"
              className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground"
            >
              {queueCount} in queue
            </Link>
          )}
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="rounded-md p-1.5 text-muted-foreground"
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </div>

      {/* tab strip */}
      <nav className="flex items-stretch border-b border-border bg-background">
        {NAV.map((item) => {
          const active = loc === item.href || (item.href !== "/" && loc.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
