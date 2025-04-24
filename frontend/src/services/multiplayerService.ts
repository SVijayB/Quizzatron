import { toast } from "@/components/ui/use-toast";
import { io, Socket } from "socket.io-client";

/**
 * Interface for multiplayer quiz question
 */
export interface MultiplayerQuizQuestion {
  index: number;
  question: string;
  options: string[];
  correct_answer: string;
  difficulty: string;
  image?: string;
}

/**
 * Interface for player data
 */
export interface MultiplayerPlayer {
  id: string;
  name: string;
  isHost: boolean;
  avatar: string;
  ready: boolean;
  currentQuestion: number;
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

/**
 * Interface for game settings
 */
export interface MultiplayerGameSettings {
  numQuestions: number;
  categories: string[];
  difficulty: string;
  timePerQuestion: number;
  allowSkipping: boolean;
  topic: string | null;
  model: string;
  includeImages: boolean;
}

// Base API URL
const API_BASE_URL = "http://127.0.0.1:5000/api/multiplayer";

/**
 * Create a new multiplayer lobby
 * @param hostName Host player name
 * @param avatarUrl Host avatar URL
 * @returns Promise with lobby code and host ID
 */
export const createLobby = async (hostName: string, avatarUrl: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        host_name: hostName,
        avatar: avatarUrl,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to create lobby");
    }

    return await response.json();
  } catch (error) {
    console.error("Error creating lobby:", error);
    throw error;
  }
};

/**
 * Join an existing multiplayer lobby
 * @param lobbyCode Lobby code to join
 * @param playerName Player name
 * @param avatarUrl Player avatar URL
 * @returns Promise with lobby code and player ID
 */
export const joinLobby = async (lobbyCode: string, playerName: string, avatarUrl: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/join`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        player_name: playerName,
        lobby_code: lobbyCode,
        avatar: avatarUrl,
      }),
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Lobby not found");
      } else if (response.status === 409) {
        throw new Error("Name already taken");
      } else if (response.status === 403) {
        throw new Error("Game has already started");
      }
      throw new Error("Failed to join lobby");
    }

    return await response.json();
  } catch (error) {
    console.error("Error joining lobby:", error);
    throw error;
  }
};

/**
 * Get lobby information
 * @param lobbyCode Lobby code
 * @returns Promise with lobby information
 */
export const getLobbyInfo = async (lobbyCode: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/lobby/${lobbyCode}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Lobby not found");
      }
      throw new Error("Failed to fetch lobby state");
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching lobby state:", error);
    throw error;
  }
};

/**
 * Toggle player ready status
 * @param lobbyCode Lobby code
 * @param playerName Player name
 * @param readyStatus New ready status
 * @returns Promise with success status
 */
export const toggleReadyStatus = async (lobbyCode: string, playerName: string, readyStatus: boolean) => {
  try {
    const response = await fetch(`${API_BASE_URL}/ready`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        lobby_code: lobbyCode,
        player_name: playerName,
        ready: readyStatus,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to update ready state");
    }

    return await response.json();
  } catch (error) {
    console.error("Error toggling ready state:", error);
    throw error;
  }
};

/**
 * Update game settings
 * @param lobbyCode Lobby code
 * @param settings Game settings
 * @returns Promise with success status
 */
export const updateGameSettings = async (lobbyCode: string, settings: MultiplayerGameSettings) => {
  try {
    console.log("Sending settings update to API:", settings);
    const response = await fetch(`${API_BASE_URL}/settings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        lobby_code: lobbyCode,
        settings: settings,
      }),
    });

    if (!response.ok) {
      console.error("Server returned error:", response.status);
      throw new Error("Failed to update game settings");
    }

    const result = await response.json();
    console.log("Settings update response:", result);
    return result;
  } catch (error) {
    console.error("Error updating game settings:", error);
    throw error;
  }
};

/**
 * Start a multiplayer game
 * @param lobbyCode Lobby code
 * @returns Promise with success status
 */
