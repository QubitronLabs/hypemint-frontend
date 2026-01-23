"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount } from "wagmi";
import { formatEther } from "viem";
import {
  Upload,
  Globe,
  Twitter,
  MessageCircle,
  Loader2,
  AlertCircle,
  Rocket,
  X,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Zap,
  TrendingUp,
  Users,
  Coins,
  Clock,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks";
import {
  useCreateTokenOnChain,
  useCreationFee,
  useNativeBalance,
} from "@/hooks";
import { useCreateToken } from "@/hooks/useTokens";
import { getTxUrl } from "@/lib/wagmi";
import { toast } from "sonner";

// Real-time Preview Card Component
interface TokenPreviewProps {
  name: string;
  symbol: string;
  description: string;
  imagePreview: string | null;
  hypeBoostEnabled: boolean;
  websiteUrl: string;
  twitterUrl: string;
  telegramUrl: string;
}

function TokenPreviewCard({
  name,
  symbol,
  description,
  imagePreview,
  hypeBoostEnabled,
  websiteUrl,
  twitterUrl,
  telegramUrl,
}: TokenPreviewProps) {
  const hasSocialLinks = websiteUrl || twitterUrl || telegramUrl;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="sticky top-24 bg-card border border-border rounded-2xl overflow-hidden"
    >
      {/* Preview Header */}
      <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Live Preview</span>
        </div>
      </div>

      {/* Token Card Preview */}
      <div className="p-4">
        <div className="bg-background border border-border rounded-xl p-4 hover:border-primary/50 transition-all">
          {/* Token Header */}
          <div className="flex items-start gap-3 mb-3">
            <div className="relative">
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt={name || "Token"}
                  className="w-12 h-12 rounded-xl object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
                  <Coins className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              {hypeBoostEnabled && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                  <Zap className="h-3 w-3 text-white" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">{name || "Token Name"}</h3>
              <p className="text-sm text-muted-foreground font-mono">
                ${symbol || "SYMBOL"}
              </p>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
            {description || "Your token description will appear here..."}
          </p>

          {/* Simulated Stats */}
          <div className="grid grid-cols-3 gap-2 text-center mb-3">
            <div className="bg-muted/50 rounded-lg p-2">
              <p className="text-xs text-muted-foreground">Price</p>
              <p className="text-sm font-mono font-medium text-green-500">
                $0.0001
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2">
              <p className="text-xs text-muted-foreground">Market Cap</p>
              <p className="text-sm font-mono font-medium">$100K</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2">
              <p className="text-xs text-muted-foreground">Holders</p>
              <p className="text-sm font-mono font-medium">1</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Bonding Progress</span>
              <span>0%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary to-purple-500 w-0 transition-all" />
            </div>
          </div>

          {/* Social Links Preview */}
          {hasSocialLinks && (
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              {websiteUrl && (
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}
              {twitterUrl && (
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                  <Twitter className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}
              {telegramUrl && (
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                  <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Additional Info */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>Token will be live immediately after creation</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>Anyone can trade on the bonding curve</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Price increases with each purchase</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// API base URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function TokenCreationForm() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { address, isConnected } = useAccount();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Contract hooks
  const {
    createToken: createTokenOnChain,
    isCreating,
    isConfirming,
    txHash,
    error: contractError,
  } = useCreateTokenOnChain();
  const { data: creationFee } = useCreationFee();
  const { data: balance } = useNativeBalance();

  // Backend API hook
  const createTokenApi = useCreateToken();

  // Form state
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [telegramUrl, setTelegramUrl] = useState("");

  // HypeBoost toggle
  const [hypeBoostEnabled, setHypeBoostEnabled] = useState(true);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);

  // Drag and drop
  const [isDragging, setIsDragging] = useState(false);

  // Symbol validation state
  const [isCheckingSymbol, setIsCheckingSymbol] = useState(false);
  const [symbolAvailable, setSymbolAvailable] = useState<boolean | null>(null);
  const [symbolError, setSymbolError] = useState<string | null>(null);

  // Debounced symbol for API check
  const debouncedSymbol = useDebounce(symbol, 500);

  // Check symbol availability
  useEffect(() => {
    async function checkSymbol() {
      if (!debouncedSymbol || debouncedSymbol.length < 2) {
        setSymbolAvailable(null);
        setSymbolError(null);
        return;
      }

      setIsCheckingSymbol(true);
      try {
        const response = await fetch(
          `${API_URL}/api/v1/tokens/check-symbol/${debouncedSymbol.toUpperCase()}`,
        );
        const result = await response.json();

        if (result.success) {
          setSymbolAvailable(result.data.available);
          setSymbolError(result.data.available ? null : result.data.reason);
        }
      } catch (error) {
        console.error("Failed to check symbol:", error);
      } finally {
        setIsCheckingSymbol(false);
      }
    }

    checkSymbol();
  }, [debouncedSymbol]);

  // Validation
  const isFormValid =
    name.length >= 2 &&
    symbol.length >= 2 &&
    symbol.length <= 10 &&
    symbolAvailable !== false;

  // Check balance
  const fee = creationFee || BigInt("10000000000000000");
  const hasEnoughBalance = balance?.value ? balance.value >= fee : false;

  // Handle image upload
  const handleImageUpload = (file: File) => {
    if (file && file.type.startsWith("image/")) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image must be less than 5MB");
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleImageUpload(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageUrl("");
  };

  // Upload image to backend
  const uploadImage = useCallback(async (): Promise<string | null> => {
    if (!imageFile) return imageUrl || null;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", imageFile);

      const response = await fetch(`${API_URL}/api/v1/uploads/image`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (result.success) {
        setImageUrl(result.data.url);
        return result.data.url;
      } else {
        toast.error("Failed to upload image");
        return null;
      }
    } catch (error) {
      console.error("Image upload error:", error);
      toast.error("Failed to upload image");
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [imageFile, imageUrl]);

  // Submit
  const handleSubmit = async () => {
    if (!isFormValid || !isConnected) return;

    try {
      // Upload image if needed
      let finalImageUrl = imageUrl;
      if (imageFile && !imageUrl) {
        const uploadedUrl = await uploadImage();
        if (uploadedUrl) {
          finalImageUrl = uploadedUrl;
        }
      }

      // Create token on blockchain
      toast.info("Creating token on blockchain...", { id: "create-token" });

      const result = await createTokenOnChain({
        name,
        symbol: symbol.toUpperCase(),
        imageURI: finalImageUrl || "",
        description: description || "",
        hypeBoostEnabled,
      });

      if (result) {
        toast.success("Token created successfully!", {
          id: "create-token",
          description: `Transaction: ${result.txHash.slice(0, 10)}...`,
          action: {
            label: "View",
            onClick: () => window.open(getTxUrl(result.txHash), "_blank"),
          },
        });

        // Store metadata in backend
        let backendTokenId: string = result.tokenAddress;
        try {
          const apiResult = await createTokenApi.mutateAsync({
            name,
            symbol: symbol.toUpperCase(),
            description,
            imageUrl: finalImageUrl,
            websiteUrl: websiteUrl || undefined,
            twitterUrl: twitterUrl || undefined,
            telegramUrl: telegramUrl || undefined,
            totalSupply: "1000000000",
            initialPrice: "0.00001",
            chainId: 80002,
            contractAddress: result.tokenAddress,
            bondingCurveAddress: result.bondingCurveAddress,
          });

          if (apiResult?.id) {
            backendTokenId = apiResult.id;
          } else if ((apiResult as any)?.token?.id) {
            backendTokenId = (apiResult as any).token.id;
          } else if ((apiResult as any)?.data?.id) {
            backendTokenId = (apiResult as any).data.id;
          } else if ((apiResult as any)?.data?.token?.id) {
            backendTokenId = (apiResult as any).data.token.id;
          }
        } catch (apiError) {
          console.warn("Failed to store token metadata:", apiError);
        }

        if (backendTokenId) {
          router.push(`/token/${backendTokenId}`);
        } else {
          toast.warning("Token created but couldn't get ID. Check homepage.");
          router.push("/");
        }
      }
    } catch (error) {
      console.error("Failed to create token:", error);
      toast.error("Failed to create token", {
        id: "create-token",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated || !isConnected) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center mb-6">
          <Rocket className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Connect to Create</h1>
        <p className="text-muted-foreground text-center max-w-md">
          Connect your wallet to launch your token on HypeMint
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl font-bold mb-2">Create Token</h1>
          <p className="text-muted-foreground">
            Launch on Polygon in under a minute
          </p>
        </motion.div>

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-5 gap-6">
          {/* Left Column - Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-3 bg-card border border-border rounded-2xl p-6 space-y-6"
          >
            {/* Token Basics */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    Token Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    placeholder="e.g., Pepe Classic"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-11 bg-background"
                    maxLength={50}
                  />
                </div>

                {/* Symbol */}
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    Symbol <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Input
                      placeholder="e.g., PEPE"
                      value={symbol}
                      onChange={(e) =>
                        setSymbol(
                          e.target.value
                            .toUpperCase()
                            .replace(/[^A-Z0-9]/g, ""),
                        )
                      }
                      className={cn(
                        "h-11 font-mono bg-background pr-10",
                        symbolAvailable === false && "border-red-500",
                        symbolAvailable === true && "border-green-500",
                      )}
                      maxLength={10}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {isCheckingSymbol ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : symbolAvailable === true ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : symbolAvailable === false ? (
                        <XCircle className="h-4 w-4 text-red-500" />
                      ) : null}
                    </div>
                  </div>
                  {symbolError && (
                    <p className="text-xs text-red-500 mt-1">{symbolError}</p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    Description
                  </label>
                  <Textarea
                    placeholder="Tell the world about your token..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="min-h-[80px] bg-background resize-none"
                    maxLength={500}
                  />
                </div>
              </div>

              {/* Right Column - Image Upload */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Token Image
                </label>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => !imagePreview && fileInputRef.current?.click()}
                  className={cn(
                    "relative h-48 border-2 border-dashed rounded-xl transition-all flex flex-col items-center justify-center",
                    isDragging
                      ? "border-primary bg-primary/10"
                      : imagePreview
                        ? "border-green-500/50 cursor-default"
                        : "border-border hover:border-primary/50 cursor-pointer",
                  )}
                >
                  {imagePreview ? (
                    <>
                      <img
                        src={imagePreview}
                        alt="Token"
                        className="absolute inset-0 w-full h-full object-cover rounded-xl"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage();
                        }}
                        className="absolute top-2 right-2 w-8 h-8 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center"
                      >
                        <X className="h-4 w-4 text-white" />
                      </button>
                    </>
                  ) : (
                    <>
                      <Upload
                        className={cn(
                          "h-8 w-8 mb-2",
                          isDragging ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                      <p className="text-sm font-medium">
                        {isDragging
                          ? "Drop image here"
                          : "Click or drag to upload"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        PNG, JPG, GIF up to 5MB
                      </p>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>

                {/* HypeBoost Toggle */}
                <button
                  type="button"
                  onClick={() => setHypeBoostEnabled(!hypeBoostEnabled)}
                  className={cn(
                    "w-full mt-4 p-3 rounded-xl border-2 transition-all flex items-center gap-3",
                    hypeBoostEnabled
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50",
                  )}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      hypeBoostEnabled ? "bg-primary text-white" : "bg-muted",
                    )}
                  >
                    <Zap className="h-4 w-4" />
                  </div>
                  <div className="flex-1 text-left">
                    <span className="font-medium text-sm">HypeBoost</span>
                    <p className="text-xs text-muted-foreground">
                      Anti-bot protection
                    </p>
                  </div>
                  <span
                    className={cn(
                      "text-xs px-2 py-1 rounded-full font-medium",
                      hypeBoostEnabled
                        ? "bg-primary text-white"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {hypeBoostEnabled ? "ON" : "OFF"}
                  </span>
                </button>
              </div>
            </div>

            {/* Social Links */}
            <div>
              <label className="text-sm font-medium mb-3 block">
                Social Links{" "}
                <span className="text-muted-foreground text-xs">
                  (optional)
                </span>
              </label>
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Website"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    className="pl-9 h-10 bg-background text-sm"
                  />
                </div>
                <div className="relative">
                  <Twitter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Twitter"
                    value={twitterUrl}
                    onChange={(e) => setTwitterUrl(e.target.value)}
                    className="pl-9 h-10 bg-background text-sm"
                  />
                </div>
                <div className="relative">
                  <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Telegram"
                    value={telegramUrl}
                    onChange={(e) => setTelegramUrl(e.target.value)}
                    className="pl-9 h-10 bg-background text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Launch Info */}
            <div className="bg-muted/50 rounded-xl p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Total Supply</p>
                  <p className="font-mono font-medium">1,000,000,000</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Bonding Curve</p>
                  <p className="font-medium">Linear</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Creation Fee</p>
                  <p className="font-mono font-medium">
                    {formatEther(fee)} POL
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Your Balance</p>
                  <p
                    className={cn(
                      "font-mono font-medium",
                      hasEnoughBalance ? "text-green-500" : "text-red-500",
                    )}
                  >
                    {balance?.value
                      ? parseFloat(formatEther(balance.value)).toFixed(4)
                      : "0"}{" "}
                    POL
                  </p>
                </div>
              </div>
            </div>

            {/* Errors */}
            {!hasEnoughBalance && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-500">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">
                  Insufficient balance. Need at least {formatEther(fee)} POL.
                </span>
              </div>
            )}

            {contractError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-500">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">{contractError.message}</span>
              </div>
            )}

            {txHash && (
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Transaction Submitted</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {txHash.slice(0, 20)}...{txHash.slice(-8)}
                  </p>
                </div>
                <a
                  href={getTxUrl(txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1 text-sm"
                >
                  View <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={
                !isFormValid ||
                !hasEnoughBalance ||
                isCreating ||
                isConfirming ||
                isUploading
              }
              className="w-full h-12 text-base font-semibold gap-2 bg-gradient-to-r from-primary to-purple-600 hover:opacity-90"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Uploading Image...
                </>
              ) : isCreating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Confirm in Wallet
                </>
              ) : isConfirming ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Confirming Transaction...
                </>
              ) : (
                <>
                  <Rocket className="h-5 w-5" />
                  Launch Token
                </>
              )}
            </Button>
          </motion.div>

          {/* Right Column - Preview Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2 hidden lg:block"
          >
            <TokenPreviewCard
              name={name}
              symbol={symbol}
              description={description}
              imagePreview={imagePreview}
              hypeBoostEnabled={hypeBoostEnabled}
              websiteUrl={websiteUrl}
              twitterUrl={twitterUrl}
              telegramUrl={telegramUrl}
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
