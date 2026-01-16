'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    Home,
    Video,
    Terminal,
    MessageCircle,
    User,
    HelpCircle,
    MoreHorizontal,
    Plus,
    Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const navItems = [
    { icon: Home, label: 'Home', href: '/' },
    { icon: Video, label: 'Livestreams', href: '/livestreams', disabled: true },
    { icon: Terminal, label: 'Terminal', href: '/terminal', disabled: true },
    { icon: MessageCircle, label: 'Chat', href: '/chat', disabled: true },
    { icon: User, label: 'Profile', href: '/profile' },
    { icon: HelpCircle, label: 'Support', href: '/support', disabled: true },
    { icon: MoreHorizontal, label: 'More', href: '/more', disabled: true },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="fixed left-0 top-0 z-40 h-full w-[70px] border-r border-border bg-sidebar flex flex-col">
            {/* Logo */}
            <Link
                href="/"
                className="flex items-center justify-center h-16 border-b border-border"
            >
                <motion.div
                    whileHover={{ scale: 1.05 }}
                    className="flex items-center gap-2"
                >
                    <Sparkles className="h-6 w-6 text-primary" />
                </motion.div>
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
                                'flex flex-col items-center justify-center py-3 rounded-lg transition-colors relative group',
                                isActive
                                    ? 'bg-sidebar-accent text-primary'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50',
                                item.disabled && 'opacity-50 cursor-not-allowed'
                            )}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="active-nav"
                                    className="absolute left-0 w-1 h-8 bg-primary rounded-r-full"
                                    initial={false}
                                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                />
                            )}
                            <Icon className="h-5 w-5 mb-1" />
                            <span className="text-[10px] font-medium">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Create Coin CTA */}
            <div className="p-2 border-t border-border">
                <Link href="/create">
                    <Button
                        className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                        size="sm"
                    >
                        <Plus className="h-4 w-4 mr-1" />
                        <span className="text-xs">Create</span>
                    </Button>
                </Link>
            </div>

            {/* App download / QR placeholder */}
            <div className="p-2 pb-4">
                <div className="bg-card border border-border rounded-lg p-2 text-center">
                    <div className="text-[10px] text-muted-foreground">Pump app</div>
                    <div className="w-10 h-10 mx-auto mt-1 bg-muted rounded" />
                    <div className="text-[8px] text-muted-foreground mt-1">Scan to download</div>
                </div>
            </div>
        </aside>
    );
}
