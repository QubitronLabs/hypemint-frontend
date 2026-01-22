"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Plus, Command } from "lucide-react";
import { DynamicWidget } from "@dynamic-labs/sdk-react-core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function Header() {
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        searchRef.current?.blur();
        setSearchQuery("");
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <header className="fixed top-0 left-[70px] right-0 z-30 h-16 bg-card/80 backdrop-blur-xl border-b border-border/50">
      <div className="flex items-center justify-between h-full px-6">
        {/* Search */}
        <div className="flex-1 max-w-lg">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchRef}
              type="search"
              placeholder="Search tokens..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              className={cn(
                "pl-11 pr-16 h-11 bg-muted/50 border-border/50 rounded-xl",
                "focus:border-primary/50 focus:bg-muted/80 transition-all duration-200",
              )}
            />

            {searchQuery ? (
              <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </motion.button>
            ) : (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-muted-foreground/50">
                <kbd className="flex items-center text-[10px] bg-background/80 px-1.5 py-0.5 rounded-md border border-border/50">
                  <Command className="h-2.5 w-2.5" />K
                </kbd>
              </div>
            )}

            {/* Search Dropdown */}
            <AnimatePresence>
              {searchFocused && searchQuery && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl p-4"
                >
                  <div className="flex items-center justify-center py-6">
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
        <div className="flex items-center gap-4">
          {/* Network */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="hidden md:flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-xl border border-border/50"
          >
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            <span className="font-medium">Polygon</span>
          </motion.div>

          {/* Create Button */}
          <Link href="/create">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                size="sm"
                className="gap-2 h-10 px-4 bg-gradient-to-r from-primary to-purple-600 hover:opacity-90 rounded-xl shadow-lg shadow-primary/20"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline font-medium">Create</span>
              </Button>
            </motion.div>
          </Link>

          {/* Wallet */}
          <div className="[&_button]:!h-10 [&_button]:!rounded-xl [&_button]:!border-border/50 [&_button]:!bg-muted/50">
            <DynamicWidget />
          </div>
        </div>
      </div>
    </header>
  );
}
