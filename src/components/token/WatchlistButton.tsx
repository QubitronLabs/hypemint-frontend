"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useIsInWatchlist, useToggleWatchlist } from "@/hooks/useWatchlist";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface WatchlistButtonProps {
  tokenId: string;
  className?: string;
  size?: "sm" | "default" | "lg" | "icon";
}

export function WatchlistButton({
  tokenId,
  className,
  size = "icon",
}: WatchlistButtonProps) {
  const { isAuthenticated } = useAuth();
  const { data: isInWatchlist, isLoading: checkLoading } =
    useIsInWatchlist(tokenId);
  const { toggle, isLoading: toggleLoading } = useToggleWatchlist();

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      toast.error("Please connect your wallet to add tokens to watchlist");
      return;
    }

    try {
      await toggle(tokenId, isInWatchlist ?? false);
      toast.success(
        isInWatchlist ? "Removed from watchlist" : "Added to watchlist",
      );
    } catch (error) {
      toast.error("Failed to update watchlist");
    }
  };

  const isLoading = checkLoading || toggleLoading;

  return (
    <Button
      variant="ghost"
      size={size}
      className={cn("group", className)}
      onClick={handleClick}
      disabled={isLoading}
      title={isInWatchlist ? "Remove from watchlist" : "Add to watchlist"}
    >
      <Star
        className={cn(
          "h-4 w-4 transition-colors",
          isInWatchlist
            ? "fill-yellow-400 text-yellow-400"
            : "text-muted-foreground group-hover:text-yellow-400",
        )}
      />
    </Button>
  );
}
