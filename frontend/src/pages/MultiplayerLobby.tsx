import { useState, useEffect, useRef, useCallback, useReducer } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, Check, Copy, ArrowLeft, Share2, Play, 
  Timer, RefreshCw, Settings, DivideCircle, AlertCircle, 
  Dices, Hash, Heart, User, BookOpen, Info as InfoIcon
} from "lucide-react";
import CursorEffect from "@/components/CursorEffect";
import QuizLogo from "@/components/QuizLogo";
import EmojiAvatar from "@/components/EmojiAvatar";
import { 
  getLobbyInfo, 
  toggleReadyStatus, 
  updateGameSettings as updateSettings, 
  startGame as startGameAPI, 
  leaveLobby as leaveLobbyAPI, 
  updatePlayerAvatar,
  initializeSocket,
  joinSocketRoom,
  leaveSocketRoom,
  socketStartGame,
  onSocketEvent 
} from "@/services/multiplayerService";
import { useToast } from "@/components/ui/use-toast";
import "./MultiplayerLobby.css";

interface Player {
  id: string;
  name: string;
  isHost: boolean;
  avatar: string;
  ready: boolean;
}

interface GameSettings {
  numQuestions: number;
  categories: string[];
  difficulty: string;
  timePerQuestion: number;
  allowSkipping: boolean;
  topic: string | null;
  model: string;
}

