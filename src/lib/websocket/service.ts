import { io, Socket } from "socket.io-client";
import type { PriceUpdate, TradeEvent } from "@/types";

type MessageHandler = (data: any) => void;

// Event types for global broadcasts
export type GlobalEventType =
  | "token:created"
  | "token:graduated"
  | "trade"
  | "trending:update"
  | "price_update"
  | "notification";

interface ConnectionState {
  status: "disconnected" | "connecting" | "connected" | "reconnecting";
  lastConnected: number | null;
  reconnectAttempts: number;
}

class WebSocketService {
  private socket: Socket | null = null;
  private url: string;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private globalHandlers: Map<GlobalEventType, Set<MessageHandler>> = new Map();
  private rooms: Set<string> = new Set();
  private userId: string | null = null;
  private connectionState: ConnectionState = {
    status: "disconnected",
    lastConnected: null,
    reconnectAttempts: 0,
  };
  private stateChangeHandlers: Set<(state: ConnectionState) => void> =
    new Set();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private maxReconnectAttempts = 10;
  private reconnectBaseDelay = 1000;

  constructor() {
    // Use the same port as API (4000) - backend handles both HTTP and WebSocket
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    // Ensure no trailing slash for Socket.IO
    this.url = apiUrl.replace(/\/$/, "");
  }

  // Get current connection state
  getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  // Subscribe to connection state changes
  onConnectionStateChange(
    handler: (state: ConnectionState) => void,
  ): () => void {
    this.stateChangeHandlers.add(handler);
    return () => this.stateChangeHandlers.delete(handler);
  }

