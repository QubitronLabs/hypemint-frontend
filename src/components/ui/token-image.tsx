"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Coins } from "lucide-react";

interface TokenImageProps {
  src?: string | null;
  alt: string;
  symbol?: string;
  size?: number;
  className?: string;
}

/**
 * TokenImage Component
 * A reusable image component for token avatars that:
 * - Handles loading errors gracefully
 * - Shows a fallback with token symbol if image fails
 * - Properly handles different image URL formats
 */
export function TokenImage({
  src,
  alt,
  symbol,
  size = 40,
  className,
}: TokenImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Normalize the image URL
  const getImageUrl = (url?: string | null): string | null => {
    if (!url) return null;

    // Already a full URL
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }

    // Relative path starting with /uploads
    if (url.startsWith("/uploads")) {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      return `${apiUrl}${url}`;
    }

    // Other relative paths
    if (url.startsWith("/")) {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      return `${apiUrl}${url}`;
    }

    return url;
  };

  const imageUrl = getImageUrl(src);
  const showFallback = !imageUrl || hasError;

  if (showFallback) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-gradient-to-br from-primary/20 to-purple-500/20 rounded-lg",
          className,
        )}
        style={{ width: size, height: size }}
      >
        {symbol ? (
          <span
            className="font-bold text-muted-foreground"
            style={{ fontSize: size * 0.35 }}
          >
            {symbol.slice(0, 2)}
          </span>
        ) : (
          <Coins
            className="text-muted-foreground"
            style={{ width: size * 0.5, height: size * 0.5 }}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className={cn("relative overflow-hidden rounded-lg bg-muted", className)}
      style={{ width: size, height: size }}
    >
      {isLoading && <div className="absolute inset-0 bg-muted animate-pulse" />}
      <Image
        src={imageUrl}
        alt={alt}
        width={size}
        height={size}
        className={cn(
          "object-cover w-full h-full transition-opacity",
          isLoading ? "opacity-0" : "opacity-100",
        )}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
        unoptimized
      />
    </div>
  );
}
