import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { socketService } from "@/services/socketService";
import { MultiplayerPlayer, MultiplayerGameSettings } from "@/services/apiService";
import { useToast } from "@/components/ui/use-toast";

interface MultiplayerContextProps {
  // Player information
  playerName: string;
  setPlayerName: (name: string) => void;
  playerId: string;
  setPlayerId: (id: string) => void;
  isHost: boolean;
  setIsHost: (isHost: boolean) => void;
  playerAvatar: string;
  setPlayerAvatar: (avatar: string) => void;
  
  // Lobby information
  lobbyCode: string | null;
  setLobbyCode: (code: string | null) => void;
  players: MultiplayerPlayer[];
  setPlayers: (players: MultiplayerPlayer[]) => void;
  gameSettings: MultiplayerGameSettings;
  setGameSettings: (settings: MultiplayerGameSettings) => void;
  
  // Socket status
  isSocketConnected: boolean;
  
  // Helper methods
  storePlayerInfo: (name: string, id: string, lobbyCode: string, isHost: boolean, avatar: string) => void;
  clearPlayerInfo: () => void;
  setupSocketListeners: () => (() => void);
  cleanupSocketListeners: () => void;
}

const defaultSettings: MultiplayerGameSettings = {
  numQuestions: 10,
  categories: [],
  difficulty: "medium",
  timePerQuestion: 15,
  allowSkipping: false,
  topic: null,
  model: "gemini"
};

const MultiplayerContext = createContext<MultiplayerContextProps | undefined>(undefined);

