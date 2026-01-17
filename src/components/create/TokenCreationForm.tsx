'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount } from 'wagmi';
import { formatEther } from 'viem';
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
  Link2,
  Eye,
  Coins,
  Calculator,
  Zap,
  Shield,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks';
import { useCreateTokenOnChain, useCreationFee, useNativeBalance } from '@/hooks';
import { useCreateToken } from '@/hooks/useTokens';
import { getTxUrl } from '@/lib/wagmi';
import { toast } from 'sonner';

// Step configuration
const STEPS = [
  { id: 1, title: 'Basic Info', icon: Coins, description: 'Token name and symbol' },
  { id: 2, title: 'Details', icon: ImageIcon, description: 'Image and description' },
  { id: 3, title: 'Settings', icon: Zap, description: 'HypeBoost and options' },
  { id: 4, title: 'Preview', icon: Eye, description: 'Review and launch' },
];

export function TokenCreationForm() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { address, isConnected } = useAccount();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Contract hooks
  const { createToken: createTokenOnChain, isCreating, isConfirming, txHash, error: contractError } = useCreateTokenOnChain();
  const { data: creationFee } = useCreationFee();
  const { data: balance } = useNativeBalance();

  // Backend API hook (for storing metadata)
  const createTokenApi = useCreateToken();

  // Step state
  const [currentStep, setCurrentStep] = useState(1);

  // Form state
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [twitterUrl, setTwitterUrl] = useState('');
  const [telegramUrl, setTelegramUrl] = useState('');
  const [discordUrl, setDiscordUrl] = useState('');

  // HypeBoost settings
  const [hypeBoostEnabled, setHypeBoostEnabled] = useState(true);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);

  // URL validation helper
  const isValidUrl = (url: string): boolean => {
    if (!url) return true; // Empty is valid (optional)
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  // Validation
  const isStep1Valid = name.length >= 2 && symbol.length >= 2 && symbol.length <= 10;
  const isStep2Valid = true; // Image and description are optional
  const isStep3Valid = true; // HypeBoost is just a toggle
  const isStep4Valid = isValidUrl(websiteUrl) && isValidUrl(twitterUrl) &&
    isValidUrl(telegramUrl) && isValidUrl(discordUrl);
  const isAllValid = isStep1Valid && isStep2Valid && isStep3Valid && isStep4Valid;

  // Check if user has enough balance
  const fee = creationFee || BigInt("10000000000000000"); // 0.01 MATIC default
  const hasEnoughBalance = balance?.value ? balance.value >= fee : false;

  // Handle image upload
  const handleImageUpload = (file: File) => {
    if (file && file.type.startsWith('image/')) {
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

  // Upload image to IPFS/backend
  const uploadImage = useCallback(async (): Promise<string | null> => {
    if (!imageFile) return imageUrl || null;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', imageFile);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/v1/uploads/image`,
        {
          method: 'POST',
          body: formData,
        }
      );

      const result = await response.json();
      if (result.success) {
        setImageUrl(result.data.url);
        return result.data.url;
      } else {
        console.error('Image upload failed:', result.error);
        toast.error('Failed to upload image');
        return null;
      }
    } catch (error) {
      console.error('Image upload error:', error);
      toast.error('Failed to upload image');
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [imageFile, imageUrl]);

  // Submit - Create token on-chain
  const handleSubmit = async () => {
    if (!isAllValid || !isConnected) return;

    try {
      // Step 1: Upload image if we have one
      let finalImageUrl = imageUrl;
      if (imageFile && !imageUrl) {
        const uploadedUrl = await uploadImage();
        if (uploadedUrl) {
          finalImageUrl = uploadedUrl;
        }
      }

      // Step 2: Create token on blockchain
      toast.info('Creating token on blockchain...', { id: 'create-token' });

      const result = await createTokenOnChain({
        name,
        symbol: symbol.toUpperCase(),
        imageURI: finalImageUrl || '',
        description: description || '',
        hypeBoostEnabled,
      });

      if (result) {
        toast.success('Token created successfully!', {
          id: 'create-token',
          description: `Transaction: ${result.txHash.slice(0, 10)}...`,
          action: {
            label: 'View',
            onClick: () => window.open(getTxUrl(result.txHash), '_blank'),
          },
        });

        // Step 3: Store additional metadata in backend
        try {
          await createTokenApi.mutateAsync({
            name,
            symbol: symbol.toUpperCase(),
            description,
            imageUrl: finalImageUrl,
            websiteUrl: websiteUrl || undefined,
            twitterUrl: twitterUrl || undefined,
            telegramUrl: telegramUrl || undefined,
            discordUrl: discordUrl || undefined,
            totalSupply: '1000000000',
            initialPrice: '0.00001',
            chainId: 137, // Polygon
          });
        } catch (apiError) {
          console.warn('Failed to store token metadata in backend:', apiError);
          // Continue anyway - on-chain is the source of truth
        }

        // Redirect to the token page
        router.push(`/token/${result.tokenAddress}`);
      }
    } catch (error) {
      console.error('Failed to create token:', error);
      toast.error('Failed to create token', {
        id: 'create-token',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  // Navigation
  const nextStep = () => {
    if (currentStep < 4) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return isStep1Valid;
      case 2: return isStep2Valid;
      case 3: return isStep3Valid;
      default: return false;
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
          Connect your wallet to launch your memecoin on HypeMint
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl font-bold mb-2">
            <span className="bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
              Launch Your Token
            </span>
          </h1>
          <p className="text-muted-foreground">
            Create and launch your memecoin on Polygon in minutes
          </p>
        </motion.div>

        {/* Step Progress */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;

              return (
                <div key={step.id} className="flex items-center">
                  <button
                    onClick={() => isCompleted && setCurrentStep(step.id)}
                    className={cn(
                      "flex flex-col items-center gap-2 transition-all",
                      isCompleted ? "cursor-pointer" : "cursor-default"
                    )}
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
                      isActive
                        ? "bg-gradient-to-r from-primary to-purple-600 text-white shadow-lg shadow-primary/30"
                        : isCompleted
                          ? "bg-green-500/20 text-green-500"
                          : "bg-muted text-muted-foreground"
                    )}>
                      {isCompleted ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </div>
                    <span className={cn(
                      "text-xs font-medium hidden sm:block",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )}>
                      {step.title}
                    </span>
                  </button>
                  {index < STEPS.length - 1 && (
                    <div className={cn(
                      "w-12 sm:w-20 h-0.5 mx-2",
                      currentStep > step.id ? "bg-green-500" : "bg-border"
                    )} />
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Main Content - Form + Preview */}
        <div className="grid lg:grid-cols-[1fr_350px] gap-8">
          {/* Form Section */}
          <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6">
            <AnimatePresence mode="wait">
              {/* Step 1: Basic Info */}
              {currentStep === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-xl font-semibold mb-1 flex items-center gap-2">
                      <Coins className="h-5 w-5 text-primary" />
                      Token Identity
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Choose a memorable name and symbol for your token
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Token Name *</label>
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
                      <label className="text-sm font-medium mb-2 block">Symbol *</label>
                      <Input
                        placeholder="e.g., PEPE"
                        value={symbol}
                        onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                        className="h-12 text-lg font-mono bg-background/50"
                        maxLength={10}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        2-10 characters, usually 3-5
                      </p>
                    </div>
                  </div>

                  {/* Tokenomics Preview */}
                  <div className="p-4 bg-background/30 rounded-xl border border-border/30">
                    <div className="flex items-center gap-2 mb-3">
                      <Calculator className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Tokenomics</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Total Supply</span>
                        <p className="font-mono font-medium">1,000,000,000</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Bonding Curve</span>
                        <p className="font-mono font-medium">Linear</p>
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
                    <h2 className="text-xl font-semibold mb-1 flex items-center gap-2">
                      <ImageIcon className="h-5 w-5 text-primary" />
                      Token Details
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Add an image and description to make your token stand out
                    </p>
                  </div>

                  {/* Drag & Drop Image Upload */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "relative h-48 border-2 border-dashed rounded-xl transition-all cursor-pointer flex flex-col items-center justify-center gap-3",
                      isDragging
                        ? "border-primary bg-primary/10"
                        : imagePreview
                          ? "border-green-500/50 bg-green-500/5"
                          : "border-border hover:border-primary/50 hover:bg-primary/5"
                    )}
                  >
                    {imagePreview ? (
                      <>
                        <img
                          src={imagePreview}
                          alt="Token"
                          className="absolute inset-0 w-full h-full object-cover rounded-xl opacity-30"
                        />
                        <div className="relative z-10 flex flex-col items-center gap-2">
                          <Check className="h-8 w-8 text-green-500" />
                          <span className="text-sm font-medium">Image uploaded</span>
                          <span className="text-xs text-muted-foreground">Click to change</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <Upload className={cn(
                          "h-10 w-10 transition-colors",
                          isDragging ? "text-primary" : "text-muted-foreground"
                        )} />
                        <div className="text-center">
                          <p className="text-sm font-medium">
                            {isDragging ? "Drop image here" : "Drag & drop or click to upload"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            PNG, JPG, GIF up to 5MB
                          </p>
                        </div>
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

                  <div>
                    <label className="text-sm font-medium mb-2 block">Description</label>
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

                  {/* Social Links */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-primary" />
                      Social Links (Optional)
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Website"
                          value={websiteUrl}
                          onChange={(e) => setWebsiteUrl(e.target.value)}
                          className="pl-9 h-10 bg-background/50"
                        />
                      </div>
                      <div className="relative">
                        <Twitter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Twitter"
                          value={twitterUrl}
                          onChange={(e) => setTwitterUrl(e.target.value)}
                          className="pl-9 h-10 bg-background/50"
                        />
                      </div>
                      <div className="relative">
                        <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Telegram"
                          value={telegramUrl}
                          onChange={(e) => setTelegramUrl(e.target.value)}
                          className="pl-9 h-10 bg-background/50"
                        />
                      </div>
                      <div className="relative">
                        <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Discord"
                          value={discordUrl}
                          onChange={(e) => setDiscordUrl(e.target.value)}
                          className="pl-9 h-10 bg-background/50"
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 3: HypeBoost Settings */}
              {currentStep === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-xl font-semibold mb-1 flex items-center gap-2">
                      <Zap className="h-5 w-5 text-primary" />
                      HypeBoost Protection
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Enable anti-snipe and fair launch features
                    </p>
                  </div>

                  {/* HypeBoost Toggle */}
                  <div
                    onClick={() => setHypeBoostEnabled(!hypeBoostEnabled)}
                    className={cn(
                      "p-6 rounded-xl border-2 cursor-pointer transition-all",
                      hypeBoostEnabled
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center",
                        hypeBoostEnabled ? "bg-primary text-white" : "bg-muted"
                      )}>
                        <Shield className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold">HypeBoost Mode</h3>
                          <div className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium",
                            hypeBoostEnabled
                              ? "bg-primary text-white"
                              : "bg-muted text-muted-foreground"
                          )}>
                            {hypeBoostEnabled ? "Enabled" : "Disabled"}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          Protect your launch from bots and ensure fair distribution
                        </p>

                        {hypeBoostEnabled && (
                          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50">
                            <div className="text-sm">
                              <span className="text-muted-foreground">Max Wallet</span>
                              <p className="font-medium">2% of supply</p>
                            </div>
                            <div className="text-sm">
                              <span className="text-muted-foreground">Snipe Protection</span>
                              <p className="font-medium">5 blocks</p>
                            </div>
                            <div className="text-sm">
                              <span className="text-muted-foreground">Vesting Duration</span>
                              <p className="font-medium">1 hour</p>
                            </div>
                            <div className="text-sm">
                              <span className="text-muted-foreground">Immediate Unlock</span>
                              <p className="font-medium">25%</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Benefits */}
                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Why HypeBoost?</span>
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-2">
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        Prevents bot sniping at launch
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        Limits whale accumulation
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        Gradual token unlock prevents dumps
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        Creates fairer distribution
                      </li>
                    </ul>
                  </div>
                </motion.div>
              )}

              {/* Step 4: Preview & Launch */}
              {currentStep === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-xl font-semibold mb-1 flex items-center gap-2">
                      <Rocket className="h-5 w-5 text-primary" />
                      Ready to Launch
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Review your token details before launching
                    </p>
                  </div>

                  {/* Summary */}
                  <div className="space-y-4">
                    <div className="p-4 bg-background/30 rounded-xl">
                      <h3 className="text-sm font-medium text-muted-foreground mb-3">Token Info</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Name</span>
                          <span className="font-medium">{name || 'Not set'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Symbol</span>
                          <span className="font-mono font-medium">${symbol || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">HypeBoost</span>
                          <span className={cn(
                            "font-medium",
                            hypeBoostEnabled ? "text-green-500" : "text-muted-foreground"
                          )}>
                            {hypeBoostEnabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Supply</span>
                          <span className="font-medium">1,000,000,000</span>
                        </div>
                      </div>
                    </div>

                    {/* Fee Info */}
                    <div className="p-4 bg-background/30 rounded-xl">
                      <h3 className="text-sm font-medium text-muted-foreground mb-3">Launch Cost</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Creation Fee</span>
                          <span className="font-mono font-medium">
                            {formatEther(fee)} MATIC
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Your Balance</span>
                          <span className={cn(
                            "font-mono font-medium",
                            hasEnoughBalance ? "text-green-500" : "text-destructive"
                          )}>
                            {balance?.value ? parseFloat(formatEther(balance.value)).toFixed(4) : '0'} MATIC
                          </span>
                        </div>
                      </div>
                    </div>

                    {!hasEnoughBalance && (
                      <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl">
                        <div className="flex items-center gap-2 text-destructive">
                          <AlertCircle className="h-4 w-4" />
                          <span className="text-sm font-medium">Insufficient balance</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          You need at least {formatEther(fee)} MATIC to create a token.
                        </p>
                      </div>
                    )}

                    {contractError && (
                      <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl">
                        <div className="flex items-center gap-2 text-destructive">
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
                            <p className="text-sm font-medium">Transaction Submitted</p>
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
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation Buttons */}
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

              {currentStep < 4 ? (
                <Button
                  onClick={nextStep}
                  disabled={!canProceed()}
                  className="gap-2 bg-gradient-to-r from-primary to-purple-600 hover:opacity-90"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={!isAllValid || !hasEnoughBalance || isCreating || isConfirming || isUploading}
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
          </div>

          {/* Live Preview Sidebar */}
          <div className="lg:block">
            <div className="sticky top-6">
              <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-4">
                  <Eye className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Live Preview</span>
                </div>

                {/* Token Card Preview */}
                <div className="bg-background rounded-xl p-4 border border-border/50">
                  <div className="flex items-start gap-3">
                    {/* Token Image */}
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center overflow-hidden">
                      {imagePreview ? (
                        <img src={imagePreview} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-lg font-bold text-muted-foreground">
                          {symbol.slice(0, 2) || '??'}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">
                        {name || 'Token Name'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        ${symbol || 'SYMBOL'}
                      </p>
                    </div>

                    <div className="text-right">
                      {hypeBoostEnabled && (
                        <div className="flex items-center gap-1 text-xs text-primary">
                          <Zap className="h-3 w-3" />
                          <span>Boosted</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {description && (
                    <p className="text-xs text-muted-foreground mt-3 line-clamp-2">
                      {description}
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/30">
                    <div>
                      <p className="text-xs text-muted-foreground">Market Cap</p>
                      <p className="font-medium">$0</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Status</p>
                      <p className="text-green-500 font-medium">New</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tips */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Pro Tips</span>
                </div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Choose a unique, memorable name</li>
                  <li>• Add an eye-catching image</li>
                  <li>• Enable HypeBoost for fair launch</li>
                  <li>• Write a compelling description</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
