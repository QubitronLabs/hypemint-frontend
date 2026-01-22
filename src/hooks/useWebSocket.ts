"use client";

import { useEffect, useRef, useCallback, useState } from "react";

interface WSMessage {
  channel: string;
  event: string;
  data: unknown;
  timestamp: number;
}

interface UseWebSocketOptions {
  onMessage?: (message: WSMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;
  sendMessage: (type: string, data?: unknown) => void;
}

// Derive WebSocket URL from API URL for production compatibility
function getWsUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL;
  }
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  // Convert http(s) to ws(s)
  const wsProtocol = apiUrl.startsWith("https") ? "wss" : "ws";
  const wsHost = apiUrl.replace(/^https?:\/\//, "");
  return `${wsProtocol}://${wsHost}/ws`;
}

const WS_URL = getWsUrl();

export function useWebSocket(
  options: UseWebSocketOptions = {},
): UseWebSocketReturn {
  const {
    onMessage,
    onConnect,
    onDisconnect,
    autoReconnect = true,
    reconnectInterval = 3000,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [isConnected, setIsConnected] = useState(false);
  const subscribedChannelsRef = useRef<Set<string>>(new Set());

  // Keep latest callbacks in refs to avoid reconnection loops when parent re-renders
  const callbacksRef = useRef({ onMessage, onConnect, onDisconnect });
  useEffect(() => {
    callbacksRef.current = { onMessage, onConnect, onDisconnect };
  }, [onMessage, onConnect, onDisconnect]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log("[WS] Connected to", WS_URL);
        setIsConnected(true);
        callbacksRef.current.onConnect?.();

        // Re-subscribe to all channels after reconnection
        for (const channel of subscribedChannelsRef.current) {
          ws.send(JSON.stringify({ type: "subscribe", channel }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          callbacksRef.current.onMessage?.(message);
        } catch (error) {
          console.error("[WS] Failed to parse message:", error);
        }
      };

      ws.onclose = () => {
        console.log("[WS] Disconnected");
        setIsConnected(false);
        callbacksRef.current.onDisconnect?.();

        // Auto reconnect
        if (autoReconnect) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log("[WS] Attempting to reconnect...");
            connect();
          }, reconnectInterval);
        }
      };

      ws.onerror = (error) => {
        console.error("[WS] Error:", error);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("[WS] Failed to connect:", error);
    }
  }, [autoReconnect, reconnectInterval]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const subscribe = useCallback((channel: string) => {
    subscribedChannelsRef.current.add(channel);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "subscribe", channel }));
    }
  }, []);

  const unsubscribe = useCallback((channel: string) => {
    subscribedChannelsRef.current.delete(channel);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "unsubscribe", channel }));
    }
  }, []);

  const sendMessage = useCallback((type: string, data?: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, data }));
    }
  }, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    isConnected,
    subscribe,
    unsubscribe,
    sendMessage,
  };
}

/**
 * Hook for subscribing to token price updates
 */
export function useTokenPriceUpdates(
  tokenId: string | undefined,
  onUpdate: (data: {
    price: string;
    priceChange24h: number;
    marketCap: string;
  }) => void,
) {
  const { subscribe, unsubscribe, isConnected } = useWebSocket({
    onMessage: (message) => {
      if (
        message.channel === `price:${tokenId}` &&
        message.event === "price_update"
      ) {
        onUpdate(
          message.data as {
            price: string;
            priceChange24h: number;
            marketCap: string;
          },
        );
      }
    },
  });

  useEffect(() => {
    if (tokenId && isConnected) {
      subscribe(`price:${tokenId}`);
      return () => unsubscribe(`price:${tokenId}`);
    }
  }, [tokenId, isConnected, subscribe, unsubscribe]);
}

/**
 * Hook for subscribing to token trade feed
 */
export function useTokenTradeFeed(
  tokenId: string | undefined,
  onTrade: (trade: {
    tradeId: string;
    userId: string;
    username?: string;
    type: "buy" | "sell";
    amount: string;
    price: string;
    totalValue: string;
    timestamp: number;
  }) => void,
) {
  const { subscribe, unsubscribe, isConnected } = useWebSocket({
    onMessage: (message) => {
      if (
        message.channel === `trades:${tokenId}` &&
        message.event === "trade_executed"
      ) {
        onTrade(message.data as Parameters<typeof onTrade>[0]);
      }
    },
  });

  useEffect(() => {
    if (tokenId && isConnected) {
      subscribe(`trades:${tokenId}`);
      return () => unsubscribe(`trades:${tokenId}`);
    }
  }, [tokenId, isConnected, subscribe, unsubscribe]);
}

