'use client';

/**
 * Token Chat Component
 * Real-time chat for token pages using Native WebSocket
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthStore } from '@/lib/auth';
import { apiClient } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { useWebSocket } from '@/hooks/useWebSocket';

interface Comment {
    id: string;
    content: string;
    createdAt: string;
    user: {
        id: string;
        username: string | null;
        displayName: string | null;
        avatarUrl: string | null;
    };
}

interface TokenChatProps {
    tokenId: string;
    className?: string;
}

export function TokenChat({ tokenId, className }: TokenChatProps) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

    // Initial fetch
    useEffect(() => {
        const fetchComments = async () => {
            try {
                const response = await apiClient.get(`/api/v1/comments/token/${tokenId}`);
                if (response.data?.success) {
                    setComments(response.data.data.comments || []);
                }
            } catch (error) {
                console.error('Failed to fetch comments:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchComments();
    }, [tokenId]);

    // WebSocket Integration
    const { subscribe, unsubscribe, isConnected } = useWebSocket({
        onMessage: (msg) => {
            if (msg.channel === `comments:${tokenId}` && msg.event === 'comment') {
                const newComment = msg.data as Comment;
                setComments(prev => {
                    // Prevent duplicates
                    if (prev.find(c => c.id === newComment.id)) return prev;
                    return [newComment, ...prev];
                });
            }
        }
    });

    useEffect(() => {
        if (isConnected) {
            subscribe(`comments:${tokenId}`);
            return () => unsubscribe(`comments:${tokenId}`);
        }
    }, [tokenId, isConnected, subscribe, unsubscribe]);

    // Auto-scroll on new messages
    // We only scroll if we were already relatively close to bottom or it's my message
    // But for this simple chat, usually new messages appear at TOP or BOTTOM? 
    // UI shows `[...comments].reverse().map` so latest is at BOTTOM?
    // Let's check logic: `setComments(prev => [newComment, ...prev])` adds to START.
    // UI maps `reverse()`, so first item in array is rendered LAST (at bottom).
    // So newComment (index 0) becomes last element. Yes.

    useEffect(() => {
        // Scroll to bottom when comments change
        // Simple behavior: just scroll
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [comments]);


    // Send message
    const handleSend = async () => {
        if (!message.trim() || !isAuthenticated || sending) return;

        setSending(true);
        try {
            const response = await apiClient.post(`/api/v1/comments/token/${tokenId}`, {
                content: message.trim(),
            });

            if (response.data?.success) {
                setMessage('');
                // Success - wait for WS to deliver the message
            }
        } catch (error) {
            console.error('Failed to send comment:', error);
        } finally {
            setSending(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Format timestamp
    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const mins = Math.floor(diff / 60000);

        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
        return date.toLocaleDateString();
    };

    return (
        <div className={cn("flex flex-col bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl", className)}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/50">
                <div className="flex items-center gap-2">
                    <MessageCircle className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Live Chat</h3>
                    <span className="text-xs text-muted-foreground">({comments.length})</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className={cn(
                        "w-2 h-2 rounded-full",
                        isConnected ? "bg-green-500 animate-pulse" : "bg-muted"
                    )} />
                    <span className="text-xs text-muted-foreground">
                        {isConnected ? 'Live' : 'Connecting...'}
                    </span>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[400px] min-h-[200px]">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : comments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <MessageCircle className="h-10 w-10 mb-2 opacity-50" />
                        <p className="text-sm">No messages yet</p>
                        <p className="text-xs">Be the first to say something!</p>
                    </div>
                ) : (
                    <AnimatePresence mode="popLayout">
                        {[...comments].reverse().map((comment) => (
                            <motion.div
                                key={comment.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="flex gap-3"
                            >
                                <Avatar className="w-8 h-8 flex-shrink-0">
                                    <AvatarImage src={comment.user.avatarUrl || undefined} />
                                    <AvatarFallback className="bg-primary/20 text-xs">
                                        {(comment.user.displayName || comment.user.username || 'A').slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2 mb-0.5">
                                        <span className="font-medium text-sm truncate">
                                            {comment.user.displayName || comment.user.username || 'Anonymous'}
                                        </span>
                                        <span className="text-xs text-muted-foreground flex-shrink-0">
                                            {formatTime(comment.createdAt)}
                                        </span>
                                    </div>
                                    <p className="text-sm text-foreground/90 break-words">
                                        {comment.content}
                                    </p>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-border/50">
                {isAuthenticated ? (
                    <div className="flex gap-2">
                        <Input
                            placeholder="Type a message..."
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyPress={handleKeyPress}
                            disabled={sending}
                            className="flex-1 bg-background/50"
                            maxLength={500}
                        />
                        <Button
                            onClick={handleSend}
                            disabled={!message.trim() || sending}
                            size="icon"
                            className="bg-gradient-to-r from-primary to-purple-600 hover:opacity-90"
                        >
                            {sending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                ) : (
                    <div className="text-center py-2">
                        <p className="text-sm text-muted-foreground">
                            Connect wallet to chat
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
