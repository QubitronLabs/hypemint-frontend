'use client';

/**
 * Avatar Generation Hook
 * 
 * Automatically generates and saves avatar for users who don't have one
 */

import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { generateAvatarUrl } from '@/lib/avatar';
import { updateMyProfile } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/auth';

/**
 * Hook that generates and saves avatar for user on first login
 * Only runs once per user when they don't have an avatar
 */
export function useAutoGenerateAvatar() {
    const { user, isAuthenticated, isUserFetched } = useAuth();
    const { updateUser } = useAuthStore();
    const hasAttemptedRef = useRef(false);

    useEffect(() => {
        // Only proceed if:
        // 1. User is authenticated
        // 2. User data has been fetched
        // 3. User exists
        // 4. User doesn't have an avatar
        // 5. We haven't attempted this before
        if (
            !isAuthenticated ||
            !isUserFetched ||
            !user ||
            user.avatarUrl ||
            hasAttemptedRef.current
        ) {
            return;
        }

        hasAttemptedRef.current = true;

        // Generate and save avatar
        const generateAndSaveAvatar = async () => {
            try {
                console.log('[Avatar] Generating avatar for user:', user.id);

                // Generate deterministic avatar URL based on user ID
                const avatarUrl = generateAvatarUrl(user.id, 'avataaars');

                // Save to backend
                const updatedUser = await updateMyProfile({ avatarUrl });

                // Update local store
                updateUser({ avatarUrl: updatedUser.avatarUrl });

                console.log('[Avatar] Avatar generated and saved successfully');
            } catch (error) {
                console.error('[Avatar] Failed to generate avatar:', error);
                // Reset flag so we can retry next time
                hasAttemptedRef.current = false;
            }
        };

        generateAndSaveAvatar();
    }, [isAuthenticated, isUserFetched, user, updateUser]);
}