/**
 * Hook for receiving user notifications
 */
export function useUserNotifications(
  userId: string | undefined,
  onNotification: (notification: {
    id: string;
    type: string;
    title: string;
    message: string;
    timestamp: number;
  }) => void,
) {
  const { subscribe, unsubscribe, isConnected } = useWebSocket({
    onMessage: (message) => {
      if (
        message.channel === `user:${userId}` &&
        message.event === "notification"
      ) {
        onNotification(message.data as Parameters<typeof onNotification>[0]);
      }
    },
  });

  useEffect(() => {
    if (userId && isConnected) {
      subscribe(`user:${userId}`);
      return () => unsubscribe(`user:${userId}`);
    }
  }, [userId, isConnected, subscribe, unsubscribe]);
}

/**
 * Hook for global trending updates
 */
export function useTrendingUpdates(
  onUpdate: (
    tokens: Array<{
      tokenId: string;
      name: string;
      symbol: string;
      price: string;
      priceChange24h: number;
      rank: number;
    }>,
  ) => void,
) {
  const { subscribe, unsubscribe, isConnected } = useWebSocket({
    onMessage: (message) => {
      if (
        message.channel === "global:trending" &&
        message.event === "trending_update"
      ) {
        const data = message.data as { tokens: Parameters<typeof onUpdate>[0] };
        onUpdate(data.tokens);
      }
    },
  });

  useEffect(() => {
    if (isConnected) {
      subscribe("global:trending");
      return () => unsubscribe("global:trending");
    }
  }, [isConnected, subscribe, unsubscribe]);
}

/**
 * Hook for new token creation updates (real-time feed)
 */
export function useNewTokenFeed(
  onNewToken: (token: {
    tokenId: string;
    name: string;
    symbol: string;
    imageUrl?: string;
    creatorId: string;
    creatorUsername?: string;
    chainId: number;
    timestamp: number;
  }) => void,
) {
  const { subscribe, unsubscribe, isConnected } = useWebSocket({
    onMessage: (message) => {
      if (
        message.channel === "global:tokens" &&
        message.event === "token_created"
      ) {
        onNewToken(message.data as Parameters<typeof onNewToken>[0]);
      }
    },
  });

  useEffect(() => {
    if (isConnected) {
      subscribe("global:tokens");
      return () => unsubscribe("global:tokens");
    }
  }, [isConnected, subscribe, unsubscribe]);
}

/**
 * Hook for token graduation updates
 */
export function useTokenGraduations(
  onGraduation: (data: {
    tokenId: string;
    name: string;
    symbol: string;
    finalMarketCap: string;
    timestamp: number;
  }) => void,
) {
  const { subscribe, unsubscribe, isConnected } = useWebSocket({
    onMessage: (message) => {
      if (
        message.channel === "global:tokens" &&
        message.event === "token_graduated"
      ) {
        onGraduation(message.data as Parameters<typeof onGraduation>[0]);
      }
    },
  });

  useEffect(() => {
    if (isConnected) {
      subscribe("global:tokens");
      return () => unsubscribe("global:tokens");
    }
  }, [isConnected, subscribe, unsubscribe]);
}

/**
 * Hook for global trade feed (all trades across all tokens)
 */
export function useGlobalTradeFeed(
  onTrade: (trade: {
    tradeId: string;
    tokenId: string;
    tokenSymbol: string;
    userId: string;
    username?: string;
    type: "buy" | "sell";
    amount: string;
    price: string;
    totalValue: string;
    timestamp: number;
  }) => void,
) {
  const { subscribe, unsubscribe, isConnected } = useWebSocket({
    onMessage: (message) => {
      if (
        message.channel === "global:trades" &&
        message.event === "trade_executed"
      ) {
        onTrade(message.data as Parameters<typeof onTrade>[0]);
      }
    },
  });

  useEffect(() => {
    if (isConnected) {
      subscribe("global:trades");
      return () => unsubscribe("global:trades");
    }
  }, [isConnected, subscribe, unsubscribe]);
}
