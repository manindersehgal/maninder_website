import { Link, useLocation } from "wouter";
import { Home, Compass, ListMusic, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

function Logo() {
  return (
    <div className="flex items-center gap-2.5 px-2 py-1">
      <div className="relative flex h-9 w-9 items-center justify-center rounded-[0.6rem] bg-gradient-to-br from-fuchsia-500 to-purple-600 shadow-md">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 3v18M8 6v12M16 6v12M4 9v6M20 9v6"
            stroke="white"
            stroke-width="2.2"
            stroke-linecap="round"
          />
        </svg>
      </div>
      <div className="leading-tight">
        <div className="text-[15px] font-bold tracking-tight text-foreground">
          em.pod
        </div>
        <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Listen deeper
        </div>
      </div>
    </div>
  );
}

const NAV = [
  { href: "/", label: "Listen Now", icon: Home, testid: "link-home" },
  { href: "/browse", label: "Browse", icon: Compass, testid: "link-browse" },
  { href: "/queue", label: "Up Next", icon: ListMusic, testid: "link-queue" },
];

export function Sidebar({ queueCount }: { queueCount: number }) {
  const [loc] = useLocation();
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    const initial = prefersDark;
    setDark(initial);
    document.documentElement.classList.toggle("dark", initial);
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  return (
    <aside className="hidden h-full w-60 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <div className="px-3 py-4">
        <Logo />
      </div>
      <nav className="flex-1 px-2">
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const active = loc === item.href;
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  data-testid={item.testid}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-sidebar-accent text-primary"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-foreground"
                  }`}
                >
                  <Icon size={18} />
                  <span className="flex-1">{item.label}</span>
                  {item.href === "/queue" && queueCount > 0 && (
                    <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                      {queueCount}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={toggleTheme}
          data-testid="button-theme"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-foreground"
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
          {dark ? "Light Mode" : "Dark Mode"}
        </button>
      </div>
    </aside>
  );
}
