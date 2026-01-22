"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCreateOrder } from "@/hooks/useOrders";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { OrderSide, TimeInForce } from "@/lib/api/orders";

interface LimitOrderFormProps {
  tokenId: string;
  tokenSymbol: string;
  currentPrice: string;
  className?: string;
}

export function LimitOrderForm({
  tokenId,
  tokenSymbol,
  currentPrice,
  className,
}: LimitOrderFormProps) {
  const { isAuthenticated } = useAuth();
  const createOrder = useCreateOrder();

  const [side, setSide] = useState<OrderSide>("buy");
  const [price, setPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [timeInForce, setTimeInForce] = useState<TimeInForce>("gtc");

  const currentPriceFormatted = (
    parseFloat(currentPrice || "0") / 1e18
  ).toFixed(6);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated) {
      toast.error("Please connect your wallet");
      return;
    }

    if (!price || !amount) {
      toast.error("Please enter price and amount");
      return;
    }

    try {
      const priceWei = (parseFloat(price) * 1e18).toString();
      const amountWei = (parseFloat(amount) * 1e18).toString();

      await createOrder.mutateAsync({
        tokenId,
        side,
        orderType: "limit",
        price: priceWei,
        amount: amountWei,
        timeInForce,
      });

      toast.success(`${side === "buy" ? "Buy" : "Sell"} order created!`);
      setPrice("");
      setAmount("");
    } catch (error) {
      toast.error("Failed to create order");
    }
  };

  const total =
    price && amount ? (parseFloat(price) * parseFloat(amount)).toFixed(6) : "0";

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Limit Order</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={side} onValueChange={(v) => setSide(v as OrderSide)}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger
              value="buy"
              className="data-[state=active]:bg-green-500 data-[state=active]:text-white"
            >
              Buy
            </TabsTrigger>
            <TabsTrigger
              value="sell"
              className="data-[state=active]:bg-red-500 data-[state=active]:text-white"
            >
              Sell
            </TabsTrigger>
          </TabsList>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Price</span>
                <button
                  type="button"
                  className="text-primary text-xs hover:underline"
                  onClick={() => setPrice(currentPriceFormatted)}
                >
                  Market: {currentPriceFormatted}
                </button>
              </div>
              <Input
                type="number"
                step="any"
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">
                Amount ({tokenSymbol})
              </label>
              <Input
                type="number"
                step="any"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">
                Time in Force
              </label>
              <div className="flex gap-1">
                {(["gtc", "ioc", "fok", "day"] as TimeInForce[]).map((tif) => (
                  <Button
                    key={tif}
                    type="button"
                    size="sm"
                    variant={timeInForce === tif ? "default" : "outline"}
                    onClick={() => setTimeInForce(tif)}
                    className="flex-1 text-xs"
                  >
                    {tif.toUpperCase()}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex justify-between text-sm py-2 border-t">
              <span className="text-muted-foreground">Total</span>
              <span className="font-mono font-medium">{total} SOL</span>
            </div>

            <Button
              type="submit"
              className={cn(
                "w-full",
                side === "buy"
                  ? "bg-green-500 hover:bg-green-600"
                  : "bg-red-500 hover:bg-red-600",
              )}
              disabled={createOrder.isPending || !isAuthenticated}
            >
              {createOrder.isPending
                ? "Creating..."
                : `${side === "buy" ? "Buy" : "Sell"} ${tokenSymbol}`}
            </Button>
          </form>
        </Tabs>
      </CardContent>
    </Card>
  );
}