const MultiplayerLobby = () => {
  const navigate = useNavigate();
  const { lobbyCode } = useParams<{ lobbyCode: string }>();
  const { toast } = useToast();
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
    topic: null,
    model: "gemini"
  });
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(true);
  const [myEmoji, setMyEmoji] = useState('😀');
  const [copySuccess, setCopySuccess] = useState(false);
  const [playerId, setPlayerId] = useState<string>("");
  
  // Socket cleanup handlers
  const socketCleanupFns = useRef<(() => void)[]>([]);

  // Improved socket connection tracking
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef<any>(null);
  
  // Keep track of last socket update time
  const lastSocketUpdateRef = useRef<number>(Date.now());
  
  // Add ref for polling interval
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track whether initial state has been loaded
  const [initialStateLoaded, setInitialStateLoaded] = useState(false);
  
  // Keep track of last update time to force re-renders
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  
  // Use ref to avoid dependency issues in useEffect
  const settingsRef = useRef(gameSettings);
  const playersRef = useRef(players);
  
  // Add key to force component refresh when settings change
  const forceUpdate = useReducer(x => x + 1, 0)[1];
  
  // Add state for topic input to handle it separately
  const [topicInput, setTopicInput] = useState("");

  // Update refs when state changes
  useEffect(() => {
    settingsRef.current = gameSettings;
  }, [gameSettings]);
  
  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  // Verify user is authorized to be in this lobby
  useEffect(() => {
    const storedPlayerName = localStorage.getItem("playerName");
    const storedLobbyCode = localStorage.getItem("lobbyCode");
    const storedIsHost = localStorage.getItem("isHost") === "true";
    const storedEmoji = localStorage.getItem("playerEmoji");
    const storedPlayerId = localStorage.getItem("playerId");

    if (!storedPlayerName || !storedLobbyCode || storedLobbyCode !== lobbyCode) {
      navigate("/multiplayer");
      return;
    }

    setPlayerName(storedPlayerName);
    setIsHost(storedIsHost);
    setPlayerId(storedPlayerId || "");
    
    // Set the emoji from localStorage if available
    if (storedEmoji) {
      setMyEmoji(storedEmoji);
    }

    // Initialize socket and store in ref
    const socket = initializeSocket();
    socketRef.current = socket;
    setSocketConnected(!!socket?.connected);
    
    // Setup socket event listeners
    const setupSocketEvents = () => {
      // Clear any previous listeners
      if (socketCleanupFns.current.length > 0) {
        socketCleanupFns.current.forEach(cleanup => cleanup());
        socketCleanupFns.current = [];
      }
      
      // Register new listeners
      socketCleanupFns.current.push(
        onSocketEvent("connect", () => {
          console.log("Socket connected directly");
          setSocketConnected(true);
          
          // Join the room after connecting
          if (storedPlayerId && storedLobbyCode) {
            joinSocketRoom(storedLobbyCode, storedPlayerName, storedPlayerId);
          }
        }),
        
        onSocketEvent("disconnect", () => {
          console.log("Socket disconnected directly");
          setSocketConnected(false);
        }),
        
        onSocketEvent("connection_response", (data) => {
          console.log("Socket connected via response:", data);
          setSocketConnected(true);
          
          // Join the room after confirming connection
          if (storedPlayerId && storedLobbyCode) {
            joinSocketRoom(storedLobbyCode, storedPlayerName, storedPlayerId);
          }
        }),
        
        onSocketEvent("room_joined", (data) => {
          console.log("Joined room:", data);
          // Fetch initial lobby state after joining
          fetchLobbyState();
        }),
        
        onSocketEvent("lobby_update", (data) => {
          console.log("Received lobby update:", data);
          lastSocketUpdateRef.current = Date.now();
          
          // Update players if included in the update - apply immediately without comparison
          if (data.players) {
            console.log("Updating players state:", data.players);
            setPlayers(data.players);
            
            // Update my ready status
            const myPlayer = data.players.find((p) => p.name === storedPlayerName);
            if (myPlayer) {
              setIsReady(!!myPlayer.ready);
            }
          }
          
          // Update settings if included in the update - apply immediately without comparison
          if (data.settings) {
            console.log("Updating settings state:", data.settings);
            setGameSettings(data.settings);
          }
          
          // Mark initial state as loaded
          setInitialStateLoaded(true);
          
          // Force a re-render for all updates
          setLastUpdate(Date.now());
        }),
        
        onSocketEvent("player_joined", (data) => {
          toast({
            title: "New player joined",
            description: `${data.name} has joined the lobby`,
          });
          // Refresh lobby state to get updated player list
          fetchLobbyState();
        }),
        
        onSocketEvent("player_left", (data) => {
          toast({
            title: "Player left",
            description: `${data.name} has left the lobby`,
          });
          // Refresh lobby state to get updated player list
          fetchLobbyState();
        }),
        
        onSocketEvent("game_started", () => {
          navigate(`/multiplayer/quiz/${lobbyCode}`);
        }),
        
        onSocketEvent("error", (data) => {
          toast({
            title: "Error",
            description: data.message || "An error occurred",
            variant: "destructive",
          });
        })
      );
    };
    
    // Setup socket events
    setupSocketEvents();
    
    // Fetch initial lobby state once
    fetchLobbyState();
    
    // If host, fetch categories for quiz settings
    if (storedIsHost) {
      fetchCategories();
    }
    
    // Set up a more intelligent polling fallback that:
    // 1. Doesn't poll if socket is connected
    // 2. Doesn't poll if we received a socket update recently
    // 3. Decreases polling frequency over time to reduce server load
    pollIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceLastSocketUpdate = now - lastSocketUpdateRef.current;
      const socketIsActive = socketRef.current?.connected;
      
      // Only poll if socket is disconnected AND we haven't had socket updates recently (5+ seconds)
      if (!socketIsActive && timeSinceLastSocketUpdate > 5000) {
        console.log("Socket inactive, using polling fallback");
        fetchLobbyState();
      }
    }, 5000); // Poll every 5 seconds if needed

    return () => {
      // Clean up socket event listeners
      socketCleanupFns.current.forEach(cleanup => cleanup());
      socketCleanupFns.current = [];
      
      // Clear polling interval
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      
      // Leave room when component unmounts
      if (storedPlayerId && lobbyCode) {
        leaveSocketRoom(lobbyCode, storedPlayerName, storedPlayerId);
      }
    };
  }, [lobbyCode, navigate, toast]);

  const fetchLobbyState = async () => {
    try {
      console.log("Fetching lobby state via REST API...");
      const data = await getLobbyInfo(lobbyCode!);
      console.log("Received lobby state from REST API:", data);
      
      // Only update state if we haven't loaded initial state yet or socket is disconnected
      // This prevents REST API responses from overwriting more recent socket updates
      if (!initialStateLoaded || !socketConnected) {
        setPlayers(data.players || []);
        setGameSettings(data.settings || gameSettings);
        
        // Find my player and update ready status
        const myPlayer = data.players?.find((p: Player) => p.name === playerName);
        if (myPlayer) {
          setIsReady(!!myPlayer.ready);
        }
        
        setInitialStateLoaded(true);
      }
      
      // Always check if game has started, regardless of socket status
      if (data.game_started) {
        navigate(`/multiplayer/quiz/${lobbyCode}`);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching lobby state:", error);
      if (error instanceof Error && error.message === "Lobby not found") {
        navigate("/multiplayer");
      }
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
      await toggleReadyStatus(lobbyCode!, playerName, !isReady);
      setIsReady(!isReady);
      
      // No need to fetch lobby state as we'll receive a socket update
    } catch (error) {
      console.error("Error toggling ready state:", error);
      toast({
        title: "Error",
        description: "Failed to update ready status",
        variant: "destructive",
      });
    }
  };

  // Optimize the settings update handler for immediate UI feedback
  const handleUpdateSettings = async (updatedSettings: Partial<GameSettings>) => {
    if (!isHost) return;
    
    // Apply changes to local state immediately for responsive UI
    const newSettings = { ...gameSettings, ...updatedSettings };
    
    // Update local state right away for immediate feedback
    setGameSettings(newSettings);
    console.log("Local settings updated:", newSettings);
    
    try {
      // Send update to server
      console.log("Sending settings update to server:", newSettings);
      await updateSettings(lobbyCode!, newSettings);
    } catch (error) {
      console.error("Error updating game settings:", error);
      toast({
        title: "Error",
        description: "Failed to update game settings",
        variant: "destructive",
      });
      
      // Only fetch if socket is not connected, otherwise we'll get update via socket
      if (!socketConnected) {
        fetchLobbyState();
      }
    }
  };
  
  // Debounce the settings update to prevent too many API calls
  const debouncedHandleUpdateSettings = useCallback(
    debounce((settings: Partial<GameSettings>) => {
      handleUpdateSettings(settings);
    }, 300),
    [gameSettings, lobbyCode]
  );
  
  // Debug log for settings changes
  useEffect(() => {
    console.log("Game settings updated:", gameSettings);
  }, [gameSettings]);

  // Debug log for player changes
  useEffect(() => {
    console.log("Players updated:", players);
  }, [players]);

  const handleStartGame = async () => {
    if (!isHost) return;
    
    // Check if at least one player is ready (besides the host)
    const readyPlayers = players.filter(player => player.ready || player.isHost);
    if (readyPlayers.length < 2) {
      toast({
        title: "Cannot start game",
        description: "At least one player besides the host must be ready",
        variant: "destructive",
      });
      return;
    }
    
    setIsStartingGame(true);
    
    try {
      // Use the socket method to start the game
      socketStartGame(lobbyCode!);
      
      // The navigation will happen when we receive the game_started event
    } catch (error) {
      console.error("Error starting game:", error);
      setIsStartingGame(false);
      toast({
        title: "Error",
        description: "Failed to start the game",
        variant: "destructive",
      });
    }
  };

  const handleLeaveLobby = async () => {
    try {
      // Leave the socket room first
      if (playerId && lobbyCode) {
        leaveSocketRoom(lobbyCode, playerName, playerId);
      }
      
      // Only send a leave request if you're not the host
      if (!isHost) {
        await leaveLobbyAPI(lobbyCode!, playerName);
      }
      
      // Clear local storage and navigate back to multiplayer menu
      localStorage.removeItem("lobbyCode");
      localStorage.removeItem("isHost");
      localStorage.removeItem("playerId");
      navigate("/multiplayer");
    } catch (error) {
      console.error("Error leaving lobby:", error);
      // Still navigate away even if there's an error
      navigate("/multiplayer");
    }
  };

  const copyLobbyCode = () => {
    navigator.clipboard.writeText(lobbyCode || "");
    setCopySuccess(true);
    
    // Hide the notification after 2 seconds
    setTimeout(() => {
      setCopySuccess(false);
    }, 2000);
  };

  // Update player avatar emoji
  const updatePlayerEmoji = async (emoji: string) => {
    setMyEmoji(emoji);
    try {
      await updatePlayerAvatar(lobbyCode!, playerName, emoji);
      
      // Save emoji to localStorage for persistence
      localStorage.setItem("playerEmoji", emoji);
      
      // No need to fetch lobby state as we'll receive a socket update
    } catch (error) {
      console.error("Error updating avatar:", error);
      toast({
        title: "Error",
        description: "Failed to update avatar",
        variant: "destructive",
      });
    }
  };

  // Check if all non-host players are ready
  const areAllPlayersReady = () => {
    // Skip the host when checking ready status
    const nonHostPlayers = players.filter(player => !player.isHost);
    
    // If there are no non-host players, return false
    if (nonHostPlayers.length === 0) return false;
    
    // Return true only if all non-host players are ready
    return nonHostPlayers.every(player => player.ready);
  };

  // Set topic input initial value
  useEffect(() => {
    setTopicInput(gameSettings.topic || "");
  }, [gameSettings.topic]);
  
  // Update gameSettings.topic when topicInput changes and debounce API call
  useEffect(() => {
    // Don't do anything on first render
    if (!initialStateLoaded) return;
    
    // Update the settings object with the new topic
    setGameSettings(prev => ({
      ...prev,
      topic: topicInput || null
    }));
    
    // Debounce API call
    if (isHost) {
      const timer = setTimeout(() => {
        handleUpdateSettings({ topic: topicInput || null });
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [topicInput, isHost, initialStateLoaded]);

  if (isLoading) {
    return (
      <div className="lobby-background">
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="bg-white/10 backdrop-blur-md p-8 rounded-xl shadow-lg text-white text-center">
            <RefreshCw className="animate-spin h-8 w-8 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Loading Lobby...</h2>
            <p>Please wait while we connect to the game server.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lobby-background">
      <CursorEffect />
      
      {/* Background gradient layers */}
      <div className="lobby-gradient-overlay" />
      <div className="lobby-radial-overlay-1" />
      <div className="lobby-radial-overlay-2" />
      <div className="lobby-radial-overlay-3" />
      <div class="lobby-grid-overlay" />

      {/* Copy notification */}
      <AnimatePresence>
        {copySuccess && (
          <motion.div 
            className="copy-notification"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
          >
            <Check className="copy-notification-icon" />
            Lobby code copied to clipboard!
          </motion.div>
        )}
      </AnimatePresence>

      <div className="lobby-content">
        {/* Back/Exit button */}
        <button
          onClick={handleLeaveLobby}
          className="exit-button"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {isHost ? "Close Lobby" : "Leave Lobby"}
        </button>

        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-3xl"
        >
          {/* Header with logo and lobby info */}
          <div className="lobby-header">
            <div className="text-center">
              <div className="flex items-center justify-center">
                <QuizLogo size={60} color="white" className="mr-3" />
                <h1 className="lobby-title">Waiting Lobby</h1>
              </div>
              
              <div className="flex items-center justify-center mt-2">
                <div className="lobby-code">
                  <Hash className="lobby-code-icon" />
                  {lobbyCode}
                  <button 
                    onClick={copyLobbyCode}
                    className="lobby-copy-button"
                    aria-label="Copy lobby code"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="lobby-player-count ml-4">
                  {players.length} {players.length === 1 ? "Player" : "Players"}
                </div>
              </div>
            </div>
          </div>

          {/* The main three-card layout with independent widths */}
          <div className="lobby-layout">
            {/* How to Play Card - width: 300px */}
            <div className="how-to-play-card">
              <div className="card-content">
                <div className="text-center space-y-2">
                  <div className="how-to-play-icon-container">
                    <Heart className="h-6 w-6" />
                  </div>
                  <h3 className="how-to-play-title">How to Play</h3>
                  <p className="how-to-play-description">
                    Answer questions quickly to earn more points. The faster you answer correctly, the higher your score!
                  </p>
                  <ul className="how-to-play-list space-y-1.5">
                    <li className="how-to-play-list-item">
                      <div className="how-to-play-list-bullet">•</div>
                      <div>Everyone gets the same questions in the same order</div>
                    </li>
                    <li className="how-to-play-list-item">
                      <div className="how-to-play-list-bullet">•</div>
                      <div>Answer quickly for more points</div>
                    </li>
                    <li className="how-to-play-list-item">
                      <div className="how-to-play-list-bullet">•</div>
                      <div>See everyone's progress in real-time</div>
                    </li>
                    <li className="how-to-play-list-item">
                      <div className="how-to-play-list-bullet">•</div>
                      <div>Final results will be displayed at the end</div>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          
            {/* Players and Game Settings - width: 1500px */}
            <div className="players-card">
              <div className="space-y-6">
                {/* Players Section */}
                <div>
                  <div className="card-header">
                    <div className="card-title">
                      <Users className="card-title-icon text-pink-400" />
                      Players
                    </div>
                  </div>
                  <div className="card-content">
                    <div className="player-list">
                      <AnimatePresence>
                        {players.map((player) => (
                          <motion.div
                            key={player.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                            className="player-item"
                          >
                            <div className="player-info">
                              <EmojiAvatar 
                                initialEmoji={player.avatar}
                                size={40}
                                isInteractive={false}
                                className="player-avatar"
                              />
                              <div>
                                <div className="flex items-center">
                                  <p className="player-name">{player.name}</p>
                                  {player.isHost && <span className="player-host-tag">(Host)</span>}
                                  {player.name === playerName && <span className="player-you-tag">(You)</span>}
                                </div>
                                <div className="flex items-center mt-1">
                                  <div className={`player-ready-badge ${player.ready ? 'ready' : 'not-ready'}`}>
                                    {player.ready ? (
                                      <>
                                        <Check className="badge-icon" />
                                        Ready
                                      </>
                                    ) : (
                                      <>
                                        <RefreshCw className="badge-icon animate-spin" />
                                        Not Ready
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                {/* Game Settings */}
                <div>
                  <div className="card-header">
                    <div className="settings-header">
                      <div className="card-title">
                        <Settings className="card-title-icon text-amber-400" />
                        Game Settings
                        {!isHost && <span className="settings-view-only">(View Only)</span>}
                      </div>
                      <button
                        className="settings-toggle-button"
                        onClick={() => setShowSettings(!showSettings)}
                      >
                        {showSettings ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>
                  <AnimatePresence>
                    {showSettings && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="card-content">
                          <div className="settings-container">
                            <div className="settings-item">
                              <div className="settings-label-container">
                                <div className="settings-label">
                                  <DivideCircle className="settings-label-icon text-blue-400" />
                                  <label>Number of Questions</label>
                                </div>
                                <span className="text-white font-medium">{gameSettings.numQuestions}</span>
                              </div>
                              <input
                                type="range"
                                min={5}
                                max={20}
                                step={5}
                                value={gameSettings.numQuestions}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value);
                                  // Update immediate UI feedback without waiting for server
                                  setGameSettings(prev => ({...prev, numQuestions: value}));
                                  // Submit change to server
                                  if (isHost) handleUpdateSettings({ numQuestions: value });
                                }}
                                disabled={!isHost}
                                className="w-full"
                              />
                              <div className="settings-slider-marks">
                                <span>5</span>
                                <span>10</span>
                                <span>15</span>
                                <span>20</span>
                              </div>
                            </div>
                            
                            <div className="settings-item">
                              <div className="settings-label">
                                <Timer className="settings-label-icon text-green-400" />
                                <label>Time per Question</label>
                              </div>
                              <select
                                value={gameSettings.timePerQuestion.toString()}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value);
                                  // Update local state immediately
                                  setGameSettings(prev => ({...prev, timePerQuestion: value}));
                                  // Debounce the API call
                                  if (isHost) debouncedHandleUpdateSettings({ timePerQuestion: value });
                                }}
                                disabled={!isHost}
                                className={`settings-select w-full mt-2 p-2 rounded-md ${!isHost ? 'disabled' : ''}`}
                              >
                                <option value="10">10 seconds</option>
                                <option value="15">15 seconds</option>
                                <option value="20">20 seconds</option>
                                <option value="30">30 seconds</option>
                              </select>
                            </div>
                            
                            <div className="settings-item">
                              <div className="settings-label">
                                <AlertCircle className="settings-label-icon text-red-400" />
                                <label>Difficulty</label>
                              </div>
                              <select
                                value={gameSettings.difficulty}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  // Update local state immediately
                                  setGameSettings(prev => ({...prev, difficulty: value}));
                                  // Debounce the API call
                                  if (isHost) debouncedHandleUpdateSettings({ difficulty: value });
                                }}
                                disabled={!isHost}
                                className={`settings-select w-full mt-2 p-2 rounded-md ${!isHost ? 'disabled' : ''}`}
                              >
                                <option value="easy">Easy</option>
                                <option value="medium">Medium</option>
                                <option value="hard">Hard</option>
                              </select>
                            </div>

                            <div className="settings-item">
                              <div className="settings-label">
                                <BookOpen className="settings-label-icon text-purple-400" />
                                <label>Topic</label>
                              </div>
                              <input
                                type="text"
                                value={topicInput}
                                onChange={(e) => handleTopicChange(e.target.value)}
                                placeholder="Enter a topic (optional)"
                                className={`settings-input w-full mt-2 p-2 rounded-md ${!isHost ? 'disabled' : ''}`}
                                disabled={!isHost}
                              />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Your Status Card - width: 300px */}
            <div className="status-card">
              <div className="card-header">
                <div className="card-title">
                  <User className="card-title-icon text-teal-400" />
                  Your Status
                </div>
              </div>
              <div className="card-content space-y-4">
                <div className="player-avatar-container">
                  <EmojiAvatar
                    initialEmoji={players.find(p => p.name === playerName)?.avatar || myEmoji}
                    size={56}
                    isInteractive={false} // Changed to false to make it non-interactive
                  />
                  <div>
                    <p className="player-status-name">{playerName}</p>
                    <div className={`player-status-badge ${isHost ? 'host' : 'player'}`}>
                      {isHost ? "Host" : "Player"}
                    </div>
                  </div>
                </div>
                
                <hr className="status-separator" />
                
                {isHost ? (
                  <div className="space-y-4">
                    <button
                      onClick={handleStartGame}
                      disabled={isStartingGame || players.length < 2 || !areAllPlayersReady()}
                      className="start-button p-2 rounded-md font-medium"
                    >
                      {isStartingGame ? (
                        <>
                          <RefreshCw className="button-icon spinning mr-2" />
                          <span>Starting Game...</span>
                        </>
                      ) : (
                        <>
                          <Play className="button-icon mr-2" />
                          <span>Start Game</span>
                        </>
                      )}
                    </button>
                    
                    <div className="status-info-box">
                      <p className="status-info-item mb-2">
                        <InfoIcon className="status-info-icon text-blue-400" />
                        As the host, you can start the game when all the other players are ready.
                      </p>
                      <p className="status-info-item">
                        <Share2 className="status-info-icon text-pink-400" />
                        Share the lobby code with friends to invite them.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <button
                      onClick={toggleReady}
                      className={isReady ? 'cancel-ready-button p-2 rounded-md font-medium' : 'ready-button p-2 rounded-md font-medium'}
                    >
                      {isReady ? (
                        <>
                          <Dices className="button-icon mr-2" />
                          <span>Cancel Ready</span>
                        </>
                      ) : (
                        <>
                          <Check className="button-icon mr-2" />
                          <span>I'm Ready</span>
                        </>
                      )}
                    </button>
                    
                    <div className="status-info-box">
                      <p className="status-info-item">
                        <InfoIcon className="status-info-icon text-blue-400" />
                        The host will start the game when everyone is ready.
                      </p>
                      <p className="status-info-item">
                        <Share2 className="status-info-icon text-pink-400" />
                        Share the lobby code with friends to invite them.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

// Debounce utility function
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

export default MultiplayerLobby;