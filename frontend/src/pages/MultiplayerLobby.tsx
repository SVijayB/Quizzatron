import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { 
  Users, Check, Copy, ArrowLeft, Share2, Play, 
  Timer, RefreshCw, Settings, DivideCircle, AlertCircle, 
  Dices, Hash, Heart, User, BookOpen, Info
} from "lucide-react";
import CursorEffect from "@/components/CursorEffect";
import QuizLogo from "@/components/QuizLogo";
import EmojiAvatar from "@/components/EmojiAvatar";
import { Separator } from "@/components/ui/separator";
import { 
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";

interface Player {
  id: string;
  name: string;
  isHost: boolean;
  avatar: string;
  ready: boolean;
  emoji?: string; // Add emoji field for players
}

interface GameSettings {
  numQuestions: number;
  categories: string[];
  difficulty: string;
  timePerQuestion: number;
  allowSkipping: boolean;
  topic: string | null;  // Add topic to the interface
  model: string;
}

const MultiplayerLobby = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { lobbyCode } = useParams<{ lobbyCode: string }>();
  const [players, setPlayers] = useState<Player[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [gameSettings, setGameSettings] = useState<GameSettings>({
    numQuestions: 10,
    categories: [],
    difficulty: "medium",
    timePerQuestion: 15,
    allowSkipping: false,
    topic: null,  // Initialize topic as null
    model: "gemini"
  });
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(true); // Start with settings visible
  const [myEmoji, setMyEmoji] = useState('😀'); // Default emoji

  // Verify user is authorized to be in this lobby
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

    // Fetch initial lobby state
    fetchLobbyState();
    
    // Set up polling for lobby updates
    const pollingInterval = setInterval(fetchLobbyState, 3000);
    
    // If host, fetch categories for quiz settings
    if (storedIsHost) {
      fetchCategories();
    }

    return () => {
      clearInterval(pollingInterval);
    };
  }, [lobbyCode, navigate]);

  const fetchLobbyState = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:5000/api/multiplayer/lobby/${lobbyCode}`);

      if (!response.ok) {
        if (response.status === 404) {
          toast({
            title: "Lobby Not Found",
            description: "This lobby no longer exists.",
            variant: "destructive",
          });
          navigate("/multiplayer");
          return;
        }
        
        throw new Error("Failed to fetch lobby state");
      }

      const data = await response.json();
      
      setPlayers(data.players);
      
      // Update settings for all players, not just the host
      setGameSettings(data.settings);
      
      // Check if game has started
      if (data.game_started) {
        navigate(`/multiplayer/quiz/${lobbyCode}`);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching lobby state:", error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch("http://127.0.0.1:5000/api/categories");
      
      if (!response.ok) {
        throw new Error("Failed to fetch categories");
      }
      
      const data = await response.json();
      setAllCategories(data.categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const toggleReady = async () => {
    try {
      const response = await fetch("http://127.0.0.1:5000/api/multiplayer/ready", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lobby_code: lobbyCode,
          player_name: playerName,
          ready: !isReady,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update ready state");
      }

      setIsReady(!isReady);
      fetchLobbyState(); // Refresh player list
    } catch (error) {
      console.error("Error toggling ready state:", error);
      toast({
        title: "Error",
        description: "Failed to update ready state. Please try again.",
        variant: "destructive",
      });
    }
  };

  const updateGameSettings = async (updatedSettings: Partial<GameSettings>) => {
    if (!isHost) return;
    
    const newSettings = { ...gameSettings, ...updatedSettings };
    setGameSettings(newSettings);
    
    try {
      const response = await fetch("http://127.0.0.1:5000/api/multiplayer/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lobby_code: lobbyCode,
          settings: newSettings,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update game settings");
      }
    } catch (error) {
      console.error("Error updating game settings:", error);
      toast({
        title: "Error",
        description: "Failed to update game settings. Please try again.",
        variant: "destructive",
      });
    }
  };

  const startGame = async () => {
    if (!isHost) return;
    
    // Check if at least one player is ready (besides the host)
    const readyPlayers = players.filter(player => player.ready || player.isHost);
    if (readyPlayers.length < 2) {
      toast({
        title: "Cannot Start Game",
        description: "At least one other player must be ready to start the game.",
        variant: "destructive",
      });
      return;
    }
    
    setIsStartingGame(true);
    
    try {
      const response = await fetch("http://127.0.0.1:5000/api/multiplayer/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lobby_code: lobbyCode,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to start game");
      }

      navigate(`/multiplayer/quiz/${lobbyCode}`);
    } catch (error) {
      console.error("Error starting game:", error);
      toast({
        title: "Error",
        description: "Failed to start the game. Please try again.",
        variant: "destructive",
      });
      setIsStartingGame(false);
    }
  };

  const leaveLobby = async () => {
    try {
      // Only send a leave request if you're not the host
      if (!isHost) {
        await fetch("http://127.0.0.1:5000/api/multiplayer/leave", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            lobby_code: lobbyCode,
            player_name: playerName,
          }),
        });
      }
      
      // Clear local storage and navigate back to multiplayer menu
      localStorage.removeItem("lobbyCode");
      localStorage.removeItem("isHost");
      navigate("/multiplayer");
    } catch (error) {
      console.error("Error leaving lobby:", error);
      // Still navigate away even if there's an error
      navigate("/multiplayer");
    }
  };

  const copyLobbyCode = () => {
    navigator.clipboard.writeText(lobbyCode || "");
    toast({
      title: "Copied!",
      description: "Lobby code copied to clipboard",
    });
  };

  // Update player avatar emoji
  const updatePlayerEmoji = async (emoji: string) => {
    setMyEmoji(emoji);
    try {
      const response = await fetch("http://127.0.0.1:5000/api/multiplayer/update-avatar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lobby_code: lobbyCode,
          player_name: playerName,
          avatar: emoji,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update avatar");
      }
      
      // Refresh player list to see changes
      fetchLobbyState();
    } catch (error) {
      console.error("Error updating avatar:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-md p-8 rounded-xl shadow-lg text-white text-center">
          <RefreshCw className="animate-spin h-8 w-8 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Loading Lobby...</h2>
          <p>Please wait while we connect to the game server.</p>
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

      <div className="relative min-h-screen flex flex-col items-center py-12 px-4 z-10">
        <Button
          onClick={leaveLobby}
          variant="ghost"
          className="absolute top-4 left-4 text-white hover:bg-white/10"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {isHost ? "Close Lobby" : "Leave Lobby"}
        </Button>

        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-3xl"
        >
          <div className="flex items-center justify-center mb-8">
            <QuizLogo 
              size={60} 
              color="white" 
              className="mr-3" 
            />
            <div className="text-center">
              <h1 className="text-4xl font-bold text-white">
                Waiting Lobby
              </h1>
              <div className="flex items-center justify-center mt-2">
                <div className="bg-white/10 px-3 py-1 rounded-md font-mono text-white inline-flex items-center">
                  <Hash className="mr-1 h-4 w-4 text-pink-400" />
                  {lobbyCode}
                  <button 
                    onClick={copyLobbyCode}
                    className="ml-2 p-1 rounded hover:bg-white/10 transition-colors"
                    aria-label="Copy lobby code"
                  >
                    <Copy className="h-3.5 w-3.5 text-white/70" />
                  </button>
                </div>
                <Badge 
                  variant="outline" 
                  className="ml-3 bg-white/10 text-white border-transparent"
                >
                  {players.length} {players.length === 1 ? "Player" : "Players"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Reorganized layout: How to Play on left, Players in middle, Your Status on right */}
          <div className="grid grid-cols-1 md:grid-cols-10 gap-6">
            {/* How to Play Card - Left Column (3 columns wide) */}
            <Card className="md:col-span-3 bg-gradient-to-br from-[#3a3d6d] to-[#272a4e] border-white/20 shadow-[0_0_15px_rgba(139,92,246,0.15)]">
              <CardContent className="pt-6">
                <div className="text-center space-y-2">
                  <div className="inline-flex mx-auto items-center justify-center h-12 w-12 rounded-full bg-pink-500/20 text-pink-400 mb-1">
                    <Heart className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">How to Play</h3>
                  <p className="text-sm text-white/70 mb-2">
                    Answer questions quickly to earn more points. The faster you answer correctly, the higher your score!
                  </p>
                  <ul className="text-left text-sm space-y-1.5 text-white/70">
                    <li className="flex items-start">
                      <div className="min-w-4 mt-0.5 mr-2">•</div>
                      <div>Everyone gets the same questions in the same order</div>
                    </li>
                    <li className="flex items-start">
                      <div className="min-w-4 mt-0.5 mr-2">•</div>
                      <div>Answer quickly for more points</div>
                    </li>
                    <li className="flex items-start">
                      <div className="min-w-4 mt-0.5 mr-2">•</div>
                      <div>See everyone's progress in real-time</div>
                    </li>
                    <li className="flex items-start">
                      <div className="min-w-4 mt-0.5 mr-2">•</div>
                      <div>Final results will be displayed at the end</div>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          
            {/* Middle column with Players and Game Settings (4 columns wide) */}
            <div className="md:col-span-4 space-y-6">
              {/* Players Section */}
              <Card className="bg-white/10 backdrop-blur-sm border-white/20 shadow-[0_0_15px_rgba(139,92,246,0.15)]">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl text-white flex items-center">
                    <Users className="w-5 h-5 mr-2 text-pink-400" />
                    Players
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <AnimatePresence>
                      {players.map((player) => (
                        <motion.div
                          key={player.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.3 }}
                          className="flex items-center justify-between p-3 rounded-lg bg-white/5 backdrop-blur-sm"
                        >
                          <div className="flex items-center">
                            <EmojiAvatar 
                              initialEmoji={player.avatar}
                              size={40}
                              isInteractive={player.name === playerName}
                              onEmojiChange={player.name === playerName ? updatePlayerEmoji : undefined}
                              className="mr-3"
                            />
                            <div>
                              <div className="flex items-center">
                                <p className="font-medium text-white">{player.name}</p>
                                {player.isHost && <span className="ml-2 text-xs text-amber-400">(Host)</span>}
                                {player.name === playerName && <span className="ml-2 text-xs text-green-400">(You)</span>}
                              </div>
                              <div className="flex items-center mt-1">
                                <Badge 
                                  variant="outline"
                                  className={`text-xs border-transparent ${
                                    player.ready ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/50'
                                  }`}
                                >
                                  {player.ready ? (
                                    <Check className="w-3 h-3 mr-1" />
                                  ) : (
                                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                                  )}
                                  {player.ready ? "Ready" : "Not Ready"}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </CardContent>
              </Card>

              {/* Game Settings visible to all, editable only by host */}
              <Card className="bg-white/10 backdrop-blur-sm border-white/20 shadow-[0_0_15px_rgba(139,92,246,0.15)]">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-xl text-white flex items-center">
                      <Settings className="w-5 h-5 mr-2 text-amber-400" />
                      Game Settings
                      {!isHost && <span className="ml-2 text-xs text-white/60">(View Only)</span>}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white/70 hover:text-white hover:bg-white/10"
                      onClick={() => setShowSettings(!showSettings)}
                    >
                      {showSettings ? "Hide" : "Show"}
                    </Button>
                  </div>
                </CardHeader>
                <AnimatePresence>
                  {showSettings && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <CardContent className="space-y-4">
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center">
                              <DivideCircle className="w-4 h-4 mr-2 text-blue-400" />
                              <Label className="text-white">Number of Questions</Label>
                            </div>
                            <span className="text-white font-medium">{gameSettings.numQuestions}</span>
                          </div>
                          <Slider
                            value={[gameSettings.numQuestions]}
                            min={5}
                            max={20}
                            step={5}
                            className="w-full"
                            onValueChange={(value) => isHost && updateGameSettings({ numQuestions: value[0] })}
                            disabled={!isHost}
                          />
                          <div className="flex justify-between text-xs text-white/50 mt-1">
                            <span>5</span>
                            <span>10</span>
                            <span>15</span>
                            <span>20</span>
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex items-center mb-2">
                            <Timer className="w-4 h-4 mr-2 text-green-400" />
                            <Label className="text-white">Time per Question</Label>
                          </div>
                          <Select
                            value={gameSettings.timePerQuestion.toString()}
                            onValueChange={(value) => isHost && updateGameSettings({ timePerQuestion: parseInt(value) })}
                            disabled={!isHost}
                          >
                            <SelectTrigger className={`bg-white/10 border-white/20 text-white ${!isHost ? 'opacity-80' : ''}`}>
                              <SelectValue placeholder="Select time limit" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1e1e40] border-white/20 text-white">
                              <SelectItem value="10">10 seconds</SelectItem>
                              <SelectItem value="15">15 seconds</SelectItem>
                              <SelectItem value="20">20 seconds</SelectItem>
                              <SelectItem value="30">30 seconds</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <div className="flex items-center mb-2">
                            <AlertCircle className="w-4 h-4 mr-2 text-red-400" />
                            <Label className="text-white">Difficulty</Label>
                          </div>
                          <Select
                            value={gameSettings.difficulty}
                            onValueChange={(value) => isHost && updateGameSettings({ difficulty: value })}
                            disabled={!isHost}
                          >
                            <SelectTrigger className={`bg-white/10 border-white/20 text-white ${!isHost ? 'opacity-80' : ''}`}>
                              <SelectValue placeholder="Select difficulty" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1e1e40] border-white/20 text-white">
                              <SelectItem value="easy">Easy</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="hard">Hard</SelectItem>
                              <SelectItem value="mixed">Mixed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="allow-skipping"
                            checked={gameSettings.allowSkipping}
                            onCheckedChange={(checked) => isHost && updateGameSettings({ allowSkipping: checked })}
                            disabled={!isHost}
                          />
                          <Label htmlFor="allow-skipping" className="text-white">
                            Allow skipping questions
                          </Label>
                        </div>

                        <div>
                          <div className="flex items-center mb-2">
                            <BookOpen className="w-4 h-4 mr-2 text-purple-400" />
                            <Label className="text-white">Topic</Label>
                          </div>
                          <Input
                            value={gameSettings.topic || ""}
                            onChange={(e) => isHost && updateGameSettings({ topic: e.target.value })}
                            placeholder="Enter a topic (optional)"
                            className={`bg-white/10 border-white/20 text-white ${!isHost ? 'opacity-80 cursor-not-allowed' : ''}`}
                            disabled={!isHost}
                          />
                        </div>
                      </CardContent>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </div>

            {/* Your Status Card - Right Column (3 columns wide) */}
            <Card className="md:col-span-3 bg-white/10 backdrop-blur-sm border-white/20 shadow-[0_0_15px_rgba(139,92,246,0.15)]">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg text-white flex items-center">
                  <User className="w-5 h-5 mr-2 text-teal-400" />
                  Your Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <EmojiAvatar
                    initialEmoji={players.find(p => p.name === playerName)?.avatar || myEmoji}
                    onEmojiChange={updatePlayerEmoji}
                    size={56}
                    isInteractive={true}
                    className="static" // Remove the animate-pulse class to stop blinking
                  />
                  <div>
                    <p className="font-semibold text-white">{playerName}</p>
                    <Badge 
                      variant="outline"
                      className={`mt-1 border-transparent ${
                        isHost ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10 text-white/70'
                      }`}
                    >
                      {isHost ? "Host" : "Player"}
                    </Badge>
                  </div>
                </div>
                
                <Separator className="bg-white/10" />
                
                {isHost ? (
                  <div className="space-y-4">
                    <Button
                      onClick={startGame}
                      disabled={isStartingGame || players.length < 2}
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                    >
                      {isStartingGame ? (
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="mr-2 h-4 w-4" />
                      )}
                      {isStartingGame ? "Starting Game..." : "Start Game"}
                    </Button>
                    
                    <div className="rounded-lg bg-white/10 p-3 text-sm text-white/70">
                      <p className="flex items-center mb-2">
                        <InfoIcon className="mr-2 h-4 w-4 text-blue-400" />
                        As the host, you can start the game when at least one other player is ready.
                      </p>
                      <p className="flex items-center">
                        <Share2 className="mr-2 h-4 w-4 text-pink-400" />
                        Share the lobby code with friends to invite them.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Button
                      onClick={toggleReady}
                      className={`w-full ${
                        isReady 
                          ? 'bg-yellow-500 hover:bg-yellow-600 text-yellow-950' 
                          : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white'
                      }`}
                    >
                      {isReady ? (
                        <>
                          <Dices className="mr-2 h-4 w-4" />
                          Cancel Ready
                        </>
                      ) : (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          I'm Ready
                        </>
                      )}
                    </Button>
                    
                    <div className="rounded-lg bg-white/10 p-3 text-sm text-white/70">
                      <p className="flex items-center">
                        <InfoIcon className="mr-2 h-4 w-4 text-blue-400" />
                        The host will start the game when everyone is ready.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

// Helper icon component
const InfoIcon = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </svg>
);

export default MultiplayerLobby;