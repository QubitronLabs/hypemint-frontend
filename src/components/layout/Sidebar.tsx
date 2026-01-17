'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    Home,
    Video,
    Terminal,
    User,
    HelpCircle,
    Plus,
    TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const navItems = [
    { icon: Home, label: 'Home', href: '/' },
    { icon: TrendingUp, label: 'Trending', href: '/trending', disabled: true },
    { icon: Video, label: 'Live', href: '/livestreams', disabled: true },
    { icon: Terminal, label: 'Terminal', href: '/terminal', disabled: true },
    { icon: User, label: 'Profile', href: '/profile' },
    { icon: HelpCircle, label: 'Help', href: '/support', disabled: true },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="fixed left-0 top-0 z-40 h-full w-16 bg-card border-r border-border flex flex-col">
            {/* Logo */}
            <Link
                href="/"
                className="flex items-center justify-center h-14 border-b border-border"
            >
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                    <span className="text-primary-foreground font-bold text-sm">H</span>
                </div>
            </Link>

            {/* Navigation */}
            <nav className="flex-1 py-4 px-2 space-y-1">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            href={item.disabled ? '#' : item.href}
                            className={cn(
                                'relative flex flex-col items-center justify-center py-2.5 rounded-lg transition-colors',
                                isActive
                                    ? 'text-primary bg-primary/10'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                                item.disabled && 'opacity-40 cursor-not-allowed'
                            )}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="active-indicator"
                                    className="absolute left-0 w-0.5 h-6 bg-primary rounded-r"
                                    initial={false}
                                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                />
                            )}
                            <Icon className="h-5 w-5" />
                            <span className="text-[10px] mt-1">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Create Button */}
            <div className="p-2 border-t border-border">
                <Link href="/create">
                    <Button
                        className="w-full h-10 bg-primary hover:bg-primary/90 flex flex-col items-center justify-center gap-0.5 px-0"
                        size="sm"
                    >
                        <Plus className="h-4 w-4" />
                        <span className="text-[9px]">Create</span>
                    </Button>
                </Link>
            </div>
        </aside>
    );
}