export const startGame = async (lobbyCode: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/start`, {
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

    return await response.json();
  } catch (error) {
    console.error("Error starting game:", error);
    throw error;
  }
};

/**
 * Get the current game state including questions
 * @param lobbyCode Lobby code
 * @returns Promise with game state
 */
export const getGameState = async (lobbyCode: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/game/${lobbyCode}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Game not found");
      }
      throw new Error("Failed to fetch game state");
    }

    const data = await response.json();
    
    // Process the nested questions format
    if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
      // Extract questions from the nested array if needed
      if (Array.isArray(data.questions[0])) {
        data.processedQuestions = data.questions[0];
      } else {
        data.processedQuestions = data.questions;
      }
    }
    
    return data;
  } catch (error) {
    console.error("Error fetching game state:", error);
    throw error;
  }
};

/**
 * Submit a player's answer
 * @param lobbyCode Lobby code
 * @param playerName Player name
 * @param questionIndex Question index
 * @param answer Player's answer
 * @param timeTaken Time taken to answer
 * @param isCorrect Whether the answer is correct
 * @param score Score for this answer
 * @returns Promise with success status
 */
export const submitAnswer = async (
  lobbyCode: string,
  playerName: string,
  questionIndex: number,
  answer: string,
  timeTaken: number,
  isCorrect: boolean,
  score: number
) => {
  try {
    const response = await fetch(`${API_BASE_URL}/answer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        lobby_code: lobbyCode,
        player_name: playerName,
        question_index: questionIndex,
        answer: answer,
        time_taken: timeTaken,
        is_correct: isCorrect,
        score: score,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to submit answer");
    }

    return await response.json();
  } catch (error) {
    console.error("Error submitting answer:", error);
    throw error;
  }
};

/**
 * Get game results
 * @param lobbyCode Lobby code
 * @returns Promise with game results
 */
export const getGameResults = async (lobbyCode: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/results/${lobbyCode}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Game not found");
      }
      throw new Error("Failed to fetch game results");
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching game results:", error);
    throw error;
  }
};

/**
 * Leave a lobby
 * @param lobbyCode Lobby code
 * @param playerName Player name
 * @returns Promise with success status
 */
