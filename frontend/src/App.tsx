import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Quiz from "./pages/Quiz";
import Results from "./pages/Results";
import NotFound from "./pages/NotFound";
import Multiplayer from "./pages/Multiplayer";
import MultiplayerLobby from "./pages/MultiplayerLobby";
import MultiplayerQuiz from "./pages/MultiplayerQuiz";
import MultiplayerResults from "./pages/MultiplayerResults";
import DevInfo from "./components/DevInfo";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/results" element={<Results />} />
          <Route path="/multiplayer" element={<Multiplayer />} />
          <Route path="/multiplayer/lobby/:lobbyCode" element={<MultiplayerLobby />} />
          <Route path="/multiplayer/quiz/:lobbyCode" element={<MultiplayerQuiz />} />
          <Route path="/multiplayer/results/:lobbyCode" element={<MultiplayerResults />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <DevInfo />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
