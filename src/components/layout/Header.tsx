'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Plus, Command } from 'lucide-react';
import { DynamicWidget } from '@dynamic-labs/sdk-react-core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function Header() {
    const [searchFocused, setSearchFocused] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const searchRef = useRef<HTMLInputElement>(null);

    // Keyboard shortcut for search
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                searchRef.current?.focus();
            }
            if (e.key === 'Escape') {
                searchRef.current?.blur();
                setSearchQuery('');
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <header className="fixed top-0 left-16 right-0 z-30 h-14 bg-card border-b border-border">
            <div className="flex items-center justify-between h-full px-4">
                {/* Search */}
                <div className="flex-1 max-w-md">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            ref={searchRef}
                            type="search"
                            placeholder="Search tokens..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => setSearchFocused(true)}
                            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                            className={cn(
                                'pl-10 pr-16 h-9 bg-muted border-transparent',
                                'focus:border-primary/50'
                            )}
                        />

                        {searchQuery ? (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        ) : (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-muted-foreground/50">
                                <kbd className="flex items-center text-[10px] bg-background px-1.5 py-0.5 rounded border border-border">
                                    <Command className="h-2.5 w-2.5" />K
                                </kbd>
                            </div>
                        )}

                        {/* Search Dropdown */}
                        <AnimatePresence>
                            {searchFocused && searchQuery && (
                                <motion.div
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 4 }}
                                    className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg p-3"
                                >
                                    <div className="flex items-center justify-center py-4">
                                        <p className="text-sm text-muted-foreground">
                                            Searching for "{searchQuery}"...
                                        </p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                    {/* Network */}
                    <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full pulse-live" />
                        Solana
                    </div>

                    {/* Create Button */}
                    <Link href="/create">
                        <Button size="sm" className="gap-1.5 bg-primary hover:bg-primary/90">
                            <Plus className="h-4 w-4" />
                            <span className="hidden sm:inline">Create</span>
                        </Button>
                    </Link>

                    {/* Wallet */}
                    <div className="[&_button]:!h-9 [&_button]:!rounded-lg [&_button]:!border-border [&_button]:!bg-muted">
                        <DynamicWidget />
                    </div>
                </div>
            </div>
        </header>
    );
}
