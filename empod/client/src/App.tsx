import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PlayerProvider, usePlayer } from "@/lib/player";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { PlayerBar } from "@/components/PlayerBar";
import { Home } from "@/pages/Home";
import { Browse } from "@/pages/Browse";
import { Show } from "@/pages/Show";
import { Queue } from "@/pages/Queue";
import NotFound from "@/pages/not-found";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/browse" component={Browse} />
      <Route path="/browse/:topic" component={Browse} />
      <Route path="/show/:id" component={Show} />
      <Route path="/queue" component={Queue} />
      <Route component={NotFound} />
    </Switch>
  );
}

function Shell() {
  const p = usePlayer();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <MobileNav queueCount={p.queue.length} />
      <div className="flex min-h-0 flex-1">
        <Sidebar queueCount={p.queue.length} />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <AppRouter />
        </main>
      </div>
      <PlayerBar />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <PlayerProvider>
          <Router hook={useHashLocation}>
            <Shell />
          </Router>
        </PlayerProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