export const leaveLobby = async (lobbyCode: string, playerName: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/leave`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        lobby_code: lobbyCode,
        player_name: playerName,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to leave lobby");
    }

    return await response.json();
  } catch (error) {
    console.error("Error leaving lobby:", error);
    throw error;
  }
};

// Socket.io instance
let socket: Socket | null = null;
let connectedLobbyCode: string | null = null;

// Event callback registrations
type CallbackFunction = (...args: any[]) => void;
const eventCallbacks: Record<string, CallbackFunction[]> = {
  lobby_update: [],
  player_joined: [],
  player_left: [],
  game_started: [],
  new_question: [],
  player_answered: [],
  all_answers_in: [],
  scoreboard: [],
  game_over: [],
  connection_response: [],
  room_joined: [],
  error: [],
  connect: [],
  disconnect: [],
};

/**
 * Initialize WebSocket connection
 * @returns The socket instance
 */
export const initializeSocket = () => {
  if (!socket) {
    console.log("Initializing socket connection");
    socket = io("http://127.0.0.1:5000", {
      transports: ['polling', 'websocket'], // Start with polling for reliability
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000,
    });
    
    // Set up listeners for all socket events
    socket.on("connect", () => {
      console.log("🔌 Connected to WebSocket server with ID:", socket?.id);
      
      // Broadcast the connect event
      if (eventCallbacks["connect"] && eventCallbacks["connect"].length > 0) {
        eventCallbacks["connect"].forEach(callback => {
          try {
            callback();
          } catch (error) {
            console.error("Error processing connect event:", error);
          }
        });
      }
    });
    
    socket.on("disconnect", () => {
      console.log("🔌 Disconnected from WebSocket server");
      
      // Broadcast the disconnect event
      if (eventCallbacks["disconnect"] && eventCallbacks["disconnect"].length > 0) {
        eventCallbacks["disconnect"].forEach(callback => {
          try {
            callback();
          } catch (error) {
            console.error("Error processing disconnect event:", error);
          }
        });
      }
    });
    
    // Special handling for lobby_update to ensure it's always processed
    socket.on("lobby_update", (data) => {
      console.log("🔄 Received lobby_update event:", data);
      
      // Process immediately to avoid any delays
      if (eventCallbacks["lobby_update"] && eventCallbacks["lobby_update"].length > 0) {
        eventCallbacks["lobby_update"].forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error("Error processing lobby_update:", error);
          }
        });
      }
    });
    
    // Enhanced direct event handling - make all events trigger immediately
    ["player_joined", "player_left", "game_started", "connection_response", 
     "room_joined", "error", "new_question", "player_answered", 
     "all_answers_in", "scoreboard", "game_over"].forEach(eventType => {
      socket.on(eventType, (data) => {
        console.log(`Received ${eventType} event:`, data);
        
        // Immediately dispatch to all registered callbacks
        if (eventCallbacks[eventType] && eventCallbacks[eventType].length > 0) {
          // Track if any callback succeeded to reduce error noise
          let atLeastOneCallbackSucceeded = false;
          
          eventCallbacks[eventType].forEach(callback => {
            try {
              callback(data);
              atLeastOneCallbackSucceeded = true;
            } catch (error) {
              console.error(`Error processing ${eventType}:`, error);
            }
          });
          
          // If all callbacks failed, log a more prominent error
          if (!atLeastOneCallbackSucceeded) {
            console.error(`⚠️ All callbacks for ${eventType} failed to process`);
          }
        } else {
          console.log(`No callbacks registered for ${eventType} event`);
        }
      });
    });
    
    socket.on("connect_error", (error) => {
      console.error("⚠️ Socket connection error:", error);
    });
    
    socket.on("connect_timeout", () => {
      console.error("⚠️ Socket connection timeout");
    });
    
    socket.on("reconnect", (attemptNumber) => {
      console.log(`🔄 Socket reconnected after ${attemptNumber} attempts`);
    });
  }
  
  return socket;
};

/**
 * Register a callback for a specific socket event
 * @param eventType The socket event to listen for
 * @param callback Function to call when event is received
 * @returns Function to remove the callback
 */
export const onSocketEvent = (eventType: string, callback: CallbackFunction) => {
  if (!eventCallbacks[eventType]) {
    eventCallbacks[eventType] = [];
  }
  
  eventCallbacks[eventType].push(callback);
  console.log(`Registered callback for ${eventType}, total: ${eventCallbacks[eventType].length}`);
  
  // Return a function to remove this callback
  return () => {
    const index = eventCallbacks[eventType].indexOf(callback);
    if (index !== -1) {
      eventCallbacks[eventType].splice(index, 1);
      console.log(`Removed callback for ${eventType}, remaining: ${eventCallbacks[eventType].length}`);
    }
  };
};

/**
 * Join a socket room for a specific lobby
 * @param lobbyCode Lobby code to join
 * @param playerName Player name
 * @param playerId Player ID
 */
export const joinSocketRoom = (lobbyCode: string, playerName: string, playerId: string) => {
  if (!socket) {
    initializeSocket();
  }
  
  console.log(`Joining socket room: ${lobbyCode} as ${playerName} (${playerId})`);
  socket?.emit("join_room", {
    lobby_code: lobbyCode,
    player_name: playerName,
    player_id: playerId,
  });
  
  connectedLobbyCode = lobbyCode;
};

/**
 * Leave a socket room
 * @param lobbyCode Lobby code to leave
 * @param playerName Player name
 * @param playerId Player ID
 */
export const leaveSocketRoom = (lobbyCode: string, playerName: string, playerId: string) => {
  socket?.emit("leave_room", {
    lobby_code: lobbyCode,
    player_name: playerName,
    player_id: playerId,
  });
  
  if (connectedLobbyCode === lobbyCode) {
    connectedLobbyCode = null;
  }
};

/**
 * Emit a start game event over socket
 * @param lobbyCode Lobby code
 */
export const socketStartGame = (lobbyCode: string) => {
  socket?.emit("start_game", { lobby_code: lobbyCode });
};

/**
 * Submit an answer via socket for instant feedback
 * @param lobbyCode Lobby code
 * @param playerName Player name
 * @param questionIndex Question index
 * @param answer Player's answer
 * @param timeTaken Time taken to answer
 * @param isCorrect Whether the answer is correct
 * @param score Score for this answer
 */
export const socketSubmitAnswer = (
  lobbyCode: string,
  playerName: string,
  questionIndex: number,
  answer: string,
  timeTaken: number,
  isCorrect: boolean,
  score: number
) => {
  socket?.emit("submit_answer", {
    lobby_code: lobbyCode,
    player_name: playerName,
    question_index: questionIndex,
    answer: answer,
    time_taken: timeTaken,
    is_correct: isCorrect,
    score: score,
  });
};

/**
 * Request to advance to the next question after the scoreboard is shown
 * @param lobbyCode Lobby code
 */
export const socketRequestNextQuestion = (lobbyCode: string) => {
  socket?.emit("request_next_question", { lobby_code: lobbyCode });
};

/**
 * Disconnect from WebSocket server
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    connectedLobbyCode = null;
  }
};

/**
 * Update a player's avatar
 * @param lobbyCode Lobby code
 * @param playerName Player name
 * @param avatarUrl New avatar URL
 * @returns Promise with success status
 */
export const updatePlayerAvatar = async (lobbyCode: string, playerName: string, avatarUrl: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/update-avatar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        lobby_code: lobbyCode,
        player_name: playerName,
        avatar: avatarUrl,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to update avatar");
    }

    return await response.json();
  } catch (error) {
    console.error("Error updating avatar:", error);
    throw error;
  }
};
