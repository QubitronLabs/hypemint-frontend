'use client';

/**
 * Global Loading Component
 * Displayed during route transitions
 */

import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

export default function Loading() {
    return (
        <div className="min-h-[80vh] flex items-center justify-center">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center gap-4"
            >
                {/* Logo animation */}
                <div className="relative">
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                        className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center"
                    >
                        <span className="text-2xl font-bold text-white">H</span>
                    </motion.div>
                    <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/30 to-purple-600/30 blur-xl"
                    />
                </div>

                <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Loading...</span>
                </div>
            </motion.div>
        </div>
    );
}
