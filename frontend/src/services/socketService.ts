import { io, Socket } from "socket.io-client";
import { useToast } from "@/components/ui/use-toast";
import { useLocation } from "react-router-dom";

// Define event callback type
type EventCallback = (...args: any[]) => void;

// Socket service singleton class
class SocketService {
  private socket: Socket | null = null;
  private serverUrl = "http://127.0.0.1:5000/";
  private registeredEvents: Map<string, EventCallback[]> = new Map();
  private connectedLobbyCode: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private eventHandlers: Map<string, (...args: any[]) => void> = new Map();
  
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
    } else if (!this.socket.connected) {
      console.log("🔌 Reconnecting socket");
      this.socket.connect();
    }
    
    return this.socket;
  }
  
  // Disconnect the socket
  public disconnect(): void {
    if (this.socket) {
      console.log("🔌 Disconnecting socket");
      
      // Clear all existing socket event listeners first
      if (this.socket.hasListeners('connect')) this.socket.off('connect');
      if (this.socket.hasListeners('disconnect')) this.socket.off('disconnect');
      if (this.socket.hasListeners('connect_error')) this.socket.off('connect_error');
      
      // Clear other event handlers
      [
        "lobby_update", "player_joined", "player_left", "game_started",
        "connection_response", "room_joined", "error", "new_question", 
        "player_answered", "all_answers_in", "scoreboard", "game_over"
      ].forEach(eventType => {
        if (this.socket?.hasListeners(eventType)) {
          this.socket.off(eventType);
        }
      });
      
      this.socket.disconnect();
      this.socket = null;
      this.connectedLobbyCode = null;
      this.registeredEvents.clear();
      this.eventHandlers.clear();
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
  
  // Register an event listener with improved event tracking
  public on(event: string, callback: EventCallback): () => void {
    if (!this.socket) {
      this.connect();
    }
    
    if (!this.registeredEvents.has(event)) {
      this.registeredEvents.set(event, []);
      
      // Create a handler for this event type if it doesn't exist
      if (!this.eventHandlers.has(event)) {
        const handler = (...args: any[]) => {
          this.notifyCallbacks(event, ...args);
        };
        
        this.eventHandlers.set(event, handler);
        this.socket?.on(event, handler);
        console.log(`🔌 Added socket listener for: ${event}`);
      }
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
          
          // If no more callbacks for this event, remove the socket listener
          if (callbacks.length === 0) {
            const handler = this.eventHandlers.get(event);
            if (handler && this.socket) {
              this.socket.off(event, handler);
              this.eventHandlers.delete(event);
              this.registeredEvents.delete(event);
              console.log(`🔌 Removed socket listener for: ${event}`);
            }
          }
        }
      }
    };
  }
  
  // Remove all listeners for a specific event with proper cleanup
  public removeAllListeners(event: string): void {
    const handler = this.eventHandlers.get(event);
    if (handler && this.socket) {
      this.socket.off(event, handler);
      this.eventHandlers.delete(event);
    }
    
    if (this.registeredEvents.has(event)) {
      this.registeredEvents.delete(event);
      console.log(`🔌 Removed all callbacks for: ${event}`);
    }
  }
  
  // Emit an event with connection check and error handling
  public emit(event: string, data: any): void {
    if (!this.socket || !this.socket.connected) {
      console.log(`🔌 Socket not connected, connecting before emitting ${event}`);
      this.connect();
      
      // Allow a small delay for connection to establish
      setTimeout(() => {
        console.log(`🔌 Emitting delayed event: ${event}`, data);
        this.socket?.emit(event, data);
      }, 500);
      return;
    }
    
    console.log(`🔌 Emitting event: ${event}`, data);
    try {
      this.socket.emit(event, data);
    } catch (error) {
      console.error(`🔌 Error emitting ${event}:`, error);
    }
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
  
  // Setup base socket event listeners with better error handling
  private setupBaseListeners(): void {
    if (!this.socket) return;
    
    this.socket.on("connect", () => {
      console.log(`🔌 Connected to socket server: ${this.socket?.id}`);
      this.reconnectAttempts = 0;
      this.notifyCallbacks("connect");
      
      // Rejoin room if there was a previous connection
      if (this.connectedLobbyCode) {
        console.log(`🔌 Automatically rejoining room: ${this.connectedLobbyCode}`);
      }
    });
    
    this.socket.on("disconnect", (reason) => {
      console.log(`🔌 Disconnected from socket server: ${reason}`);
      this.notifyCallbacks("disconnect");
    });
    
    this.socket.on("connect_error", (error) => {
      console.error("🔌 Connection error:", error);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts > this.maxReconnectAttempts) {
        console.error("🔌 Maximum reconnect attempts reached");
        this.socket?.disconnect();
      }
    });

    this.socket.on("host_left", () => {
      console.log("🔌 Host left. Lobby closed.");
      alert("Host left. Lobby closed. Please create a new game.");
      this.disconnect();
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

  // Add logic to connect socket only on /multiplayer page and disconnect otherwise
  public initializeSocketBasedOnRoute(): void {
    const location = useLocation();

    if (location.pathname === "/multiplayer") {
      this.connect();
    } else {
      this.disconnect();
    }
  }

  // Add validation logic for lobby on reconnect
  public validateLobby(lobbyCode: string): void {
    if (!this.socket) {
      this.connect();
    }

    this.socket?.emit("validate_lobby", { lobby_code: lobbyCode }, (response: { valid: boolean }) => {
      if (!response.valid) {
        console.log("🔌 Lobby is invalid. Clearing session.");
        sessionStorage.clear();
        alert("Lobby is invalid. Please create or join a new lobby.");
      }
    });
  }
}

// Export singleton instance
export const socketService = new SocketService();
