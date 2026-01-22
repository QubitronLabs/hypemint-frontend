"use client";

import { useState } from "react";
import { Bell, BellRing, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCreateAlert } from "@/hooks/useAlerts";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { AlertCondition } from "@/lib/api/alerts";

interface AlertButtonProps {
  tokenId: string;
  tokenSymbol: string;
  currentPrice: string;
  className?: string;
}

export function AlertButton({
  tokenId,
  tokenSymbol,
  currentPrice,
  className,
}: AlertButtonProps) {
  const { isAuthenticated } = useAuth();
  const createAlert = useCreateAlert();
  const [open, setOpen] = useState(false);
  const [condition, setCondition] = useState<AlertCondition>("above");
  const [targetPrice, setTargetPrice] = useState("");
  const [note, setNote] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!targetPrice) {
      toast.error("Please enter a target price");
      return;
    }

    try {
      // Convert to wei
      const priceWei = (parseFloat(targetPrice) * 1e18).toString();

      await createAlert.mutateAsync({
        tokenId,
        condition,
        targetPrice: priceWei,
        note: note || undefined,
      });

      toast.success("Alert created!");
      setOpen(false);
      setTargetPrice("");
      setNote("");
    } catch (error) {
      toast.error("Failed to create alert");
    }
  };

  if (!isAuthenticated) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={className}
        onClick={() =>
          toast.error("Please connect your wallet to create alerts")
        }
      >
        <Bell className="h-4 w-4 text-muted-foreground" />
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("group", className)}>
          <Bell className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5" />
            Create Price Alert
          </DialogTitle>
          <DialogDescription>
            Get notified when {tokenSymbol} reaches your target price
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Current price: ${(parseFloat(currentPrice) / 1e18).toFixed(6)}
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant={condition === "above" ? "default" : "outline"}
              onClick={() => setCondition("above")}
              className="flex-1"
            >
              Price Above
            </Button>
            <Button
              type="button"
              variant={condition === "below" ? "default" : "outline"}
              onClick={() => setCondition("below")}
              className="flex-1"
            >
              Price Below
            </Button>
          </div>

          <Input
            type="number"
            step="any"
            placeholder="Target price (e.g., 0.001)"
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
            className="font-mono"
          />

          <Input
            type="text"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createAlert.isPending}>
              {createAlert.isPending ? "Creating..." : "Create Alert"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
