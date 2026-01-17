'use client';

/**
 * Not Found Page
 * Displayed when a route doesn't exist
 */

import { motion } from 'framer-motion';
import { Search, Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="min-h-[80vh] flex items-center justify-center p-6">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-md w-full text-center"
            >
                {/* 404 Icon */}
                <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
                    <span className="text-4xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                        404
                    </span>
                </div>

                {/* Message */}
                <h1 className="text-2xl font-bold mb-2">Page Not Found</h1>
                <p className="text-muted-foreground mb-6">
                    The page you&apos;re looking for doesn&apos;t exist or has been moved.
                </p>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link href="/">
                        <Button className="gap-2 w-full bg-gradient-to-r from-primary to-purple-600">
                            <Home className="h-4 w-4" />
                            Go Home
                        </Button>
                    </Link>
                    <Button
                        variant="outline"
                        className="gap-2"
                        onClick={() => window.history.back()}
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Go Back
                    </Button>
                </div>
            </motion.div>
        </div>
    );
}
