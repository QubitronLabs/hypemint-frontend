'use client';

import { create } from 'zustand';

interface UsernamePromptState {
    // Is the popup open
    isOpen: boolean;
    // Callback after username is set
    onSuccess?: () => void;

    // Actions
    open: (onSuccess?: () => void) => void;
    close: () => void;
    reset: () => void;
}

/**
 * Global Username Prompt Store
 * 
 * Manages the state of the "Set Username" popup.
 * Used when a user is authenticated but hasn't set their username yet.
 * 
 * Note: This popup is NON-SKIPPABLE. User must set username to continue.
 */
export const useUsernamePromptStore = create<UsernamePromptState>((set) => ({
    isOpen: false,
    onSuccess: undefined,

    open: (onSuccess) => set({ isOpen: true, onSuccess }),
    close: () => set({ isOpen: false, onSuccess: undefined }),
    reset: () => set({ isOpen: false, onSuccess: undefined }),
}));
