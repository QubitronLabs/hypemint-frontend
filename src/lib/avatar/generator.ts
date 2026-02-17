/**
 * Avatar Generation Utility
 * 
 * Generates deterministic cartoon avatars using DiceBear
 * Same user ID = Same avatar (forever)
 */

import { createAvatar } from '@dicebear/core';
import { bottts, avataaars, funEmoji, lorelei, notionists } from '@dicebear/collection';

export type AvatarStyle = 'bottts' | 'avataaars' | 'funEmoji' | 'lorelei' | 'notionists';

/**
 * Generate a deterministic avatar based on user ID
 * 
 * @param userId - User's unique identifier (same ID = same avatar)
 * @param style - Avatar style (default: 'avataaars')
 * @returns SVG string of the generated avatar
 */
export function generateAvatar(
    userId: string,
    style: AvatarStyle = 'avataaars'
): string {
    // Create avatar based on style - using individual cases to satisfy TypeScript
    let avatar;
    switch (style) {
        case 'bottts':
            avatar = createAvatar(bottts, { seed: userId, size: 128 });
            break;
        case 'funEmoji':
            avatar = createAvatar(funEmoji, { seed: userId, size: 128 });
            break;
        case 'lorelei':
            avatar = createAvatar(lorelei, { seed: userId, size: 128 });
            break;
        case 'notionists':
            avatar = createAvatar(notionists, { seed: userId, size: 128 });
            break;
        case 'avataaars':
        default:
            avatar = createAvatar(avataaars, { seed: userId, size: 128 });
            break;
    }

    return avatar.toString();
}

/**
 * Generate avatar as Data URL (for img src)
 * 
 * @param userId - User's unique identifier
 * @param style - Avatar style
 * @returns Data URL that can be used in img src
 */
export function generateAvatarDataUrl(
    userId: string,
    style: AvatarStyle = 'avataaars'
): string {
    const svg = generateAvatar(userId, style);
    const base64 = Buffer.from(svg).toString('base64');
    return `data:image/svg+xml;base64,${base64}`;
}

/**
 * Generate avatar as URL (using DiceBear's CDN)
 * This is more efficient as it doesn't require generating the SVG client-side
 * 
 * @param userId - User's unique identifier
 * @param style - Avatar style
 * @returns URL to DiceBear CDN
 */
export function generateAvatarUrl(
    userId: string,
    style: AvatarStyle = 'avataaars'
): string {
    // Encode the seed to handle special characters
    const encodedSeed = encodeURIComponent(userId);
    return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodedSeed}`;
}

/**
 * Get a user's avatar URL
 * If they have a custom avatarUrl, use that
 * Otherwise, generate a deterministic avatar based on their ID
 * 
 * @param userId - User's unique identifier
 * @param existingAvatarUrl - User's existing avatar URL (if any)
 * @param style - Avatar style for generated avatars
 * @returns Avatar URL
 */
export function getUserAvatarUrl(
    userId: string,
    existingAvatarUrl?: string | null,
    style: AvatarStyle = 'avataaars'
): string {
    if (existingAvatarUrl) {
        return existingAvatarUrl;
    }
    return generateAvatarUrl(userId, style);
}
