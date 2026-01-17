'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useIsLoggedIn } from '@dynamic-labs/sdk-react-core';
import { UsernamePromptModal } from '@/components/modals';
import { useUsernamePromptStore } from '@/lib/username-prompt';
import { useCurrentUser } from '@/hooks';

interface UsernamePromptProviderProps {
    children: ReactNode;
}

/**
 * Username Prompt Provider
 *
 * Automatically checks if authenticated user has a username set.
 * If not, shows the username prompt modal.
 *
 * The modal is NON-SKIPPABLE - username is required to use the platform.
 * 
 * IMPORTANT: Only shows once per session after user data is fetched.
 */
export function UsernamePromptProvider({ children }: UsernamePromptProviderProps) {
    const isLoggedIn = useIsLoggedIn();
    const { data: user, isLoading, isFetched } = useCurrentUser();
    const { isOpen, hasSetUsername, open } = useUsernamePromptStore();

    // Track if we've already checked in this mount
    const hasCheckedRef = useRef(false);

    // Check if we need to show the username prompt
    useEffect(() => {
        // Skip if:
        // - Already checking/checked
        // - Not logged in
        // - Still loading user data
        // - User hasn't been fetched yet
        // - Modal is already open
        // - Username was set in this session
        if (
            hasCheckedRef.current ||
            !isLoggedIn ||
            isLoading ||
            !isFetched ||
            isOpen ||
            hasSetUsername
        ) {
            return;
        }

        // Only check once per mount
        hasCheckedRef.current = true;

        // If user exists but has no username, show the prompt
        if (user && !user.username) {
            console.log('[UsernamePrompt] User has no username, showing prompt');
            // Small delay to let the page load first
            const timer = setTimeout(() => {
                open();
            }, 800);

            return () => clearTimeout(timer);
        }
    }, [isLoggedIn, isLoading, isFetched, user, isOpen, hasSetUsername, open]);

    // Reset check when user logs out
    useEffect(() => {
        if (!isLoggedIn) {
            hasCheckedRef.current = false;
        }
    }, [isLoggedIn]);

    return (
        <>
            {children}
            <UsernamePromptModal />
        </>
    );
}

/**
 * Hook to trigger username prompt manually
 * Use this when you need username to be set before an action
 */
export function useRequireUsername() {
    const { data: user } = useCurrentUser();
    const { open, hasSetUsername } = useUsernamePromptStore();

    /**
     * Check if username is set, if not show prompt
     * @returns true if username is set, false if prompt was shown
     */
    const requireUsername = (onSuccess?: () => void): boolean => {
        if (user?.username || hasSetUsername) {
            return true;
        }
        open(onSuccess);
        return false;
    };

    return {
        hasUsername: !!user?.username || hasSetUsername,
        requireUsername,
    };
}
