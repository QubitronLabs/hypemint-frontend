'use client';

/**
 * Error Boundary Component
 * Gracefully handles runtime errors in the application
 */

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface ErrorPageProps {
    error: Error & { digest?: string };
    reset: () => void;
}

export default function Error({ error, reset }: ErrorPageProps) {
    useEffect(() => {
        // Log the error to console (could send to monitoring service)
        console.error('Application error:', error);
    }, [error]);

    return (
        <div className="min-h-[80vh] flex items-center justify-center p-6">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-md w-full text-center"
            >
                {/* Error Icon */}
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-destructive/20 to-red-500/20 flex items-center justify-center">
                    <AlertTriangle className="h-10 w-10 text-destructive" />
                </div>

                {/* Error Message */}
                <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
                <p className="text-muted-foreground mb-6">
                    We encountered an unexpected error. Don&apos;t worry, your data is safe.
                </p>

                {/* Error Details (only in dev) */}
                {process.env.NODE_ENV === 'development' && (
                    <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-left">
                        <p className="text-sm font-mono text-destructive break-all">
                            {error.message}
                        </p>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button
                        onClick={reset}
                        className="gap-2 bg-gradient-to-r from-primary to-purple-600"
                    >
                        <RefreshCcw className="h-4 w-4" />
                        Try Again
                    </Button>
                    <Link href="/">
                        <Button variant="outline" className="gap-2 w-full">
                            <Home className="h-4 w-4" />
                            Go Home
                        </Button>
                    </Link>
                </div>
            </motion.div>
        </div>
    );
}