export const MultiplayerProvider = ({ children }: { children: ReactNode }) => {
  const { toast } = useToast();
  
  // Player state
  const [playerName, setPlayerName] = useState<string>("");
  const [playerId, setPlayerId] = useState<string>("");
  const [isHost, setIsHost] = useState<boolean>(false);
  const [playerAvatar, setPlayerAvatar] = useState<string>("😀");
  
  // Lobby state
  const [lobbyCode, setLobbyCode] = useState<string | null>(null);
  const [players, setPlayers] = useState<MultiplayerPlayer[]>([]);
  const [gameSettings, setGameSettings] = useState<MultiplayerGameSettings>(defaultSettings);
  
  // Socket state
  const [isSocketConnected, setIsSocketConnected] = useState<boolean>(false);
  
  // Store player information in localStorage
  const storePlayerInfo = (
    name: string, 
    id: string, 
    code: string, 
    host: boolean, 
    avatar: string
  ) => {
    console.log("Storing player info:", { name, id, code, host, avatar });
    localStorage.setItem("playerName", name);
    localStorage.setItem("playerId", id);
    localStorage.setItem("lobbyCode", code);
    localStorage.setItem("isHost", host.toString());
    localStorage.setItem("playerEmoji", avatar);
    
    setPlayerName(name);
    setPlayerId(id);
    setLobbyCode(code);
    setIsHost(host);
    setPlayerAvatar(avatar);
  };
  
  // Clear player information
  const clearPlayerInfo = () => {
    localStorage.removeItem("playerName");
    localStorage.removeItem("playerId");
    localStorage.removeItem("lobbyCode");
    localStorage.removeItem("isHost");
    
    setPlayerName("");
    setPlayerId("");
    setLobbyCode(null);
    setIsHost(false);
  };
  
  // Setup socket listeners
  const setupSocketListeners = () => {
    // Connect to socket if not already connected
    socketService.connect();
    
    // Handle connection status
    const connectHandler = () => {
      console.log("Socket connected event received in context");
      setIsSocketConnected(true);
    };
    
    const disconnectHandler = () => {
      console.log("Socket disconnected event received in context");
      setIsSocketConnected(false);
    };
    
    // Handle lobby updates
    const lobbyUpdateHandler = (data: any) => {
      console.log("Lobby update received:", data);
      if (data.players) {
        setPlayers(data.players);
      }
      
      if (data.settings) {
        setGameSettings(data.settings);
      }
    };
    
    // Handle player join/leave events
    const playerJoinedHandler = (data: any) => {
      console.log("Player joined event received:", data);
      toast({
        title: "Player Joined",
        description: `${data.name} has joined the lobby`,
      });
    };
    
    const playerLeftHandler = (data: any) => {
      console.log("Player left event received:", data);
      toast({
        title: "Player Left",
        description: `${data.name} has left the lobby`,
      });
    };
    
    // Handle errors
    const errorHandler = (data: any) => {
      console.log("Socket error received:", data);
      toast({
        title: "Error",
        description: data.message || "An error occurred",
        variant: "destructive",
      });
    };
    
    // Register event handlers
    const cleanupConnect = socketService.on("connect", connectHandler);
    const cleanupDisconnect = socketService.on("disconnect", disconnectHandler);
    const cleanupLobbyUpdate = socketService.on("lobby_update", lobbyUpdateHandler);
    const cleanupPlayerJoined = socketService.on("player_joined", playerJoinedHandler);
    const cleanupPlayerLeft = socketService.on("player_left", playerLeftHandler);
    const cleanupError = socketService.on("error", errorHandler);
    
    // Update initial connection status
    setIsSocketConnected(socketService.isConnected());
    
    // Return cleanup function
    return () => {
      console.log("Cleaning up socket listeners from context");
      cleanupConnect();
      cleanupDisconnect();
      cleanupLobbyUpdate();
      cleanupPlayerJoined();
      cleanupPlayerLeft();
      cleanupError();
    };
  };
  
  // Cleanup socket listeners
  const cleanupSocketListeners = () => {
    console.log("Running additional socket listener cleanup");
    
    // Remove all event listeners for common events
    socketService.removeAllListeners("connect");
    socketService.removeAllListeners("disconnect");
    socketService.removeAllListeners("lobby_update");
    socketService.removeAllListeners("player_joined");
    socketService.removeAllListeners("player_left");
    socketService.removeAllListeners("error");
  };
  
  // Load saved player info on mount
  useEffect(() => {
    const savedName = localStorage.getItem("playerName");
    const savedId = localStorage.getItem("playerId");
    const savedLobbyCode = localStorage.getItem("lobbyCode");
    const savedIsHost = localStorage.getItem("isHost") === "true";
    const savedAvatar = localStorage.getItem("playerEmoji");
    
    console.log("Loading saved player info:", {
      savedName,
      savedId,
      savedLobbyCode,
      savedIsHost,
      savedAvatar
    });
    
    if (savedName) setPlayerName(savedName);
    if (savedId) setPlayerId(savedId);
    if (savedLobbyCode) setLobbyCode(savedLobbyCode);
    if (savedIsHost) setIsHost(savedIsHost);
    if (savedAvatar) setPlayerAvatar(savedAvatar);
    
    // Connect to socket
    socketService.connect();
    
    // Setup socket connection event handlers
    const cleanupListeners = setupSocketListeners();
    
    // Cleanup on unmount
    return () => {
      if (cleanupListeners) cleanupListeners();
    };
  }, []);
  
  const value = {
    playerName,
    setPlayerName,
    playerId,
    setPlayerId,
    isHost,
    setIsHost,
    playerAvatar,
    setPlayerAvatar,
    lobbyCode,
    setLobbyCode,
    players,
    setPlayers,
    gameSettings,
    setGameSettings,
    isSocketConnected,
    storePlayerInfo,
    clearPlayerInfo,
    setupSocketListeners,
    cleanupSocketListeners,
  };
  
  return (
    <MultiplayerContext.Provider value={value}>
      {children}
    </MultiplayerContext.Provider>
  );
};

export const useMultiplayer = () => {
  const context = useContext(MultiplayerContext);
  
  if (context === undefined) {
    throw new Error("useMultiplayer must be used within a MultiplayerProvider");
  }
  
  return context;
};
