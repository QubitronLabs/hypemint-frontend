import { io, Socket } from 'socket.io-client';
import type { PriceUpdate, TradeEvent } from '@/types';

type MessageHandler = (data: any) => void;

class WebSocketService {
    private socket: Socket | null = null;
    private url: string;
    private handlers: Map<string, Set<MessageHandler>> = new Map();
    private rooms: Set<string> = new Set();
    private isConnecting = false;

    constructor() {
        // Use the same port as API (4000) - backend handles both HTTP and WebSocket
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        // Ensure no trailing slash for Socket.IO
        this.url = apiUrl.replace(/\/$/, '');
    }

    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.socket?.connected) {
                resolve();
                return;
            }

            if (this.isConnecting) {
                resolve();
                return;
            }

            this.isConnecting = true;

            try {
                this.socket = io(this.url, {
                    path: '/socket.io/',
                    transports: ['websocket', 'polling'],
                    reconnection: true,
                    reconnectionAttempts: 5,
                    reconnectionDelay: 1000,
                });

                this.socket.on('connect', () => {
                    console.log('[Socket.IO] Connected');
                    this.isConnecting = false;

                    // Rejoin rooms
                    this.rooms.forEach(room => {
                        this.socket?.emit('join:token', room);
                    });

                    resolve();
                });

                this.socket.on('disconnect', () => {
                    console.log('[Socket.IO] Disconnected');
                    this.isConnecting = false;
                });

                this.socket.on('connect_error', (error) => {
                    console.error('[Socket.IO] Error:', error);
                    this.isConnecting = false;
                    reject(error);
                });

                // Set up event listeners for all registered types
                this.socket.on('comment', (data) => this.handleMessage('comment', data));
                this.socket.on('trade', (data) => this.handleMessage('trade', data));
                this.socket.on('price_update', (data) => this.handleMessage('price_update', data));
                this.socket.on('joined', (data) => console.log('[Socket.IO] Joined room:', data));

            } catch (error) {
                this.isConnecting = false;
                reject(error);
            }
        });
    }

    private handleMessage(type: string, payload: any) {
        // Handle generic type
        const genericHandlers = this.handlers.get(type);
        if (genericHandlers) {
            genericHandlers.forEach(handler => handler(payload));
        }

        // Handle specific type with ID (e.g., trade:tokenId)
        if (payload?.tokenId) {
            const specificHandlers = this.handlers.get(`${type}:${payload.tokenId}`);
            if (specificHandlers) {
                specificHandlers.forEach(handler => handler(payload));
            }
        }
    }

    // Subscribe to a token room
    subscribeToTokenRoom(tokenId: string) {
        if (!this.rooms.has(tokenId)) {
            this.rooms.add(tokenId);
            if (this.socket?.connected) {
                this.socket.emit('join:token', tokenId);
            }
        }
    }

    unsubscribeFromTokenRoom(tokenId: string) {
        this.rooms.delete(tokenId);
        if (this.socket?.connected) {
            this.socket.emit('leave:token', tokenId);
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
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.handlers.clear();
        this.rooms.clear();
    }
}

// Singleton instance
export const wsService = new WebSocketService();
export default WebSocketService;
