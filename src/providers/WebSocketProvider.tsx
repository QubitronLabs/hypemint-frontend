"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";

// WebSocket message types
interface WSMessage {
  channel: string;
  event: string;
  data: unknown;
  timestamp: number;
}

type MessageHandler = (message: WSMessage) => void;

interface WebSocketContextValue {
  isConnected: boolean;
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;
  onMessage: (handler: MessageHandler) => () => void;
  sendPing: () => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

// Derive WebSocket URL from API URL
function getWsUrl(): string {
  if (typeof window === "undefined") return "";

  if (process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL;
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  const wsProtocol = apiUrl.startsWith("https") ? "wss" : "ws";
  const wsHost = apiUrl.replace(/^https?:\/\//, "");
  return `${wsProtocol}://${wsHost}/ws`;
}

interface WebSocketProviderProps {
  children: React.ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const reconnectAttemptsRef = useRef(0);
  const subscribedChannelsRef = useRef<Set<string>>(new Set());
  const messageHandlersRef = useRef<Set<MessageHandler>>(new Set());
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPongRef = useRef<number>(Date.now());

  const MAX_RECONNECT_ATTEMPTS = 10;
  const BASE_RECONNECT_DELAY = 1000;
  const MAX_RECONNECT_DELAY = 30000;
  const PING_INTERVAL = 25000; // Send ping every 25 seconds
  const PONG_TIMEOUT = 10000; // Expect pong within 10 seconds

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    const wsUrl = getWsUrl();
    if (!wsUrl) return;

    // Don't reconnect if already connected or connecting
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    try {
      console.log("[WS] Connecting to:", wsUrl);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("[WS] Connected!");
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        lastPongRef.current = Date.now();

        // Re-subscribe to all channels after reconnection
        for (const channel of subscribedChannelsRef.current) {
          ws.send(JSON.stringify({ type: "subscribe", channel }));
        }

        // Start ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            // Check if we received a pong recently
            if (
              Date.now() - lastPongRef.current >
              PING_INTERVAL + PONG_TIMEOUT
            ) {
              console.log("[WS] Pong timeout, reconnecting...");
              ws.close();
              return;
            }
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, PING_INTERVAL);
      };

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);

          // Handle pong
          if (message.event === "pong" || message.event === "heartbeat") {
            lastPongRef.current = Date.now();
            return;
          }

          // Notify all handlers
          for (const handler of messageHandlersRef.current) {
            try {
              handler(message);
            } catch (error) {
              console.error("[WS] Handler error:", error);
            }
          }
        } catch (error) {
          console.error("[WS] Failed to parse message:", error);
        }
      };

      ws.onclose = (event) => {
        console.log("[WS] Disconnected:", event.code, event.reason);
        setIsConnected(false);
        cleanup();

        // Don't reconnect if closed intentionally
        if (event.code === 1000) return;

        // Exponential backoff reconnect
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = Math.min(
            BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current),
            MAX_RECONNECT_DELAY,
          );
          console.log(
            `[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1})`,
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        } else {
          console.error("[WS] Max reconnection attempts reached");
        }
      };

      ws.onerror = (error) => {
        console.error("[WS] Error:", error);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("[WS] Failed to connect:", error);
    }
  }, [cleanup]);

  // Connect on mount
  useEffect(() => {
    connect();

    return () => {
      cleanup();
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounted");
        wsRef.current = null;
      }
    };
  }, [connect, cleanup]);

  // Subscribe to a channel
  const subscribe = useCallback((channel: string) => {
    subscribedChannelsRef.current.add(channel);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "subscribe", channel }));
    }
  }, []);

  // Unsubscribe from a channel
  const unsubscribe = useCallback((channel: string) => {
    subscribedChannelsRef.current.delete(channel);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "unsubscribe", channel }));
    }
  }, []);

  // Register message handler
  const onMessage = useCallback((handler: MessageHandler) => {
    messageHandlersRef.current.add(handler);
    return () => {
      messageHandlersRef.current.delete(handler);
    };
  }, []);

  // Send ping manually
  const sendPing = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "ping" }));
    }
  }, []);

  return (
    <WebSocketContext.Provider
      value={{ isConnected, subscribe, unsubscribe, onMessage, sendPing }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

// Hook to use WebSocket context
export function useGlobalWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useGlobalWebSocket must be used within WebSocketProvider");
  }
  return context;
}

// Hook to listen for specific events
export function useWebSocketEvent(
  event: string,
  handler: (data: unknown) => void,
) {
  const { onMessage } = useGlobalWebSocket();

  useEffect(() => {
    return onMessage((message) => {
      if (message.event === event) {
        handler(message.data);
      }
    });
  }, [event, handler, onMessage]);
}

// Hook to listen for new tokens
export function useNewTokens(handler: (token: unknown) => void) {
  const { onMessage } = useGlobalWebSocket();

  useEffect(() => {
    return onMessage((message) => {
      if (message.event === "token:created") {
        handler(message.data);
      }
    });
  }, [handler, onMessage]);
}
