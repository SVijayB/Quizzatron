import { toast } from "@/components/ui/use-toast";

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
      throw new Error("Failed to update game settings");
    }

    return await response.json();
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