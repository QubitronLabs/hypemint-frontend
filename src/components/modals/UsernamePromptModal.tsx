'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Sparkles, Check, AlertCircle, User } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
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
import { registerUser, checkUsernameAvailable } from '@/lib/api/auth';
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
    const { isOpen, onSuccess, setUsernameCompleted } = useUsernamePromptStore();
    const { updateUser } = useAuthStore();

    const [username, setUsername] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
    const [checkTimeout, setCheckTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

    // Username validation regex: 3-32 chars, alphanumeric and underscore
    const usernameRegex = /^[a-zA-Z0-9_]{3,32}$/;

    // Debounced availability check
    const checkAvailability = useCallback(async (name: string) => {
        if (!name || name.length < 3 || !usernameRegex.test(name)) {
            return;
        }

        setIsChecking(true);
        try {
            const available = await checkUsernameAvailable(name);
            setIsAvailable(available);
            if (!available) {
                setError('This username is already taken');
            }
        } catch {
            // Assume available if check fails
            setIsAvailable(true);
        } finally {
            setIsChecking(false);
        }
    }, []);

    // Validate username on change
    useEffect(() => {
        // Clear previous timeout
        if (checkTimeout) {
            clearTimeout(checkTimeout);
        }

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

        // Debounced availability check
        const timeout = setTimeout(() => {
            checkAvailability(username);
        }, 500);

        setCheckTimeout(timeout);

        return () => clearTimeout(timeout);
    }, [username, checkAvailability]);

    // Mutation to register user with username
    const register = useMutation({
        mutationFn: (newUsername: string) => registerUser(newUsername),
        onSuccess: (registeredUser) => {
            console.log('[Username] Successfully registered:', registeredUser.username);

            // Update user in auth store with new username
            updateUser({
                id: registeredUser.id,
                walletAddress: registeredUser.walletAddress,
                username: registeredUser.username,
                displayName: registeredUser.displayName,
                avatarUrl: registeredUser.avatarUrl,
                bio: registeredUser.bio,
                isVerified: registeredUser.isVerified,
            });

            // Mark username as completed in prompt store
            setUsernameCompleted();

            // Call success callback if provided
            onSuccess?.();

            // Reset form
            setUsername('');
            setError(null);
            setIsAvailable(null);
        },
        onError: (err: any) => {
            const errorCode = err.response?.data?.error?.code;
            const errorMessage = err.response?.data?.error?.message;

            if (errorCode === 'CONFLICT' || err.response?.status === 409) {
                setError('This username is already taken');
                setIsAvailable(false);
            } else {
                setError(errorMessage || 'Failed to register username. Please try again.');
            }
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!username || error || !isAvailable || register.isPending) return;
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
                className="sm:max-w-md bg-card border-border/50 shadow-2xl"
                onPointerDownOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
            >
                <DialogHeader>
                    <div className="flex items-center justify-center mb-4">
                        <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                            className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center border border-primary/20"
                        >
                            <Sparkles className="h-10 w-10 text-primary" />
                        </motion.div>
                    </div>
                    <DialogTitle className="text-center text-2xl font-bold">
                        Welcome to HypeMint! 🚀
                    </DialogTitle>
                    <DialogDescription className="text-center text-base">
                        Choose a unique username to get started.
                        <br />
                        <span className="text-primary font-medium">This is how traders will find you.</span>
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-5 mt-6">
                    {/* Username Input */}
                    <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                            <User className="h-5 w-5" />
                        </div>
                        <Input
                            value={username}
                            onChange={(e) =>
                                setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                            }
                            placeholder="your_username"
                            className={cn(
                                'pl-12 pr-12 h-14 text-lg bg-muted/50 border-2 border-transparent',
                                'focus:border-primary/50 focus:bg-muted/80 transition-all',
                                'placeholder:text-muted-foreground/50',
                                error && 'border-destructive focus:border-destructive bg-destructive/5',
                                isAvailable && !error && username && 'border-primary/50 bg-primary/5'
                            )}
                            autoFocus
                            maxLength={32}
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                        />
                        {/* Status indicator */}
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            <AnimatePresence mode="wait">
                                {isChecking && (
                                    <motion.div
                                        key="checking"
                                        initial={{ opacity: 0, scale: 0.5 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.5 }}
                                    >
                                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                    </motion.div>
                                )}
                                {!isChecking && isAvailable && !error && username && (
                                    <motion.div
                                        key="available"
                                        initial={{ opacity: 0, scale: 0.5 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.5 }}
                                    >
                                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                                            <Check className="h-4 w-4 text-primary" />
                                        </div>
                                    </motion.div>
                                )}
                                {error && (
                                    <motion.div
                                        key="error"
                                        initial={{ opacity: 0, scale: 0.5 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.5 }}
                                    >
                                        <div className="w-6 h-6 rounded-full bg-destructive/20 flex items-center justify-center">
                                            <AlertCircle className="h-4 w-4 text-destructive" />
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Error/Help text */}
                    <div className="min-h-[24px]">
                        <AnimatePresence mode="wait">
                            {error ? (
                                <motion.p
                                    key="error"
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -5 }}
                                    className="text-sm text-destructive flex items-center gap-2"
                                >
                                    <AlertCircle className="h-4 w-4" />
                                    {error}
                                </motion.p>
                            ) : username && isAvailable ? (
                                <motion.p
                                    key="available"
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -5 }}
                                    className="text-sm text-primary flex items-center gap-2"
                                >
                                    <Check className="h-4 w-4" />
                                    <span className="font-medium">@{username}</span> is available!
                                </motion.p>
                            ) : (
                                <motion.p
                                    key="help"
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -5 }}
                                    className="text-sm text-muted-foreground"
                                >
                                    3-32 characters • letters, numbers, and underscores
                                </motion.p>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Submit Button */}
                    <Button
                        type="submit"
                        disabled={!username || !!error || !isAvailable || register.isPending}
                        className={cn(
                            'w-full h-14 text-lg font-semibold',
                            'bg-primary hover:bg-primary/90 text-primary-foreground',
                            'disabled:opacity-50 disabled:cursor-not-allowed',
                            'transition-all duration-200'
                        )}
                    >
                        {register.isPending ? (
                            <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Setting up your profile...
                            </>
                        ) : (
                            <>
                                <Sparkles className="mr-2 h-5 w-5" />
                                Let's Go!
                            </>
                        )}
                    </Button>
                </form>

                {/* Note */}
                <p className="text-xs text-muted-foreground text-center mt-4">
                    You can change your username anytime in profile settings
                </p>
            </DialogContent>
        </Dialog>
    );
}
