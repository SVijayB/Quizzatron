import { toast } from "@/components/ui/use-toast";

// Base API URL
const API_BASE_URL = "https://quizzatron.onrender.com/api/multiplayer";

// Common interfaces
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

export interface MultiplayerQuizQuestion {
  index: number;
  question: string;
  options: string[];
  correct_answer: string;
  difficulty: string;
  image?: string;
}

export interface MultiplayerGameSettings {
  numQuestions: number;
  categories: string[];
  difficulty: string;
  timePerQuestion: number;
  allowSkipping: boolean;
  topic: string | null;
  model: string;
  includeImages?: boolean;
}

export interface LobbyInfo {
  lobby_code: string;
  players: MultiplayerPlayer[];
  settings: MultiplayerGameSettings;
  game_started: boolean;
}

export interface GameStateInfo {
  lobby_code: string;
  players: MultiplayerPlayer[];
  settings: MultiplayerGameSettings;
  questions: MultiplayerQuizQuestion[];
  processedQuestions?: MultiplayerQuizQuestion[];
  current_question: number;
  game_over: boolean;
}

class ApiService {
  // Create a new multiplayer lobby
  public async createLobby(hostName: string, avatarUrl: string): Promise<{lobby_code: string, player_id: string}> {
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
  }

  // Join an existing multiplayer lobby
  public async joinLobby(lobbyCode: string, playerName: string, avatarUrl: string): Promise<{lobby_code: string, player_id: string}> {
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
  }

  // Get lobby information
  public async getLobbyInfo(lobbyCode: string): Promise<LobbyInfo> {
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
  }

  // Toggle player ready status
  public async toggleReadyStatus(lobbyCode: string, playerName: string, readyStatus: boolean): Promise<{success: boolean}> {
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
  }

  // Update game settings
  public async updateGameSettings(lobbyCode: string, settings: MultiplayerGameSettings): Promise<{success: boolean}> {
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
  }

  // Start a multiplayer game
  public async startGame(lobbyCode: string): Promise<any> {
    try {
      console.log(`Starting game for lobby: ${lobbyCode}`);
      
      // Add delay to ensure socket connection is ready
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const response = await fetch(`${API_BASE_URL}/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lobby_code: lobbyCode
        }),
      });

      if (!response.ok) {
        console.error(`Failed to start game: Server responded with ${response.status}`);
        const errorText = await response.text();
        console.error(`Error response: ${errorText}`);
        throw new Error(`Failed to start game: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error starting game:", error);
      throw error;
    }
  }

  // Get the current game state including questions
  public async getGameState(lobbyCode: string): Promise<GameStateInfo> {
    try {
      console.log(`Fetching game state for lobby: ${lobbyCode}`);
      
      // Add retry logic
      let retries = 3;
      let response;
      let lastError;
      
      while (retries > 0) {
        try {
          response = await fetch(`${API_BASE_URL}/game/${lobbyCode}`);
          if (response.ok) break;
          
          // If not found on first try, wait a bit and try again
          if (response.status === 404 && retries > 1) {
            console.log("Game not found, retrying in 1 second...");
            await new Promise(resolve => setTimeout(resolve, 1000));
            retries--;
            continue;
          }
          
          throw new Error(`Failed to fetch game state: ${response.status}`);
        } catch (e) {
          lastError = e;
          retries--;
          if (retries === 0) throw e;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (!response || !response.ok) {
        throw lastError || new Error("Failed to fetch game state");
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
  }

  // Submit a player's answer
  public async submitAnswer(
    lobbyCode: string,
    playerName: string,
    questionIndex: number,
    answer: string,
    timeTaken: number,
    isCorrect: boolean,
    score: number
  ): Promise<{success: boolean}> {
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
  }

  // Get game results
  public async getGameResults(lobbyCode: string): Promise<{players: MultiplayerPlayer[]}> {
    try {
      console.log(`Fetching game results for lobby: ${lobbyCode}`);
      const response = await fetch(`${API_BASE_URL}/results/${lobbyCode}`);
      
      if (!response.ok) {
        console.error(`Failed to load resource: the server responded with a status of ${response.status} (${response.statusText})`);
        
        // Try alternative endpoint if the main one fails
        const altResponse = await fetch(`${API_BASE_URL}/results/${lobbyCode}`);
        
        if (!altResponse.ok) {
          throw new Error(`Failed to fetch game results: ${response.status} ${response.statusText}`);
        }
        
        return await altResponse.json();
      }
      
      return await response.json();
    } catch (error) {
      console.error("Error fetching game results:", error);
      // Return null so the calling code can handle the error
      return null;
    }
  }

  // Leave a lobby
  public async leaveLobby(lobbyCode: string, playerName: string): Promise<{success: boolean}> {
    try {
      console.log(`Leaving lobby ${lobbyCode} for player ${playerName}`);
      
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

      // Handle both success and failure cases gracefully
      if (!response.ok) {
        console.warn(`Failed to properly leave lobby: ${response.status}`);
        return { success: false };
      }

      return await response.json();
    } catch (error) {
      console.error("Error leaving lobby:", error);
      // Return success even on error to avoid blocking UI
      return { success: false };
    }
  }

  // Update a player's avatar
  public async updatePlayerAvatar(lobbyCode: string, playerName: string, avatarUrl: string): Promise<{success: boolean}> {
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
  }

  // Get available categories
  public async getCategories(): Promise<{categories: string[]}> {
    try {
      const response = await fetch("https://quizzatron.onrender.com/api/categories");
      
      if (!response.ok) {
        throw new Error("Failed to fetch categories");
      }
      
      return await response.json();
    } catch (error) {
      console.error("Error fetching categories:", error);
      throw error;
    }
  }
}

// Export singleton instance
export const apiService = new ApiService();
