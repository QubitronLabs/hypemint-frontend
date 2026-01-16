'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Search, X, Sparkles, Plus } from 'lucide-react';
import { DynamicWidget } from '@dynamic-labs/sdk-react-core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function Header() {
    const [searchFocused, setSearchFocused] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    return (
        <header className="fixed top-0 left-[70px] right-0 z-30 h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center justify-between h-full px-4">
                {/* Logo - hidden on desktop since we have sidebar */}
                <Link href="/" className="flex items-center gap-2 lg:hidden">
                    <Sparkles className="h-6 w-6 text-primary" />
                    <span className="font-bold text-lg">HypeMint</span>
                </Link>

                {/* Search */}
                <div className="flex-1 max-w-md mx-4">
                    <motion.div
                        animate={{
                            scale: searchFocused ? 1.02 : 1,
                            boxShadow: searchFocused
                                ? '0 0 0 2px rgba(0, 255, 136, 0.3)'
                                : '0 0 0 0px rgba(0, 255, 136, 0)'
                        }}
                        className="relative"
                    >
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => setSearchFocused(true)}
                            onBlur={() => setSearchFocused(false)}
                            className={cn(
                                'pl-10 pr-10 bg-card border-border h-10',
                                'placeholder:text-muted-foreground',
                                'focus:border-primary/50 focus:ring-primary/20',
                                'transition-all duration-200'
                            )}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                        {/* Keyboard shortcut hint */}
                        {!searchQuery && !searchFocused && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <kbd className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border">
                                    ⌘ K
                                </kbd>
                            </div>
                        )}
                    </motion.div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                    {/* Create Coin Button */}
                    <Link href="/create">
                        <Button
                            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-2"
                            size="sm"
                        >
                            <Plus className="h-4 w-4" />
                            <span className="hidden sm:inline">Create coin</span>
                        </Button>
                    </Link>

                    {/* Wallet Connect - Dynamic.xyz Widget */}
                    <DynamicWidget />
                </div>
            </div>
        </header>
    );
}
