import type { PriceUpdate, TradeEvent } from '@/types';

type MessageHandler = (data: unknown) => void;

interface WebSocketMessage {
    type: string;
    payload: unknown;
}

class WebSocketService {
    private ws: WebSocket | null = null;
    private url: string;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 1000;
    private handlers: Map<string, Set<MessageHandler>> = new Map();
    private subscriptions: Set<string> = new Set();
    private isConnecting = false;

    constructor(url?: string) {
        this.url = url || process.env.NEXT_PUBLIC_WS_URL || 'ws://192.168.0.25:3000/ws';
    }

    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                resolve();
                return;
            }

            if (this.isConnecting) {
                resolve();
                return;
            }

            this.isConnecting = true;

            try {
                this.ws = new WebSocket(this.url);

                this.ws.onopen = () => {
                    console.log('[WS] Connected');
                    this.reconnectAttempts = 0;
                    this.isConnecting = false;

                    // Resubscribe to previous subscriptions
                    this.subscriptions.forEach((subscription) => {
                        this.send({ type: 'subscribe', payload: { channel: subscription } });
                    });

                    resolve();
                };

                this.ws.onclose = () => {
                    console.log('[WS] Disconnected');
                    this.isConnecting = false;
                    this.attemptReconnect();
                };

                this.ws.onerror = (error) => {
                    console.error('[WS] Error:', error);
                    this.isConnecting = false;
                    reject(error);
                };

                this.ws.onmessage = (event) => {
                    try {
                        const message: WebSocketMessage = JSON.parse(event.data);
                        this.handleMessage(message);
                    } catch (error) {
                        console.error('[WS] Failed to parse message:', error);
                    }
                };
            } catch (error) {
                this.isConnecting = false;
                reject(error);
            }
        });
    }

    private handleMessage(message: WebSocketMessage) {
        const handlers = this.handlers.get(message.type);
        if (handlers) {
            handlers.forEach((handler) => handler(message.payload));
        }
    }

    private attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('[WS] Max reconnect attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

        console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

        setTimeout(() => {
            this.connect().catch(console.error);
        }, delay);
    }

    private send(message: WebSocketMessage) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    // Subscribe to a channel
    subscribe(channel: string) {
        this.subscriptions.add(channel);
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.send({ type: 'subscribe', payload: { channel } });
        }
    }

    // Unsubscribe from a channel
    unsubscribe(channel: string) {
        this.subscriptions.delete(channel);
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.send({ type: 'unsubscribe', payload: { channel } });
        }
    }

    // Subscribe to token price updates
    subscribeToToken(tokenId: string, handler: (data: PriceUpdate) => void) {
        const eventType = `price:${tokenId}`;
        this.on(eventType, handler as MessageHandler);
        this.subscribe(`token:${tokenId}`);

        return () => {
            this.off(eventType, handler as MessageHandler);
            this.unsubscribe(`token:${tokenId}`);
        };
    }

    // Subscribe to trade events for a token
    subscribeToTrades(tokenId: string, handler: (data: TradeEvent) => void) {
        const eventType = `trade:${tokenId}`;
        this.on(eventType, handler as MessageHandler);
        this.subscribe(`trades:${tokenId}`);

        return () => {
            this.off(eventType, handler as MessageHandler);
            this.unsubscribe(`trades:${tokenId}`);
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
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.handlers.clear();
        this.subscriptions.clear();
    }
}

// Singleton instance
export const wsService = new WebSocketService();
export default WebSocketService;
