import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiService } from "@/services/apiService";
import { useMultiplayer } from "@/contexts/MultiplayerContext";
import { Button } from "@/components/ui/button";
import { Home, Trophy, Medal, Award, ArrowLeft, Users, BarChart2 } from "lucide-react";
import { motion } from "framer-motion";
import "./Quiz.css";

interface Player {
  id: string;
  name: string;
  isHost: boolean;
  avatar: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
}

interface GameResults {
  lobbyCode: string;
  players: Player[];
  totalQuestions: number;
}

const MultiplayerResults = () => {
  const navigate = useNavigate();
  const { lobbyCode } = useParams<{ lobbyCode: string }>();
  const { playerName } = useMultiplayer();
  
  const [results, setResults] = useState<GameResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // First try to get results from localStorage
    const fetchLocalResults = () => {
      try {
        const storedResults = localStorage.getItem(`quiz_results_${lobbyCode}`);
        if (storedResults) {
          const parsedResults = JSON.parse(storedResults);
          setResults(parsedResults);
          setLoading(false);
          return true;
        }
        return false;
      } catch (e) {
        console.error("Error parsing stored results:", e);
        return false;
      }
    };
    
    // Then try to fetch from API
    const fetchResults = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Try local results first
        if (fetchLocalResults()) {
          return;
        }
        
        // If no local results, try the API
        const apiResults = await apiService.getGameResults(lobbyCode || "");
        
        if (apiResults) {
          setResults(apiResults);
          // Also store in localStorage for future reference
          localStorage.setItem(`quiz_results_${lobbyCode}`, JSON.stringify(apiResults));
        } else {
          throw new Error("No results returned from API");
        }
      } catch (error: any) {
        console.error("Error fetching results:", error);
        setError("Failed to load game results. Please try again later.");
        
        // Last attempt - try to reconstruct basic results if we have playerName
        if (!fetchLocalResults() && playerName) {
          setResults({
            lobbyCode: lobbyCode || "",
            players: [{
              id: "local",
              name: playerName,
              isHost: false,
              avatar: "👤",
              score: 0,
              correctAnswers: 0,
              totalQuestions: 0
            }],
            totalQuestions: 0
          });
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchResults();
  }, [lobbyCode, playerName]);
  
  // Find player rank
  const findPlayerRank = (playerName: string): number => {
    if (!results?.players) return 0;
    
    const sortedPlayers = [...results.players].sort((a, b) => b.score - a.score);
    return sortedPlayers.findIndex(p => p.name === playerName) + 1;
  };
  
  // Get appropriate medal emoji for position
  const getMedal = (position: number): JSX.Element => {
    switch (position) {
      case 1:
        return <Trophy className="h-8 w-8 text-yellow-400" />;
      case 2:
        return <Medal className="h-8 w-8 text-gray-300" />;
      case 3:
        return <Medal className="h-8 w-8 text-amber-700" />;
      default:
        return <Award className="h-8 w-8 text-purple-500" />;
    }
  };
  
  if (loading) {
    return (
      <div className="quiz-background">
        <div className="quiz-gradient-overlay" />
        <div className="flex flex-col items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
          <p className="text-white mt-4 text-xl">Loading results...</p>
        </div>
      </div>
    );
  }
  
  if (error || !results) {
    return (
      <div className="quiz-background">
        <div className="quiz-gradient-overlay" />
        <div className="flex flex-col items-center justify-center h-screen p-4">
          <div className="bg-red-500/20 p-4 rounded-lg mb-4">
            <p className="text-white text-center">{error || "Failed to load results"}</p>
          </div>
          <Button 
            onClick={() => navigate("/")}
            variant="default"
            className="mt-4"
          >
            <Home className="mr-2 h-4 w-4" />
            Return to Home
          </Button>
        </div>
      </div>
    );
  }
  
  // Sort players by score (highest first)
  const sortedPlayers = [...results.players].sort((a, b) => b.score - a.score);
  const currentPlayerRank = findPlayerRank(playerName);
  
  return (
    <div className="quiz-background">
      <div className="quiz-gradient-overlay" />
      <div className="quiz-radial-overlay-1" />
      <div className="quiz-radial-overlay-2" />
      
      <div className="container mx-auto max-w-6xl p-4 min-h-screen flex flex-col">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="absolute top-4 left-4 text-white"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10 mt-16"
        >
          <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-600">
            Game Results
          </h1>
          <p className="text-gray-300 mt-2">Lobby Code: {lobbyCode}</p>
        </motion.div>
        
        {/* Leaderboard */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-black/30 backdrop-blur-sm rounded-xl p-6 border border-white/10 shadow-xl mb-8"
        >
          <div className="flex items-center text-white mb-6">
            <Trophy className="h-6 w-6 mr-2 text-yellow-400" />
            <h2 className="text-2xl font-bold">Leaderboard</h2>
          </div>
          
          <div className="space-y-4">
            {sortedPlayers.map((player, index) => (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.1 * index }}
                className={`flex items-center p-4 rounded-lg ${
                  player.name === playerName ? 
                  "bg-indigo-500/30 border border-indigo-500/50" : 
                  "bg-white/10 border border-white/5"
                }`}
              >
                <div className="flex items-center justify-center w-10 h-10">
                  {getMedal(index + 1)}
                </div>
                
                <div className="flex-1 ml-4">
                  <div className="flex items-center">
                    <div className="w-10 h-10 flex items-center justify-center text-xl rounded-full bg-white/10 mr-3">
                      {player.avatar}
                    </div>
                    <div>
                      <div className="flex items-center">
                        <span className="font-bold text-white text-lg">
                          {player.name}
                        </span>
                        {player.name === playerName && (
                          <span className="ml-2 bg-indigo-500/30 text-xs px-2 py-0.5 rounded-full text-white">
                            You
                          </span>
                        )}
                      </div>
                      <div className="flex items-center">
                        <span className="text-sm text-gray-300">
                          {player.correctAnswers}/{results.totalQuestions} correct
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-2xl font-bold text-indigo-300">
                    {player.score}
                  </div>
                  <div className="text-xs text-gray-400">points</div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
        
        {/* Player summary */}
        {playerName && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="bg-black/30 backdrop-blur-sm rounded-xl p-6 border border-white/10 shadow-xl mb-8"
          >
            <div className="flex items-center text-white mb-6">
              <Users className="h-6 w-6 mr-2 text-indigo-400" />
              <h2 className="text-2xl font-bold">Your Performance</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white/10 rounded-lg p-4 text-center">
                <div className="text-sm text-gray-300 mb-1">Rank</div>
                <div className="text-3xl font-bold text-white">
                  {currentPlayerRank}/{sortedPlayers.length}
                </div>
              </div>
              
              <div className="bg-white/10 rounded-lg p-4 text-center">
                <div className="text-sm text-gray-300 mb-1">Score</div>
                <div className="text-3xl font-bold text-indigo-300">
                  {sortedPlayers.find(p => p.name === playerName)?.score || 0}
                </div>
              </div>
              
              <div className="bg-white/10 rounded-lg p-4 text-center">
                <div className="text-sm text-gray-300 mb-1">Correct Answers</div>
                <div className="text-3xl font-bold text-green-400">
                  {sortedPlayers.find(p => p.name === playerName)?.correctAnswers || 0}/{results.totalQuestions}
                </div>
              </div>
            </div>
          </motion.div>
        )}
        
        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row justify-center gap-4 mt-auto">
          <Button
            variant="default"
            className="bg-indigo-600 hover:bg-indigo-700"
            onClick={() => navigate("/")}
          >
            <Home className="mr-2 h-4 w-4" />
            Return to Home
          </Button>
          
          <Button
            variant="outline"
            className="border-indigo-500 text-indigo-400 hover:bg-indigo-500/20"
            onClick={() => navigate("/multiplayer")}
          >
            <Users className="mr-2 h-4 w-4" />
            New Multiplayer Game
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MultiplayerResults;
