import { Suspense, lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import DevInfo from "@/components/DevInfo";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton, Toaster, TooltipProvider } from "@/components/ui";
import { MultiplayerProvider } from "@/contexts/MultiplayerContext";

/*
 * One lazily loaded chunk per route. v1 imported all eight pages eagerly, so the
 * first paint of the home screen pulled in the entire multiplayer game.
 */
const Home = lazy(() => import("./pages/Home"));
const Quiz = lazy(() => import("./pages/Quiz"));
const Results = lazy(() => import("./pages/Results"));
const MultiplayerEntry = lazy(() => import("./pages/MultiplayerEntry"));
const MultiplayerLobby = lazy(() => import("./pages/MultiplayerLobby"));
const MultiplayerQuiz = lazy(() => import("./pages/MultiplayerQuiz"));
const MultiplayerResults = lazy(() => import("./pages/MultiplayerResults"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function RouteFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-3 pt-6 sm:px-5"
    >
      <span className="sr-only">Loading page</span>
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <MultiplayerProvider>
      <TooltipProvider>
        <BrowserRouter>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-toast focus:rounded focus:border-2 focus:border-ink-line focus:bg-acid focus:px-3 focus:py-2 focus:font-bold focus:uppercase focus:text-ink"
          >
            Skip to content
          </a>

          <main id="main" className="min-h-dvh">
            <ErrorBoundary>
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/quiz" element={<Quiz />} />
                  <Route path="/results" element={<Results />} />
                  <Route path="/multiplayer" element={<MultiplayerEntry />} />
                  <Route
                    path="/multiplayer/lobby/:lobbyCode"
                    element={<MultiplayerLobby />}
                  />
                  <Route
                    path="/multiplayer/quiz/:lobbyCode"
                    element={<MultiplayerQuiz />}
                  />
                  <Route
                    path="/multiplayer/results/:lobbyCode"
                    element={<MultiplayerResults />}
                  />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </main>

          <DevInfo />
        </BrowserRouter>

        {/* One toast surface for the whole app. */}
        <Toaster />
      </TooltipProvider>
    </MultiplayerProvider>
  </QueryClientProvider>
);

export default App;
