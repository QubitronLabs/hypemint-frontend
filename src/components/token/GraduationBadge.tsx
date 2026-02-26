"use client";

import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

interface GraduationBadgeProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

/**
 * GraduationBadge — shows a graduated indicator on token cards/detail pages.
 *
 * Already used inline in TokenCard + TokenListItem; this gives a reusable
 * version with configurable size.
 */
export function GraduationBadge({
  className,
  size = "sm",
  showLabel = true,
}: GraduationBadgeProps) {
  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };
  const textClasses = {
    sm: "text-[10px]",
    md: "text-xs",
    lg: "text-sm",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-amber-400 font-semibold",
        textClasses[size],
        className,
      )}
    >
      <GraduationCap className={sizeClasses[size]} />
      {showLabel && <span>GRADUATED</span>}
    </span>
  );
}
