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
  Check,
  ChevronRight,
  ChevronLeft,
  Rocket,
  Sparkles,
  Image as ImageIcon,
  Eye,
  Coins,
  Zap,
  Shield,
  ExternalLink,
  X,
  CheckCircle2,
  XCircle,
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

// API base URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Step configuration - simplified to 3 steps
const STEPS = [
  { id: 1, title: "Token Info", description: "Name, symbol & image" },
  { id: 2, title: "Details", description: "Description & links" },
  { id: 3, title: "Launch", description: "Review & deploy" },
];

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

  // Step state
  const [currentStep, setCurrentStep] = useState(1);

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

  // HypeBoost
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
  const isStep1Valid =
    name.length >= 2 &&
    symbol.length >= 2 &&
    symbol.length <= 10 &&
    symbolAvailable !== false;
  const isStep2Valid = true;
  const isStep3Valid = true;
  const isAllValid = isStep1Valid && isStep2Valid && isStep3Valid;

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
    if (!isAllValid || !isConnected) return;

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

        // Store metadata in backend with contract addresses
        let backendTokenId = result.tokenAddress; // fallback to contract address
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
            chainId: 80002, // Polygon Amoy testnet
            contractAddress: result.tokenAddress,
            bondingCurveAddress: result.bondingCurveAddress,
          });
          // Use the backend token ID for navigation (API returns token object)
          if (apiResult?.id) {
            backendTokenId = apiResult.id;
          } else if ((apiResult as any)?.token?.id) {
            // Handle wrapped response { token, bondingCurve }
            backendTokenId = (apiResult as any).token.id;
          } else if ((apiResult as any)?.data?.id) {
            // Handle { data: { id } } response format
            backendTokenId = (apiResult as any).data.id;
          } else if ((apiResult as any)?.data?.token?.id) {
            // Handle { data: { token: { id } } } response format
            backendTokenId = (apiResult as any).data.token.id;
          }
        } catch (apiError) {
          console.warn("Failed to store token metadata:", apiError);
          // If API fails, navigate to token by contract address
        }

        // Only redirect if we have a valid token ID
        if (backendTokenId) {
          router.push(`/token/${backendTokenId}`);
        } else {
          toast.warning("Token created but couldn't get ID. Check the homepage.");
          router.push('/');
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

  // Navigation
  const nextStep = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return isStep1Valid;
      case 2:
        return isStep2Valid;
      default:
        return false;
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
        <p className="text-muted-foreground text-center max-w-md mb-6">
          Connect your wallet to launch your token on HypeMint
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl font-bold mb-2">
            <span className="bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
              Create Your Token
            </span>
          </h1>
          <p className="text-muted-foreground">
            Launch on Polygon in under a minute
          </p>
        </motion.div>

        {/* Progress Steps */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <div className="flex items-center justify-center gap-2">
            {STEPS.map((step, index) => {
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;

              return (
                <div key={step.id} className="flex items-center">
                  <button
                    onClick={() => isCompleted && setCurrentStep(step.id)}
                    disabled={!isCompleted}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-full transition-all",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : isCompleted
                          ? "bg-green-500/20 text-green-500 cursor-pointer hover:bg-green-500/30"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    <span className="w-6 h-6 rounded-full bg-current/20 flex items-center justify-center text-sm font-medium">
                      {isCompleted ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        step.id
                      )}
                    </span>
                    <span className="hidden sm:inline text-sm font-medium">
                      {step.title}
                    </span>
                  </button>
                  {index < STEPS.length - 1 && (
                    <ChevronRight
                      className={cn(
                        "h-4 w-4 mx-1",
                        currentStep > step.id
                          ? "text-green-500"
                          : "text-muted-foreground",
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Form Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6 md:p-8"
        >
          <AnimatePresence mode="wait">
            {/* Step 1: Token Info */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Left: Form Fields */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Token Name *
                      </label>
                      <Input
                        placeholder="e.g., Pepe Classic"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="h-12 text-lg bg-background/50"
                        maxLength={50}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {name.length}/50 characters
                      </p>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Symbol *
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
                            "h-12 text-lg font-mono bg-background/50 pr-10",
                            symbolAvailable === false &&
                              "border-red-500 focus:border-red-500",
                            symbolAvailable === true &&
                              "border-green-500 focus:border-green-500",
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
                        <p className="text-xs text-red-500 mt-1">
                          {symbolError}
                        </p>
                      )}
                      {symbolAvailable === true && (
                        <p className="text-xs text-green-500 mt-1">
                          Symbol is available!
                        </p>
                      )}
                      {!symbolError && symbolAvailable === null && (
                        <p className="text-xs text-muted-foreground mt-1">
                          2-10 characters
                        </p>
                      )}
                    </div>

                    {/* HypeBoost Toggle */}
                    <div
                      onClick={() => setHypeBoostEnabled(!hypeBoostEnabled)}
                      className={cn(
                        "p-4 rounded-xl border-2 cursor-pointer transition-all",
                        hypeBoostEnabled
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center",
                            hypeBoostEnabled
                              ? "bg-primary text-white"
                              : "bg-muted",
                          )}
                        >
                          <Shield className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">HypeBoost</span>
                            <span
                              className={cn(
                                "text-xs px-2 py-1 rounded-full",
                                hypeBoostEnabled
                                  ? "bg-primary text-white"
                                  : "bg-muted text-muted-foreground",
                              )}
                            >
                              {hypeBoostEnabled ? "ON" : "OFF"}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Anti-bot protection & fair launch
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Image Upload */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Token Image
                    </label>
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() =>
                        !imagePreview && fileInputRef.current?.click()
                      }
                      className={cn(
                        "relative h-64 border-2 border-dashed rounded-xl transition-all flex flex-col items-center justify-center",
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
                            className="absolute top-2 right-2 w-8 h-8 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
                          >
                            <X className="h-4 w-4 text-white" />
                          </button>
                        </>
                      ) : (
                        <>
                          <Upload
                            className={cn(
                              "h-10 w-10 mb-3",
                              isDragging
                                ? "text-primary"
                                : "text-muted-foreground",
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
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2: Details */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Description
                  </label>
                  <Textarea
                    placeholder="Tell the world about your token..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="min-h-[120px] bg-background/50 resize-none"
                    maxLength={500}
                  />
                  <p className="text-xs text-muted-foreground mt-1 text-right">
                    {description.length}/500
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Website URL"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      className="pl-10 h-11 bg-background/50"
                    />
                  </div>
                  <div className="relative">
                    <Twitter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Twitter URL"
                      value={twitterUrl}
                      onChange={(e) => setTwitterUrl(e.target.value)}
                      className="pl-10 h-11 bg-background/50"
                    />
                  </div>
                  <div className="relative sm:col-span-2">
                    <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Telegram URL"
                      value={telegramUrl}
                      onChange={(e) => setTelegramUrl(e.target.value)}
                      className="pl-10 h-11 bg-background/50"
                    />
                  </div>
                </div>

                <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Tip</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tokens with complete profiles get 3x more visibility. Add
                    social links to build trust!
                  </p>
                </div>
              </motion.div>
            )}

            {/* Step 3: Launch */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {/* Preview Card */}
                <div className="bg-background/50 rounded-xl p-5 border border-border/50">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {imagePreview ? (
                        <img
                          src={imagePreview}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xl font-bold text-muted-foreground">
                          {symbol.slice(0, 2) || "??"}
                        </span>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold">
                        {name || "Token Name"}
                      </h3>
                      <p className="text-muted-foreground">
                        ${symbol || "SYMBOL"}
                      </p>
                      {description && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {description}
                        </p>
                      )}
                    </div>
                    {hypeBoostEnabled && (
                      <div className="flex items-center gap-1 text-xs text-primary bg-primary/10 px-2 py-1 rounded-full">
                        <Zap className="h-3 w-3" />
                        <span>Boosted</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Token Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-background/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">
                      Total Supply
                    </p>
                    <p className="font-mono font-medium">1,000,000,000</p>
                  </div>
                  <div className="bg-background/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">
                      Bonding Curve
                    </p>
                    <p className="font-medium">Linear</p>
                  </div>
                  <div className="bg-background/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">
                      Creation Fee
                    </p>
                    <p className="font-mono font-medium">
                      {formatEther(fee)} POL
                    </p>
                  </div>
                  <div className="bg-background/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">
                      Your Balance
                    </p>
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

                {/* Warnings */}
                {!hasEnoughBalance && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <div className="flex items-center gap-2 text-red-500">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        Insufficient balance
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      You need at least {formatEther(fee)} POL to create a
                      token.
                    </p>
                  </div>
                )}

                {contractError && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <div className="flex items-center gap-2 text-red-500">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">Error</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {contractError.message}
                    </p>
                  </div>
                )}

                {txHash && (
                  <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          Transaction Submitted
                        </p>
                        <p className="text-xs text-muted-foreground font-mono mt-1">
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
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t border-border/30">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 1}
              className="gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>

            {currentStep < 3 ? (
              <Button
                onClick={nextStep}
                disabled={!canProceed()}
                className="gap-2 bg-gradient-to-r from-primary to-purple-600 hover:opacity-90"
              >
                Continue
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={
                  !isAllValid ||
                  !hasEnoughBalance ||
                  isCreating ||
                  isConfirming ||
                  isUploading
                }
                className="gap-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:opacity-90 min-w-[160px]"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Confirm in Wallet
                  </>
                ) : isConfirming ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Confirming...
                  </>
                ) : (
                  <>
                    <Rocket className="h-4 w-4" />
                    Launch Token
                  </>
                )}
              </Button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