  private updateConnectionState(updates: Partial<ConnectionState>) {
    this.connectionState = { ...this.connectionState, ...updates };
    this.stateChangeHandlers.forEach((handler) =>
      handler(this.connectionState),
    );
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      if (this.connectionState.status === "connecting") {
        // Wait for existing connection attempt
        const checkConnection = setInterval(() => {
          if (this.socket?.connected) {
            clearInterval(checkConnection);
            resolve();
          }
        }, 100);
        return;
      }

      this.updateConnectionState({ status: "connecting" });

      try {
        this.socket = io(this.url, {
          path: "/socket.io/",
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionAttempts: this.maxReconnectAttempts,
          reconnectionDelay: this.reconnectBaseDelay,
          reconnectionDelayMax: 10000,
          timeout: 20000,
          forceNew: true,
        });

        this.socket.on("connect", () => {
          console.log("[Socket.IO] Connected");
          this.updateConnectionState({
            status: "connected",
            lastConnected: Date.now(),
            reconnectAttempts: 0,
          });

          // Rejoin rooms
          this.rooms.forEach((room) => {
            this.socket?.emit("subscribe:token", room);
          });

          // Rejoin user room if authenticated
          if (this.userId) {
            this.socket?.emit("subscribe:user", this.userId);
          }

          // Join global room for broadcasts
          this.socket?.emit("join", "global");

          // Start heartbeat
          this.startHeartbeat();

          resolve();
        });

        this.socket.on("disconnect", (reason) => {
          console.log("[Socket.IO] Disconnected:", reason);
          this.stopHeartbeat();
          this.updateConnectionState({ status: "disconnected" });

          // Handle unexpected disconnects
          if (
            reason === "io server disconnect" ||
            reason === "transport close"
          ) {
            this.scheduleReconnect();
          }
        });

        this.socket.on("connect_error", (error) => {
          console.error("[Socket.IO] Connection error:", error);
          this.updateConnectionState({
            status: "disconnected",
            reconnectAttempts: this.connectionState.reconnectAttempts + 1,
          });
          reject(error);
        });

        this.socket.on("reconnecting", (attempt) => {
          console.log("[Socket.IO] Reconnecting... attempt:", attempt);
          this.updateConnectionState({
            status: "reconnecting",
            reconnectAttempts: attempt,
          });
        });

        this.socket.on("reconnect", () => {
          console.log("[Socket.IO] Reconnected");
          this.updateConnectionState({
            status: "connected",
            lastConnected: Date.now(),
            reconnectAttempts: 0,
          });
        });

        // Set up event listeners for all event types
        this.setupEventListeners();
      } catch (error) {
        this.updateConnectionState({ status: "disconnected" });
        reject(error);
      }
    });
  }

  private setupEventListeners() {
    if (!this.socket) return;

    // Token-specific events
    this.socket.on("token:trade", (data) => this.handleMessage("trade", data));
    this.socket.on("price:update", (data) =>
      this.handleMessage("price_update", data),
    );

    // Global events
    this.socket.on("trade", (data) => this.handleGlobalEvent("trade", data));
    this.socket.on("token:created", (data) =>
      this.handleGlobalEvent("token:created", data),
    );
    this.socket.on("token:graduated", (data) =>
      this.handleGlobalEvent("token:graduated", data),
    );
    this.socket.on("trending:update", (data) =>
      this.handleGlobalEvent("trending:update", data),
    );
    this.socket.on("notification", (data) =>
      this.handleGlobalEvent("notification", data),
    );

    // Subscribed confirmations
    this.socket.on("subscribed:token", (data) =>
      console.log("[Socket.IO] Subscribed to token:", data.tokenId),
    );
    this.socket.on("subscribed:user", (data) =>
      console.log("[Socket.IO] Subscribed to user:", data.userId),
    );
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit("ping");
      }
    }, 25000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) return;
    if (this.connectionState.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[Socket.IO] Max reconnect attempts reached");
      return;
    }

    const delay = Math.min(
      this.reconnectBaseDelay *
        Math.pow(2, this.connectionState.reconnectAttempts),
      30000,
    );

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect().catch(() => {
        this.scheduleReconnect();
      });
    }, delay);
  }

  private handleMessage(type: string, payload: any) {
    // Handle generic type
    const genericHandlers = this.handlers.get(type);
    if (genericHandlers) {
      genericHandlers.forEach((handler) => handler(payload));
    }

    // Handle specific type with ID (e.g., trade:tokenId)
    if (payload?.tokenId) {
      const specificHandlers = this.handlers.get(`${type}:${payload.tokenId}`);
      if (specificHandlers) {
        specificHandlers.forEach((handler) => handler(payload));
      }
    }
  }

  private handleGlobalEvent(type: GlobalEventType, payload: any) {
    const handlers = this.globalHandlers.get(type);
    if (handlers) {
      handlers.forEach((handler) => handler(payload));
    }
  }

  // Set user ID for user-specific notifications
  setUserId(userId: string | null) {
    const previousUserId = this.userId;
    this.userId = userId;

    if (this.socket?.connected) {
      // Unsubscribe from previous user
      if (previousUserId) {
        this.socket.emit("unsubscribe:user", previousUserId);
      }
      // Subscribe to new user
      if (userId) {
        this.socket.emit("subscribe:user", userId);
      }
    }
  }

  // Subscribe to global events
  onGlobalEvent(
    eventType: GlobalEventType,
    handler: MessageHandler,
  ): () => void {
    if (!this.globalHandlers.has(eventType)) {
      this.globalHandlers.set(eventType, new Set());
    }
    this.globalHandlers.get(eventType)!.add(handler);

    if (!this.socket?.connected) {
      this.connect().catch(console.error);
    }

    return () => {
      this.globalHandlers.get(eventType)?.delete(handler);
    };
  }

  // Subscribe to a token room
  subscribeToTokenRoom(tokenId: string) {
    if (!this.rooms.has(tokenId)) {
      this.rooms.add(tokenId);
      if (this.socket?.connected) {
        this.socket.emit("subscribe:token", tokenId);
      }
    }
  }

  unsubscribeFromTokenRoom(tokenId: string) {
    this.rooms.delete(tokenId);
    if (this.socket?.connected) {
      this.socket.emit("unsubscribe:token", tokenId);
    }
  }

  // Subscribe to token price updates
  subscribeToToken(tokenId: string, handler: (data: PriceUpdate) => void) {
    const eventType = `price_update:${tokenId}`;
    this.on(eventType, handler as MessageHandler);
    this.subscribeToTokenRoom(tokenId);

    if (!this.socket) {
      this.connect();
    }

    return () => {
      this.off(eventType, handler as MessageHandler);
      // We don't automatically leave the room because other components might need it
    };
  }

  // Subscribe to trade events for a token
  subscribeToTrades(tokenId: string, handler: (data: TradeEvent) => void) {
    const eventType = `trade:${tokenId}`;
    this.on(eventType, handler as MessageHandler);
    this.subscribeToTokenRoom(tokenId);

    if (!this.socket) {
      this.connect();
    }

    return () => {
      this.off(eventType, handler as MessageHandler);
    };
  }

  // Add event handler
  on(eventType: string, handler: MessageHandler) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
  }

  // Remove event handler
  off(eventType: string, handler: MessageHandler) {
    this.handlers.get(eventType)?.delete(handler);
  }

  // Disconnect
  disconnect() {
    this.stopHeartbeat();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.handlers.clear();
    this.globalHandlers.clear();
    this.rooms.clear();
    this.userId = null;
    this.updateConnectionState({
      status: "disconnected",
      reconnectAttempts: 0,
    });
  }

  // Check if connected
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

// Singleton instance
export const wsService = new WebSocketService();
export default WebSocketService;
