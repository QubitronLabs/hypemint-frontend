"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Home,
  Video,
  Terminal,
  User,
  HelpCircle,
  Plus,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { icon: Home, label: "Home", href: "/" },
  { icon: TrendingUp, label: "Trending", href: "/trending", disabled: true },
  { icon: Video, label: "Live", href: "/livestreams", disabled: true },
  { icon: Terminal, label: "Terminal", href: "/terminal", disabled: true },
  { icon: User, label: "Profile", href: "/profile" },
  { icon: HelpCircle, label: "Help", href: "/support", disabled: true },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-full w-[70px] bg-card/80 backdrop-blur-xl border-r border-border/50 flex flex-col">
      {/* Logo */}
      <Link
        href="/"
        className="flex items-center justify-center h-16 border-b border-border/50"
      >
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/20"
        >
          <span className="text-primary-foreground font-bold text-lg">H</span>
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
              href={item.disabled ? "#" : item.href}
              className={cn(
                "relative flex flex-col items-center justify-center py-3 rounded-xl transition-all duration-200",
                isActive
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                item.disabled && "opacity-40 cursor-not-allowed",
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="active-indicator"
                  className="absolute left-0 w-1 h-6 bg-primary rounded-r-full"
                  initial={false}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                />
              )}
              <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <Icon className="h-5 w-5" />
              </motion.div>
              <span className="text-[10px] mt-1.5 font-medium">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Create Button */}
      <div className="p-3 border-t border-border/50">
        <Link href="/create">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              className="w-full h-12 bg-gradient-to-br from-primary to-purple-600 hover:opacity-90 flex flex-col items-center justify-center gap-0.5 px-0 rounded-xl shadow-lg shadow-primary/20"
              size="sm"
            >
              <Plus className="h-5 w-5" />
              <span className="text-[9px] font-medium">Create</span>
            </Button>
          </motion.div>
        </Link>
      </div>
    </aside>
  );
}
