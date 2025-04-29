import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, Check, Copy, ArrowLeft, Share2, Play, 
  Timer, RefreshCw, Settings, AlertCircle, 
  Dices, Hash, Heart, User, BookOpen,
  ChevronDown, Search, X
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Slider } from "@/components/ui/slider";
import CursorEffect from "@/components/CursorEffect";
import QuizLogo from "@/components/QuizLogo";
import EmojiAvatar from "@/components/EmojiAvatar";
import { useMultiplayer } from "@/contexts/MultiplayerContext";
import { apiService } from "@/services/apiService";
import { socketService } from "@/services/socketService";
import CategorySuggestions from "@/components/CategorySuggestions";
import "./MultiplayerLobby.css";

const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout | null = null;
  return function(...args: any[]) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

const MultiplayerLobby = () => {
  const navigate = useNavigate();
  const { lobbyCode: urlLobbyCode } = useParams<{ lobbyCode: string }>();
  const { toast } = useToast();
  
  const { 
    playerName, playerId, isHost, playerAvatar, 
    lobbyCode: contextLobbyCode, 
    players, setPlayers,
    gameSettings, setGameSettings,
    isSocketConnected,
    setupSocketListeners
  } = useMultiplayer();
  
  const [isReady, setIsReady] = useState(false);
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [categoryData, setCategoryData] = useState<{[key: string]: number | string}>({});
  const [topicInput, setTopicInput] = useState(gameSettings.topic || "");
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  
  const topicUpdateTimer = useRef<NodeJS.Timeout | null>(null);
  const lastSliderValue = useRef<number>(gameSettings.numQuestions);

  // Add a local state for the slider value to prevent animation issues
  const [localQuestionCount, setLocalQuestionCount] = useState<number>(gameSettings.numQuestions);
  const isSliderDragging = useRef(false);
  
  // Add a reference for the slider timeout
  const sliderUpdateTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Update local slider value when gameSettings changes from server
  useEffect(() => {
    if (!isSliderDragging.current) {
      setLocalQuestionCount(gameSettings.numQuestions);
    }
  }, [gameSettings.numQuestions]);

  // Handle game started event from socket
  const handleGameStarted = useCallback((data: any) => {
    console.log("Game started event received:", data);
    toast({
      title: "Game Starting",
      description: "Redirecting to quiz...",
    });
    navigate(`/multiplayer/quiz/${urlLobbyCode}`);
  }, [navigate, toast, urlLobbyCode]);

  // Handle new question event from socket
  const handleNewQuestion = useCallback((data: any) => {
    console.log("New question received in lobby:", data);
    if (urlLobbyCode) {
      navigate(`/multiplayer/quiz/${urlLobbyCode}`);
    }
  }, [navigate, urlLobbyCode]);
  
  // Handle player leave event from socket
  const handlePlayerLeft = useCallback((data: any) => {
    console.log("Player left event received:", data);
    if (data.lobbyCode === urlLobbyCode) {
      // Refresh the lobby state to get the updated player list
      fetchLobbyState();
    }
  }, [urlLobbyCode]);
  
  useEffect(() => {
    if (!playerName || !playerId || !urlLobbyCode) {
      navigate("/multiplayer");
      return;
    }
    
    if (contextLobbyCode !== urlLobbyCode) {
      navigate("/multiplayer");
      return;
    }
    
    // Setup socket handlers with improved cleanup
    console.log("Setting up socket listeners in MultiplayerLobby");
    
    const handleGameStarted = (data: any) => {
      console.log("Game started event received:", data);
      navigate(`/multiplayer/quiz/${urlLobbyCode}`);
    };

    const handleNewQuestion = (data: any) => {
      console.log("New question received in lobby:", data);
      if (urlLobbyCode) {
        navigate(`/multiplayer/quiz/${urlLobbyCode}`);
      }
    };
    
    const handlePlayerLeft = (data: any) => {
      console.log("Player left event received:", data);
      if (data.lobby_code === urlLobbyCode || data.lobbyCode === urlLobbyCode) {
        // Refresh the lobby state to get the updated player list
        fetchLobbyState();
      }
    };

    // Connect to socket if not already connected
    if (!socketService.isConnected()) {
      socketService.connect();
    }
    
    // Register event handlers
    const cleanupGameStarted = socketService.on("game_started", handleGameStarted);
    const cleanupNewQuestion = socketService.on("new_question", handleNewQuestion);
    const cleanupPlayerLeft = socketService.on("player_left", handlePlayerLeft);
    
    // Join the room
    socketService.joinRoom(urlLobbyCode, playerName, playerId);
    
    // Fetch lobby state to confirm connection
    fetchLobbyState();
    
    // Debug logging for socket events
    const cleanupConnect = socketService.on("connect", () => {
      console.log("Socket connected in MultiplayerLobby");
      if (isSocketConnected === false) {
        fetchLobbyState(); // Refresh state when reconnected
      }
    });
    
    const cleanupDisconnect = socketService.on("disconnect", () => {
      console.log("Socket disconnected in MultiplayerLobby");
    });
    
    const cleanupError = socketService.on("error", (data: any) => {
      console.error("Socket error in MultiplayerLobby:", data);
      toast({
        title: "Connection Error",
        description: data.message || "There was an error connecting to the game server",
        variant: "destructive",
      });
    });

    // Clean up handlers when component unmounts
    return () => {
      console.log("Cleaning up socket event listeners in MultiplayerLobby");
      cleanupGameStarted();
      cleanupNewQuestion();
      cleanupPlayerLeft();
      cleanupConnect();
      cleanupDisconnect();
      cleanupError();
    };
  }, [playerName, playerId, urlLobbyCode, contextLobbyCode, navigate, isSocketConnected]);
  
  const fetchLobbyState = async () => {
    try {
      if (!urlLobbyCode) return;
      
      console.log("Fetching lobby state for:", urlLobbyCode);
      const data = await apiService.getLobbyInfo(urlLobbyCode);
      console.log("Lobby state received:", data);
      
      setPlayers(data.players || []);
      setGameSettings(data.settings || gameSettings);
      
      if (data.settings?.topic !== undefined) {
        setTopicInput(data.settings.topic || "");
      }
      
      const myPlayer = data.players?.find(p => p.name === playerName);
      if (myPlayer) {
        setIsReady(!!myPlayer.ready);
      }
      
      if (data.game_started) {
        console.log("Game already started, redirecting to quiz page");
        navigate(`/multiplayer/quiz/${urlLobbyCode}`);
        return;
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching lobby state:", error);
      if (error instanceof Error && error.message === "Lobby not found") {
        toast({
          title: "Lobby Not Found",
          description: "The lobby you tried to join doesn't exist.",
          variant: "destructive",
        });
        navigate("/multiplayer");
      } else {
        toast({
          title: "Error",
          description: "Failed to load lobby information.",
          variant: "destructive",
        });
      }
    }
  };
  
  const fetchCategories = async () => {
    try {
      const response = await fetch('http://127.0.0.1:5000//api/categories/get');
      if (!response.ok) {
        throw new Error('Failed to fetch categories');
      }
      
      const data: {[key: string]: number | string} = await response.json();
      setCategoryData(data);
      
      // Include all categories
      const categoryList = Object.keys(data);
      setAllCategories(categoryList);
      
      console.log("Loaded categories data:", data);
    } catch (error) {
      console.error("Error fetching categories:", error);
      toast({
        title: "Error",
        description: "Failed to fetch categories. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  // Load categories when component mounts
  useEffect(() => {
    fetchCategories();
  }, []);
  
  const toggleReady = async () => {
    try {
      if (!urlLobbyCode) return;
      
      await apiService.toggleReadyStatus(urlLobbyCode, playerName, !isReady);
      setIsReady(!isReady);
    } catch (error) {
      console.error("Error toggling ready state:", error);
      toast({
        title: "Error",
        description: "Failed to update ready status",
        variant: "destructive",
      });
    }
  };
  
  const handleUpdateSettings = async (updatedSettings: Partial<typeof gameSettings>) => {
    if (!isHost || !urlLobbyCode) return;
    
    const newSettings = { ...gameSettings, ...updatedSettings };
    
    setGameSettings(newSettings);
    
    try {
      await apiService.updateGameSettings(urlLobbyCode, newSettings);
    } catch (error) {
      console.error("Error updating game settings:", error);
      toast({
        title: "Error",
        description: "Failed to update game settings",
        variant: "destructive",
      });
    }
  };
  
  const debouncedHandleUpdateSettings = useCallback(
    debounce((settings: Partial<typeof gameSettings>) => {
      handleUpdateSettings(settings);
    }, 1000), // Increase to 1000ms (1 second) for better animation handling
    [gameSettings, urlLobbyCode]
  );
  
  const handleStartGame = async () => {
    if (!isHost || !urlLobbyCode) return;
    
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
      console.log("Starting game for lobby:", urlLobbyCode);
      
      // First emit the socket event for immediate notification to other players
      socketService.startGame(urlLobbyCode);
      
      // Then make the API call to generate questions
      const result = await apiService.startGame(urlLobbyCode);
      console.log("Game start API response:", result);
      
      // Wait a moment for the backend to prepare, then navigate
      setTimeout(() => {
        console.log("Navigating to quiz page after game start");
        navigate(`/multiplayer/quiz/${urlLobbyCode}`);
      }, 500);
      
    } catch (error) {
      console.error("Error starting game:", error);
      setIsStartingGame(false);

      // Suppress toast if the error is about the game already being started
      if (error instanceof Error && error.message.includes("already started")) {
        console.warn("Game already started, suppressing error toast.");
        return;
      }

      toast({
        title: "Error",
        description: "Failed to start the game",
        variant: "destructive",
      });
    }
  };
  
  const handleLeaveLobby = async () => {
    try {
      if (playerId && urlLobbyCode) {
        socketService.leaveRoom(urlLobbyCode, playerName, playerId);
      }
      
      if (!isHost && urlLobbyCode) {
        await apiService.leaveLobby(urlLobbyCode, playerName);
      }
      
      localStorage.removeItem("lobbyCode");
      localStorage.removeItem("isHost");
      localStorage.removeItem("playerId");
      navigate("/multiplayer");
    } catch (error) {
      console.error("Error leaving lobby:", error);
      navigate("/multiplayer");
    }
  };
  
  const copyLobbyCode = () => {
    navigator.clipboard.writeText(urlLobbyCode || "");
    setCopySuccess(true);
    
    setTimeout(() => {
      setCopySuccess(false);
    }, 2000);
  };
  
  const updatePlayerEmoji = async (emoji: string) => {
    // Disable avatar updates in the lobby
    console.log("Avatar updates are disabled in the lobby");
    toast({
      title: "Avatar Locked",
      description: "Avatars can only be changed before joining the lobby.",
    });
    return;
  };
  
  const handleTopicChange = (value: string) => {
    setTopicInput(value);
    
    if (isHost) {
      clearTimeout(topicUpdateTimer.current as NodeJS.Timeout);
      topicUpdateTimer.current = setTimeout(() => {
        handleUpdateSettings({ topic: value || null });
      }, 500);
    }
  };
  
  const areAllPlayersReady = () => {
    const nonHostPlayers = players.filter(player => !player.isHost);
    return nonHostPlayers.length > 0 && nonHostPlayers.every(player => player.ready);
  };
  
  useEffect(() => {
    if (gameSettings.topic !== topicInput && gameSettings.topic !== undefined) {
      setTopicInput(gameSettings.topic || "");
    }
  }, [gameSettings.topic]);
  
  if (isLoading) {
    return (
      <div className="lobby-background">
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="bg-white/10 backdrop-blur-md p-8 rounded-xl shadow-lg text-white text-center">
            <RefreshCw className="animate-spin h-8 w-8 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Loading Lobby...</h2>
            <p>Please wait while we connect to the game server.</p>
            {!isSocketConnected && (
              <p className="mt-4 text-amber-300">Establishing connection...</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lobby-background">
      <CursorEffect />
      
      <div className="lobby-gradient-overlay" />
      <div className="lobby-radial-overlay-1" />
      <div className="lobby-radial-overlay-2" />
      <div className="lobby-radial-overlay-3" />
      <div className="lobby-grid-overlay" />

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
          <div className="lobby-header">
            <div className="text-center">
              <div className="flex items-center justify-center">
                <QuizLogo size={60} color="white" className="mr-3" />
                <h1 className="lobby-title">Waiting Lobby</h1>
              </div>
              
              <div className="flex items-center justify-center mt-2">
                <div className="lobby-code">
                  <Hash className="lobby-code-icon" />
                  {urlLobbyCode}
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
              
              {!isSocketConnected && (
                <div className="mt-2 text-amber-300 flex items-center justify-center">
                  <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" />
                  Reconnecting to server...
                </div>
              )}
            </div>
          </div>

          <div className="lobby-layout">
            <div className="how-to-play-card">
              <div className="card-content how-to-play-content">
                <div className="how-to-play-icon">
                  <Heart className="h-6 w-6" />
                </div>
                <h3 className="how-to-play-title">How to Play</h3>
                <p className="how-to-play-description">
                  Answer questions quickly to earn more points. The faster you answer correctly, the higher your score!
                </p>
                <ul className="how-to-play-list">
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
          
            <div className="players-card">
              <div className="space-y-6">
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
                                <div className="player-name-container">
                                  <p className="player-name">{player.name}</p>
                                  {player.isHost && <span className="player-host-tag">(Host)</span>}
                                  {player.name === playerName && <span className="player-you-tag">(You)</span>}
                                </div>
                                <div className={`player-ready-badge ${player.ready ? 'ready' : 'not-ready'}`}>
                                  {player.ready ? (
                                    <>
                                      <Check className="badge-icon" />
                                      Ready
                                    </>
                                  ) : (
                                    <>
                                      <RefreshCw className="badge-icon spinning" />
                                      Not Ready
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

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
                              <div className="settings-label">
                                <BookOpen className="settings-label-icon text-purple-400" />
                                <label>Topic</label>
                              </div>
                              <div className="relative">
                                <input
                                  type="text"
                                  value={topicInput}
                                  onChange={(e) => {
                                    handleTopicChange(e.target.value);
                                    setShowCategorySuggestions(true);
                                  }}
                                  placeholder="Enter a topic"
                                  className={`settings-input ${!isHost ? 'disabled' : ''}`}
                                  disabled={!isHost}
                                  onFocus={() => setShowCategorySuggestions(true)}
                                  onBlur={() => setTimeout(() => setShowCategorySuggestions(false), 200)}
                                />
                                
                                {isHost && showCategorySuggestions && (
                                  <CategorySuggestions
                                    categories={allCategories}
                                    searchQuery={topicInput}
                                    visible={showCategorySuggestions}
                                    onSelectCategory={(category) => {
                                      handleTopicChange(category);
                                      setShowCategorySuggestions(false);
                                    }}
                                    categoryData={categoryData}
                                  />
                                )}
                              </div>
                            </div>
                            
                            <div className="settings-item">
                              <div className="settings-label-container">
                                <div className="settings-label">
                                  <AlertCircle className="settings-label-icon text-blue-400" />
                                  <label>Number of Questions</label>
                                </div>
                                <span className="settings-value">{localQuestionCount}</span>
                              </div>
                              <div className="py-4">
                                <Slider
                                  value={[localQuestionCount]}
                                  onValueChange={(values) => {
                                    if (isHost) {
                                      const newValue = values[0];
                                      
                                      // Update local state for immediate UI feedback
                                      setLocalQuestionCount(newValue);
                                      isSliderDragging.current = true;
                                      
                                      // Clear any previous timeout
                                      if (sliderUpdateTimeout.current) {
                                        clearTimeout(sliderUpdateTimeout.current);
                                      }
                                      
                                      // Set a timeout to update the server after user stops dragging
                                      sliderUpdateTimeout.current = setTimeout(() => {
                                        isSliderDragging.current = false;
                                        
                                        // Send to server if value has changed
                                        if (newValue !== gameSettings.numQuestions) {
                                          console.log("Updating server with new question count:", newValue);
                                          handleUpdateSettings({ numQuestions: newValue });
                                        }
                                      }, 500);
                                    }
                                  }}
                                  max={20}
                                  min={1}
                                  step={1}
                                  disabled={!isHost}
                                  className="w-full"
                                />
                              </div>
                              <div className="settings-slider-marks">
                                <span>1</span>
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
                                  if (isHost) debouncedHandleUpdateSettings({ timePerQuestion: value });
                                }}
                                disabled={!isHost}
                                className={`settings-select ${!isHost ? 'disabled' : ''}`}
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
                                  if (isHost) debouncedHandleUpdateSettings({ difficulty: value });
                                }}
                                disabled={!isHost}
                                className={`settings-select ${!isHost ? 'disabled' : ''}`}
                              >
                                <option value="easy">Easy</option>
                                <option value="medium">Medium</option>
                                <option value="hard">Hard</option>
                              </select>
                            </div>

                            <div className="settings-item">
                              <div className="settings-label-container">
                                <div className="settings-label">
                                  <AlertCircle className="settings-label-icon text-violet-400" />
                                  <label>Include Images</label>
                                </div>
                                <div className="settings-toggle-container">
                                  <input
                                    type="checkbox"
                                    id="include-images"
                                    checked={gameSettings.includeImages}
                                    onChange={(e) => {
                                      if (isHost) {
                                        const newValue = e.target.checked;
                                        // Update both local state and server settings
                                        handleUpdateSettings({ includeImages: newValue });
                                      }
                                    }}
                                    disabled={!isHost}
                                    className="settings-toggle-checkbox"
                                  />
                                  <label 
                                    htmlFor="include-images" 
                                    className={`settings-toggle ${gameSettings.includeImages ? 'active' : ''} ${!isHost ? 'disabled' : ''}`}
                                  >
                                    <span className="settings-toggle-slider"></span>
                                  </label>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

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
                    initialEmoji={players.find(p => p.name === playerName)?.avatar || playerAvatar}
                    size={56}
                    isInteractive={false}
                    onChange={updatePlayerEmoji}
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
                      className="start-button"
                    >
                      {isStartingGame ? (
                        <>
                          <RefreshCw className="button-icon spinning" />
                          <span>Starting Game...</span>
                        </>
                      ) : (
                        <>
                          <Play className="button-icon" />
                          <span>Start Game</span>
                        </>
                      )}
                    </button>
                    
                    <div className="status-info-box">
                      <p className="status-info-item">
                        <AlertCircle className="status-info-icon text-blue-400" />
                        As the host, you can start the game when all players are ready.
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
                      className={isReady ? "cancel-ready-button" : "ready-button"}
                    >
                      {isReady ? (
                        <>
                          <Dices className="button-icon" />
                          <span>Cancel Ready</span>
                        </>
                      ) : (
                        <>
                          <Check className="button-icon" />
                          <span>I'm Ready</span>
                        </>
                      )}
                    </button>
                    
                    <div className="status-info-box">
                      <p className="status-info-item">
                        <AlertCircle className="status-info-icon text-blue-400" />
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

export default MultiplayerLobby;
