import { io, Socket } from "socket.io-client";
import { useToast } from "@/components/ui/use-toast";

// Define event callback type
type EventCallback = (...args: any[]) => void;

// Socket service singleton class
class SocketService {
  private socket: Socket | null = null;
  private serverUrl = "http://127.0.0.1:5000";
  private registeredEvents: Map<string, EventCallback[]> = new Map();
  private connectedLobbyCode: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  
  // Initialize the socket connection
  public connect(): Socket {
    if (!this.socket) {
      console.log("🔌 Initializing socket connection");
      
      this.socket = io(this.serverUrl, {
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        timeout: 20000,
      });
      
      // Set up base socket event listeners
      this.setupBaseListeners();
    }
    
    return this.socket;
  }
  
  // Disconnect the socket
  public disconnect(): void {
    if (this.socket) {
      console.log("🔌 Disconnecting socket");
      this.socket.disconnect();
      this.socket = null;
      this.connectedLobbyCode = null;
      this.registeredEvents.clear();
    }
  }
  
  // Join a room for a specific lobby
  public joinRoom(lobbyCode: string, playerName: string, playerId: string): void {
    const socket = this.connect();
    
    console.log(`🔌 Joining room: ${lobbyCode} as ${playerName} (${playerId})`);
    socket.emit("join_room", {
      lobby_code: lobbyCode,
      player_name: playerName,
      player_id: playerId,
    });
    
    this.connectedLobbyCode = lobbyCode;
  }
  
  // Leave a room
  public leaveRoom(lobbyCode: string, playerName: string, playerId: string): void {
    if (!this.socket) return;
    
    console.log(`🔌 Leaving room: ${lobbyCode}`);
    this.socket.emit("leave_room", {
      lobby_code: lobbyCode,
      player_name: playerName,
      player_id: playerId,
    });
    
    if (this.connectedLobbyCode === lobbyCode) {
      this.connectedLobbyCode = null;
    }
  }
  
  // Register an event listener
  public on(event: string, callback: EventCallback): () => void {
    if (!this.registeredEvents.has(event)) {
      this.registeredEvents.set(event, []);
    }
    
    const callbacks = this.registeredEvents.get(event);
    callbacks?.push(callback);
    
    console.log(`🔌 Registered callback for: ${event}`);
    
    // Return a function to remove this event listener
    return () => {
      const callbacks = this.registeredEvents.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index !== -1) {
          callbacks.splice(index, 1);
          console.log(`🔌 Removed callback for: ${event}`);
        }
      }
    };
  }
  
  // Remove all listeners for a specific event
  public removeAllListeners(event: string): void {
    if (this.registeredEvents.has(event)) {
      this.registeredEvents.delete(event);
      console.log(`🔌 Removed all callbacks for: ${event}`);
    }
  }
  
  // Emit an event
  public emit(event: string, data: any): void {
    if (!this.socket) {
      this.connect();
    }
    
    console.log(`🔌 Emitting event: ${event}`, data);
    this.socket?.emit(event, data);
  }
  
  // Start a game
  public startGame(lobbyCode: string): void {
    console.log(`🔌 Starting game for lobby: ${lobbyCode}`);
    this.emit("start_game", { lobby_code: lobbyCode });
  }
  
  // Submit an answer
  public submitAnswer(
    lobbyCode: string,
    playerName: string,
    questionIndex: number,
    answer: string,
    timeTaken: number,
    isCorrect: boolean,
    score: number
  ): void {
    console.log(`🔌 Submitting answer for ${playerName} in lobby ${lobbyCode}`);
    this.emit("submit_answer", {
      lobby_code: lobbyCode,
      player_name: playerName,
      question_index: questionIndex,
      answer: answer,
      time_taken: timeTaken,
      is_correct: isCorrect,
      score: score,
    });
  }
  
  // Request the next question
  public requestNextQuestion(lobbyCode: string): void {
    console.log(`🔌 Requesting next question for lobby: ${lobbyCode}`);
    this.emit("request_next_question", { lobby_code: lobbyCode });
  }
  
  // Check if socket is connected
  public isConnected(): boolean {
    return !!this.socket?.connected;
  }
  
  // Get current socket
  public getSocket(): Socket | null {
    return this.socket;
  }
  
  // Setup base socket event listeners
  private setupBaseListeners(): void {
    if (!this.socket) return;
    
    this.socket.on("connect", () => {
      console.log(`🔌 Connected to socket server: ${this.socket?.id}`);
      this.reconnectAttempts = 0;
      this.notifyCallbacks("connect");
    });
    
    this.socket.on("disconnect", () => {
      console.log("🔌 Disconnected from socket server");
      this.notifyCallbacks("disconnect");
    });
    
    this.socket.on("connect_error", (error) => {
      console.error("🔌 Connection error:", error);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts > this.maxReconnectAttempts) {
        console.error("🔌 Maximum reconnect attempts reached");
      }
    });
    
    // Setup handlers for all expected server events
    [
      "lobby_update", "player_joined", "player_left", "game_started",
      "connection_response", "room_joined", "error", "new_question", 
      "player_answered", "all_answers_in", "scoreboard", "game_over"
    ].forEach(eventType => {
      this.socket?.on(eventType, (data) => {
        console.log(`🔌 Received ${eventType}:`, data);
        this.notifyCallbacks(eventType, data);
      });
    });
  }
  
  // Notify all callbacks registered for an event
  private notifyCallbacks(event: string, ...args: any[]): void {
    const callbacks = this.registeredEvents.get(event) || [];
    
    if (callbacks.length === 0) {
      console.log(`🔌 No callbacks registered for: ${event}`);
      return;
    }
    
    callbacks.forEach(callback => {
      try {
        callback(...args);
      } catch (error) {
        console.error(`🔌 Error in callback for ${event}:`, error);
      }
    });
  }
}

// Export singleton instance
export const socketService = new SocketService();
