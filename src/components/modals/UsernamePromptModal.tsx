'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Sparkles, Check, AlertCircle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUsernamePromptStore } from '@/lib/username-prompt';
import { registerUser } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/auth';
import { cn } from '@/lib/utils';

/**
 * Global Username Setup Modal (Non-Skippable)
 * 
 * Shows when user is authenticated but hasn't set username.
 * Cannot be dismissed - username is REQUIRED to use the platform.
 * 
 * Uses POST /api/v1/auth/register endpoint.
 */
export function UsernamePromptModal() {
    const { isOpen, close, onSuccess } = useUsernamePromptStore();
    const { setUser } = useAuthStore();
    const queryClient = useQueryClient();

    const [username, setUsername] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

    // Username validation regex: 3-32 chars, alphanumeric and underscore
    const usernameRegex = /^[a-zA-Z0-9_]{3,32}$/;

    // Validate username on change
    useEffect(() => {
        if (!username) {
            setError(null);
            setIsAvailable(null);
            return;
        }

        if (username.length < 3) {
            setError('Username must be at least 3 characters');
            setIsAvailable(null);
            return;
        }

        if (username.length > 32) {
            setError('Username must be less than 32 characters');
            setIsAvailable(null);
            return;
        }

        if (!usernameRegex.test(username)) {
            setError('Only letters, numbers, and underscores allowed');
            setIsAvailable(null);
            return;
        }

        setError(null);

        // Simulate availability check (debounced)
        setIsChecking(true);
        const timer = setTimeout(() => {
            // In real app, call API to check availability
            setIsAvailable(true);
            setIsChecking(false);
        }, 500);

        return () => clearTimeout(timer);
    }, [username]);

    // Mutation to register user with username
    const register = useMutation({
        mutationFn: (newUsername: string) => registerUser(newUsername),
        onSuccess: (registeredUser) => {
            // Update user in auth store
            setUser(registeredUser);
            // Invalidate user queries
            queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
            // Close modal
            close();
            // Call success callback if provided
            onSuccess?.();
        },
        onError: (err: any) => {
            const errorCode = err.response?.data?.error?.code;
            const errorMessage = err.response?.data?.error?.message;

            if (errorCode === 'CONFLICT' || err.response?.status === 409) {
                setError('This username is already taken');
                setIsAvailable(false);
            } else {
                setError(errorMessage || 'Failed to register username');
            }
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!username || error || !isAvailable) return;
        register.mutate(username);
    };

    // Prevent closing by clicking outside or pressing escape
    const handleOpenChange = (open: boolean) => {
        // Only allow opening, not closing
        if (open) return;
        // Do nothing - prevent close
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent
                className="sm:max-w-md bg-card border-border"
                // Hide close button
                onPointerDownOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
            >
                <DialogHeader>
                    <div className="flex items-center justify-center mb-4">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                            className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center"
                        >
                            <Sparkles className="h-8 w-8 text-primary" />
                        </motion.div>
                    </div>
                    <DialogTitle className="text-center text-xl">
                        Choose your username
                    </DialogTitle>
                    <DialogDescription className="text-center">
                        This is how other traders will see you on HypeMint.
                        <br />
                        <span className="text-primary font-medium">Username is required to continue.</span>
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    {/* Username Input */}
                    <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                            @
                        </div>
                        <Input
                            value={username}
                            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                            placeholder="username"
                            className={cn(
                                'pl-8 pr-10 h-12 text-lg bg-muted border-transparent',
                                'focus:border-primary/50',
                                error && 'border-destructive focus:border-destructive'
                            )}
                            autoFocus
                            maxLength={32}
                        />
                        {/* Status indicator */}
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <AnimatePresence mode="wait">
                                {isChecking && (
                                    <motion.div
                                        key="checking"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                    >
                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                    </motion.div>
                                )}
                                {!isChecking && isAvailable && (
                                    <motion.div
                                        key="available"
                                        initial={{ opacity: 0, scale: 0.5 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.5 }}
                                    >
                                        <Check className="h-4 w-4 text-primary" />
                                    </motion.div>
                                )}
                                {error && (
                                    <motion.div
                                        key="error"
                                        initial={{ opacity: 0, scale: 0.5 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.5 }}
                                    >
                                        <AlertCircle className="h-4 w-4 text-destructive" />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Error/Help text */}
                    <AnimatePresence mode="wait">
                        {error ? (
                            <motion.p
                                key="error"
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="text-sm text-destructive"
                            >
                                {error}
                            </motion.p>
                        ) : username && isAvailable ? (
                            <motion.p
                                key="available"
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="text-sm text-primary"
                            >
                                ✓ @{username} is available
                            </motion.p>
                        ) : (
                            <motion.p
                                key="help"
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="text-sm text-muted-foreground"
                            >
                                3-32 characters, letters, numbers, and underscores only
                            </motion.p>
                        )}
                    </AnimatePresence>

                    {/* Submit Button */}
                    <Button
                        type="submit"
                        disabled={!username || !!error || !isAvailable || register.isPending}
                        className="w-full h-12 text-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                        {register.isPending ? (
                            <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Registering...
                            </>
                        ) : (
                            'Continue'
                        )}
                    </Button>
                </form>

                {/* Note */}
                <p className="text-xs text-muted-foreground text-center mt-2">
                    Username can be changed later in profile settings
                </p>
            </DialogContent>
        </Dialog>
    );
}
