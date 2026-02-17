'use client';

/**
 * UserAvatar Component
 * 
 * Displays user avatars with fallback to generated avatars
 * Uses DiceBear to generate consistent avatars based on user ID
 */

import { useMemo } from 'react';
import { getUserAvatarUrl, type AvatarStyle } from '@/lib/avatar';
import { cn } from '@/lib/utils';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

export interface UserAvatarProps {
    /** User's unique identifier (used for generating avatar) */
    userId: string;
    /** User's existing avatar URL (if any) */
    avatarUrl?: string | null;
    /** Username for alt text and fallback */
    username?: string;
    /** Avatar style (only used if no avatarUrl provided) */
    style?: AvatarStyle;
    /** Additional className */
    className?: string;
    /** Size className (e.g., 'size-10', 'size-12') */
    sizeClassName?: string;
}

export function UserAvatar({
    userId,
    avatarUrl,
    username,
    style = 'avataaars',
    className,
    sizeClassName = 'size-10',
}: UserAvatarProps) {
    // Generate avatar URL deterministically based on user ID
    const finalAvatarUrl = useMemo(
        () => getUserAvatarUrl(userId, avatarUrl, style),
        [userId, avatarUrl, style]
    );

    const altText = username ? `${username}'s avatar` : 'User avatar';
    
    // Fallback: first letter of username or '?'
    const fallbackText = username ? username.charAt(0).toUpperCase() : '?';

    return (
        <Avatar className={cn(sizeClassName, className)}>
            <AvatarImage 
                src={finalAvatarUrl} 
                alt={altText}
            />
            <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {fallbackText}
            </AvatarFallback>
        </Avatar>
    );
}

/**
 * Avatar group component for showing multiple avatars
 */
export interface UserAvatarGroupProps {
    /** Array of users to show avatars for */
    users: Array<{
        id: string;
        avatarUrl?: string | null;
        username?: string;
    }>;
    /** Maximum number of avatars to show */
    max?: number;
    /** Avatar style */
    style?: AvatarStyle;
    /** Additional className */
    className?: string;
    /** Size className */
    sizeClassName?: string;
}

export function UserAvatarGroup({
    users,
    max = 5,
    style = 'avataaars',
    className,
    sizeClassName = 'size-8',
}: UserAvatarGroupProps) {
    const displayUsers = users.slice(0, max);
    const remaining = users.length - max;

    return (
        <div className={cn('flex -space-x-2', className)}>
            {displayUsers.map((user) => (
                <UserAvatar
                    key={user.id}
                    userId={user.id}
                    avatarUrl={user.avatarUrl}
                    username={user.username}
                    style={style}
                    sizeClassName={sizeClassName}
                    className="border-2 border-background"
                />
            ))}
            {remaining > 0 && (
                <div
                    className={cn(
                        'flex items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground border-2 border-background',
                        sizeClassName
                    )}
                >
                    +{remaining}
                </div>
            )}
        </div>
    );
}
