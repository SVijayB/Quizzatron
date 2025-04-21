import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";
import { Trophy, Medal, Home, Users, Star } from "lucide-react";
import CursorEffect from "@/components/CursorEffect";
import QuizLogo from "@/components/QuizLogo";
import confetti from "canvas-confetti";

interface PlayerResult {
  id: string;
  name: string;
  isHost: boolean;
  avatar: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  answers: {
    question: string;
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    score: number;
  }[];
}

const MultiplayerResults = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { lobbyCode } = useParams<{ lobbyCode: string }>();
  const [results, setResults] = useState<PlayerResult[]>([]);
  const [playerName, setPlayerName] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [isLoadingResults, setIsLoadingResults] = useState(true);

  useEffect(() => {
    // Show confetti celebration effect
    const duration = 3 * 1000;
    const end = Date.now() + duration;
    
    // Default confetti options
    const defaults = { 
      startVelocity: 30, 
      spread: 360, 
      ticks: 60, 
      zIndex: 0,
      shapes: ['square', 'circle'],
      colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff']
    };
    
    function randomInRange(min, max) {
      return Math.random() * (max - min) + min;
    }
    
    const interval = setInterval(() => {
      const timeLeft = end - Date.now();
      
      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }
      
      const particleCount = 50 * (timeLeft / duration);
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const storedPlayerName = localStorage.getItem("playerName");
    const storedLobbyCode = localStorage.getItem("lobbyCode");
    const storedIsHost = localStorage.getItem("isHost") === "true";

    if (!storedPlayerName || !storedLobbyCode || storedLobbyCode !== lobbyCode) {
      navigate("/multiplayer");
      return;
    }

    setPlayerName(storedPlayerName);
    setIsHost(storedIsHost);

    // Try to load results from localStorage first (client-side)
    const localResults = localStorage.getItem("multiplayerResults");
    if (localResults) {
      try {
        const parsedResults = JSON.parse(localResults);
        if (Array.isArray(parsedResults)) {
          // Sort results by score in descending order
          parsedResults.sort((a, b) => b.score - a.score);
          setResults(parsedResults);
          setIsLoadingResults(false);
          return;
        }
      } catch (error) {
        console.error("Error parsing local results:", error);
      }
    }

    // Fallback to fetching results from the server
    fetchResults();
  }, [lobbyCode, navigate]);

  const fetchResults = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:5000/api/multiplayer/results/${lobbyCode}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch results");
      }

      const data = await response.json();
      
      if (data.players && Array.isArray(data.players)) {
        // Sort results by score in descending order
        data.players.sort((a, b) => b.score - a.score);
        setResults(data.players);
      } else {
        throw new Error("Invalid results format");
      }
    } catch (error) {
      console.error("Error fetching results:", error);
      toast({
        title: "Error",
        description: "Failed to load quiz results. Returning to multiplayer menu.",
        variant: "destructive",
      });
      navigate("/multiplayer");
    } finally {
      setIsLoadingResults(false);
    }
  };

  // Generate a color for avatar fallback based on player name
  const getAvatarColor = (name: string) => {
    const colors = [
      "bg-red-500", "bg-blue-500", "bg-green-500", "bg-yellow-500", 
      "bg-purple-500", "bg-pink-500", "bg-indigo-500", "bg-teal-500"
    ];
    
    // Simple hash function to get consistent color based on name
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  };

  // Get medal component based on position
  const getMedal = (position: number) => {
    switch (position) {
      case 0:
        return <Trophy className="h-5 w-5 text-yellow-400" />;
      case 1:
        return <Medal className="h-5 w-5 text-gray-300" />;
      case 2:
        return <Medal className="h-5 w-5 text-amber-600" />;
      default:
        return null;
    }
  };

  // Get a fun emoji avatar for a player based on their name
  const getPlayerEmoji = (name: string) => {
    const emojis = ["👑", "🦁", "🐯", "🐺", "🦊", "🦝", "🐮", "🐷", "🐹", "🐭", "🐰", "🐻", "🐨", "🐼", "🦄", "🐲", "🐸", "🦩", "🦜", "🦢", "🦚", "🦉", "🐢", "🐙", "🦑", "🦀", "🐡", "🐠", "🐳", "🐬", "🦈"];
    
    // Simple hash function to get a consistent emoji based on name
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return emojis[Math.abs(hash) % emojis.length];
  };

  if (isLoadingResults) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-md p-8 rounded-xl shadow-lg text-white text-center">
          <h2 className="text-2xl font-bold mb-4">Loading Results...</h2>
          <p>Please wait while we compile the final standings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#1a1a2e]">
      <CursorEffect />
      
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f3ed0,#8b5cf6)] opacity-50" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#1a1a2e_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_800px_at_100%_200px,#4f3ed0,transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_800px_at_0%_300px,#8b5cf6,transparent)]" />
        <div className="absolute inset-0 bg-grid-white/[0.02] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]" />
      </div>

      <div className="relative min-h-screen py-8 px-4 z-10">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-center mb-12">
            <QuizLogo 
              size={60} 
              color="white" 
              className="mr-3" 
            />
            <div className="text-center">
              <h1 className="text-4xl md:text-5xl font-bold text-white">
                Final Results
                <span className="text-yellow-400">!</span>
              </h1>
              <p className="text-lg text-white/70 mt-2">
                Lobby: <span className="font-mono bg-white/10 px-2 py-0.5 rounded-md">{lobbyCode}</span>
              </p>
            </div>
          </div>

          {/* Winner's Podium for Top 3 */}
          {results.length > 0 && (
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-center text-white mb-8">
                Winner's Podium
              </h2>
              
              <div className="flex flex-col md:flex-row justify-center items-end gap-4 md:gap-8">
                {/* Only show podium for players that exist */}
                {results.length > 1 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                    className="order-2 md:order-1 flex flex-col items-center"
                  >
                    <div className="relative mb-2">
                      <div className="absolute -top-3 -right-3 p-1.5 rounded-full bg-gray-300 shadow-lg">
                        <Medal className="h-4 w-4 text-gray-700" />
                      </div>
                      <Avatar className="h-20 w-20 border-4 border-gray-300 shadow-xl">
                        <AvatarImage src={results[1].avatar} alt={results[1].name} />
                        <AvatarFallback className={`${getAvatarColor(results[1].name)} text-white text-2xl`}>
                          {getPlayerEmoji(results[1].name)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <h3 className="text-base font-semibold text-white text-center mt-2">
                      {results[1].name}
                    </h3>
                    <div className="text-lg font-bold text-gray-300">
                      {results[1].score} pts
                    </div>
                    <div className="h-24 w-16 bg-gray-300/30 backdrop-blur-sm rounded-t-lg mt-2 flex items-end justify-center pb-2">
                      <span className="text-lg font-bold text-white">2</span>
                    </div>
                  </motion.div>
                )}
                
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="order-1 md:order-2 flex flex-col items-center"
                >
                  <div className="relative mb-2">
                    <div className="absolute -top-3 -right-3 p-1.5 rounded-full bg-yellow-400 shadow-lg">
                      <Trophy className="h-5 w-5 text-yellow-700" />
                    </div>
                    <Avatar className="h-28 w-28 border-4 border-yellow-400 shadow-xl">
                      <AvatarImage src={results[0].avatar} alt={results[0].name} />
                      <AvatarFallback className={`${getAvatarColor(results[0].name)} text-white text-3xl`}>
                        {getPlayerEmoji(results[0].name)}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <h3 className="text-xl font-bold text-white text-center mt-2">
                    {results[0].name}
                  </h3>
                  <div className="text-2xl font-bold text-yellow-400">
                    {results[0].score} pts
                  </div>
                  <div className="h-32 w-20 bg-yellow-400/30 backdrop-blur-sm rounded-t-lg mt-2 flex items-end justify-center pb-2">
                    <span className="text-2xl font-bold text-white">1</span>
                  </div>
                </motion.div>
                
                {results.length > 2 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6, duration: 0.5 }}
                    className="order-3 flex flex-col items-center"
                  >
                    <div className="relative mb-2">
                      <div className="absolute -top-3 -right-3 p-1.5 rounded-full bg-amber-600 shadow-lg">
                        <Medal className="h-4 w-4 text-amber-900" />
                      </div>
                      <Avatar className="h-16 w-16 border-4 border-amber-600 shadow-xl">
                        <AvatarImage src={results[2].avatar} alt={results[2].name} />
                        <AvatarFallback className={`${getAvatarColor(results[2].name)} text-white text-xl`}>
                          {getPlayerEmoji(results[2].name)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <h3 className="text-base font-semibold text-white text-center mt-2">
                      {results[2].name}
                    </h3>
                    <div className="text-lg font-bold text-amber-600">
                      {results[2].score} pts
                    </div>
                    <div className="h-18 w-16 bg-amber-600/30 backdrop-blur-sm rounded-t-lg mt-2 flex items-end justifycenter pb-2">
                      <span className="text-lg font-bold text-white">3</span>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          )}

          {/* Complete Leaderboard */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.5 }}
          >
            <Card className="bg-white/10 backdrop-blur-sm border-white/20 shadow-[0_0_15px_rgba(139,92,246,0.15)] mb-6">
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl text-white flex items-center">
                  <Users className="w-5 h-5 mr-2 text-pink-400" />
                  Complete Leaderboard
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden sm:rounded-lg">
                  <table className="min-w-full divide-y divide-white/10">
                    <thead className="bg-white/5">
                      <tr>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-white">#</th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-white">Player</th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-white">Correct</th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-white">Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      <AnimatePresence>
                        {results.map((player, index) => (
                          <motion.tr 
                            key={player.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 * index, duration: 0.3 }}
                            className={`${player.name === playerName ? 'bg-white/10' : ''}`}
                          >
                            <td className="whitespace-nowrap px-3 py-4 text-sm">
                              <div className="flex items-center">
                                <span className="text-white font-semibold w-6 text-center">{index + 1}</span>
                                {getMedal(index)}
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm">
                              <div className="flex items-center">
                                <Avatar className="h-8 w-8 mr-2">
                                  <AvatarImage src={player.avatar} alt={player.name} />
                                  <AvatarFallback className={`${getAvatarColor(player.name)} text-white text-xs`}>
                                    {getPlayerEmoji(player.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="text-white">{player.name}</div>
                                {player.isHost && <span className="ml-2 text-xs text-amber-400">(Host)</span>}
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm">
                              <div className="text-white">
                                {player.correctAnswers} of {player.totalQuestions}
                                <span className="ml-2 text-xs text-white/60">
                                  ({Math.round((player.correctAnswers / player.totalQuestions) * 100)}%)
                                </span>
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm">
                              <div className="font-bold text-amber-400">{player.score}</div>
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <div className="flex justify-center mt-6">
            {isHost ? (
              <div className="flex gap-4">
                <Button
                  onClick={() => navigate("/")}
                  variant="outline"
                  className="bg-white/10 hover:bg-white/15 text-white border-white/20"
                >
                  <Home className="mr-2 h-4 w-4" /> Return Home
                </Button>
                <Button
                  onClick={() => navigate("/multiplayer")}
                  className="bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white"
                >
                  <Users className="mr-2 h-4 w-4" /> New Multiplayer Quiz
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => navigate("/multiplayer")}
                className="bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white"
              >
                <Users className="mr-2 h-4 w-4" /> Play Again
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiplayerResults;