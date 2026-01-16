'use client';

import { useEffect, type ReactNode } from 'react';
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
 */
export function UsernamePromptProvider({ children }: UsernamePromptProviderProps) {
    const isLoggedIn = useIsLoggedIn();
    const { data: user, isLoading } = useCurrentUser();
    const { isOpen, open } = useUsernamePromptStore();

    // Check if we need to show the username prompt
    useEffect(() => {
        // Only check if:
        // 1. User is logged in
        // 2. User data is loaded
        // 3. Modal is not already open
        // 4. User doesn't have a username
        if (
            isLoggedIn &&
            !isLoading &&
            user &&
            !user.username &&
            !isOpen
        ) {
            // Small delay to let the page load first
            const timer = setTimeout(() => {
                open();
            }, 500);

            return () => clearTimeout(timer);
        }
    }, [isLoggedIn, isLoading, user, isOpen, open]);

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
    const { open } = useUsernamePromptStore();

    /**
     * Check if username is set, if not show prompt
     * @returns true if username is set, false if prompt was shown
     */
    const requireUsername = (onSuccess?: () => void): boolean => {
        if (user?.username) {
            return true;
        }
        open(onSuccess);
        return false;
    };

    return {
        hasUsername: !!user?.username,
        requireUsername
    };
}
