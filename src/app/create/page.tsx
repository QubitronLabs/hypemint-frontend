'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    Upload,
    Globe,
    Twitter,
    MessageCircle,
    Loader2,
    AlertCircle,
    Info,
    ImagePlus,
    Link as LinkIcon,
    ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks';
import { useCreateToken } from '@/hooks/useTokens';

/**
 * Create Token Page with JWT Auth
 * 
 * Features:
 * - Wallet connection required (uses JWT auth)
 * - Token details form
 * - Image upload with preview
 * - Social links
 * - Fee disclosure
 */
export default function CreateTokenPage() {
    const router = useRouter();
    const { isAuthenticated, isLoading: authLoading, walletAddress } = useAuth();
    const createToken = useCreateToken();

    // Form state
    const [name, setName] = useState('');
    const [symbol, setSymbol] = useState('');
    const [description, setDescription] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [showSocialLinks, setShowSocialLinks] = useState(false);
    const [websiteUrl, setWebsiteUrl] = useState('');
    const [twitterUrl, setTwitterUrl] = useState('');
    const [telegramUrl, setTelegramUrl] = useState('');
    const [discordUrl, setDiscordUrl] = useState('');

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name || !symbol) return;

        try {
            const token = await createToken.mutateAsync({
                name,
                symbol: symbol.toUpperCase(),
                description,
                imageUrl: imagePreview || undefined,
                websiteUrl: websiteUrl || undefined,
                twitterUrl: twitterUrl || undefined,
                telegramUrl: telegramUrl || undefined,
                discordUrl: discordUrl || undefined,
                totalSupply: '1000000000', // 1 billion default
                initialPrice: '0.00001',
                chainId: 1,
            });

            router.push(`/token/${token.id}`);
        } catch (error) {
            console.error('Failed to create token:', error);
        }
    };

    const isValid = name.length >= 2 && symbol.length >= 2;

    // Loading state
    if (authLoading) {
        return (
            <div className="min-h-[80vh] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // Wallet connection required
    if (!isAuthenticated) {
        return (
            <div className="min-h-[80vh] flex items-center justify-center p-6">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center max-w-md"
                >
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
                        <AlertCircle className="h-8 w-8 text-primary" />
                    </div>
                    <h1 className="text-xl font-bold mb-2">Wallet Required</h1>
                    <p className="text-muted-foreground mb-6">
                        Connect your wallet to create a new token. Click the connect button in the header.
                    </p>
                    <p className="text-xs text-muted-foreground">
                        After connecting, you&apos;ll be authenticated with a JWT token
                    </p>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto p-6">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
            >
                <h1 className="text-2xl font-bold mb-2">Create new coin</h1>
                <p className="text-muted-foreground text-sm">
                    Choose carefully, these can&apos;t be changed once the coin is created
                </p>
                {walletAddress && (
                    <p className="text-xs text-primary mt-2">
                        Connected: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                    </p>
                )}
            </motion.div>

            <div className="grid lg:grid-cols-[1fr_300px] gap-8">
                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Coin Details */}
                    <Card className="bg-card border-border">
                        <CardContent className="p-6">
                            <h2 className="font-semibold mb-4">Coin details</h2>

                            <div className="grid md:grid-cols-2 gap-4">
                                {/* Coin Name */}
                                <div>
                                    <label className="text-sm text-muted-foreground mb-2 block">
                                        Coin name
                                    </label>
                                    <Input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Name your coin"
                                        maxLength={50}
                                        className="bg-muted border-transparent focus:border-primary/50"
                                    />
                                </div>

                                {/* Ticker */}
                                <div>
                                    <label className="text-sm text-muted-foreground mb-2 block">
                                        Ticker
                                    </label>
                                    <Input
                                        value={symbol}
                                        onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                                        placeholder="Add a coin ticker (e.g. DOGE)"
                                        maxLength={10}
                                        className="bg-muted border-transparent focus:border-primary/50 uppercase"
                                    />
                                </div>
                            </div>

                            {/* Description */}
                            <div className="mt-4">
                                <label className="text-sm text-muted-foreground mb-2 block">
                                    Description <span className="text-muted-foreground/60">(Optional)</span>
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Write a short description"
                                    maxLength={1000}
                                    rows={3}
                                    className={cn(
                                        'w-full rounded-lg bg-muted border border-transparent px-3 py-2 text-sm',
                                        'placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20',
                                        'resize-none'
                                    )}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Social Links */}
                    <Card className="bg-card border-border">
                        <CardContent className="p-6">
                            <button
                                type="button"
                                onClick={() => setShowSocialLinks(!showSocialLinks)}
                                className="flex items-center justify-between w-full"
                            >
                                <div className="flex items-center gap-2">
                                    <LinkIcon className="h-4 w-4" />
                                    <span className="font-medium">Add social links</span>
                                    <span className="text-muted-foreground/60 text-sm">(Optional)</span>
                                </div>
                                <ChevronDown
                                    className={cn(
                                        'h-4 w-4 transition-transform',
                                        showSocialLinks && 'rotate-180'
                                    )}
                                />
                            </button>

                            {showSocialLinks && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="mt-4 space-y-3"
                                >
                                    <div className="relative">
                                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            value={websiteUrl}
                                            onChange={(e) => setWebsiteUrl(e.target.value)}
                                            placeholder="Website URL"
                                            className="pl-10 bg-muted border-transparent"
                                        />
                                    </div>
                                    <div className="relative">
                                        <Twitter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            value={twitterUrl}
                                            onChange={(e) => setTwitterUrl(e.target.value)}
                                            placeholder="Twitter URL"
                                            className="pl-10 bg-muted border-transparent"
                                        />
                                    </div>
                                    <div className="relative">
                                        <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            value={telegramUrl}
                                            onChange={(e) => setTelegramUrl(e.target.value)}
                                            placeholder="Telegram URL"
                                            className="pl-10 bg-muted border-transparent"
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Image Upload */}
                    <Card className="bg-card border-border">
                        <CardContent className="p-6">
                            <label className="block cursor-pointer">
                                <div
                                    className={cn(
                                        'border-2 border-dashed border-border rounded-xl p-8',
                                        'flex flex-col items-center justify-center text-center',
                                        'hover:border-primary/50 transition-colors',
                                        imagePreview && 'border-primary'
                                    )}
                                >
                                    {imagePreview ? (
                                        <div className="relative w-32 h-32 rounded-lg overflow-hidden">
                                            <img
                                                src={imagePreview}
                                                alt="Upload preview"
                                                className="object-cover w-full h-full"
                                            />
                                        </div>
                                    ) : (
                                        <>
                                            <ImagePlus className="h-10 w-10 text-muted-foreground mb-3" />
                                            <p className="font-medium mb-1">
                                                Select video or image to upload
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                or drag and drop it here
                                            </p>
                                            <Button
                                                type="button"
                                                size="sm"
                                                className="mt-4 bg-primary/20 text-primary hover:bg-primary/30"
                                            >
                                                Select file
                                            </Button>
                                        </>
                                    )}
                                </div>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    className="hidden"
                                />
                            </label>

                            {/* File requirements */}
                            <div className="mt-4 grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                                <div>
                                    <p className="font-medium mb-1">File size and type</p>
                                    <ul className="space-y-1">
                                        <li>• Image - max 15mb, .jpg, .gif or .png recommended</li>
                                        <li>• Video - max 30mb, .mp4 recommended</li>
                                    </ul>
                                </div>
                                <div>
                                    <p className="font-medium mb-1">Resolution and aspect ratio</p>
                                    <ul className="space-y-1">
                                        <li>• Image - min 1000×1000px, 1:1 square recommended</li>
                                        <li>• Video - 16:9 or 9:16, 1080p+ recommended</li>
                                    </ul>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Fee Disclosure */}
                    <Card className="bg-yellow-500/10 border-yellow-500/30">
                        <CardContent className="p-4 flex items-start gap-3">
                            <Info className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                            <div className="text-sm">
                                <p className="font-medium text-yellow-500 mb-1">Fee Disclosure</p>
                                <p className="text-muted-foreground">
                                    Coin data (social links, banner, etc) can only be added now,
                                    and can&apos;t be changed or edited after creation
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Submit */}
                    <Button
                        type="submit"
                        size="lg"
                        disabled={!isValid || createToken.isPending}
                        className="w-full h-14 text-lg font-bold bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                        {createToken.isPending ? (
                            <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Creating...
                            </>
                        ) : (
                            'Create coin'
                        )}
                    </Button>
                </form>

                {/* Preview Panel */}
                <div className="hidden lg:block">
                    <div className="sticky top-24">
                        <h3 className="font-semibold mb-4">Preview</h3>
                        <Card className="bg-card border-border">
                            <CardContent className="p-6 flex flex-col items-center">
                                {imagePreview ? (
                                    <div className="w-32 h-32 rounded-xl overflow-hidden mb-4">
                                        <img
                                            src={imagePreview}
                                            alt="Token preview"
                                            className="object-cover w-full h-full"
                                        />
                                    </div>
                                ) : (
                                    <div className="w-32 h-32 rounded-xl bg-muted flex items-center justify-center mb-4">
                                        <span className="text-2xl font-bold text-muted-foreground">
                                            {symbol.slice(0, 2) || '?'}
                                        </span>
                                    </div>
                                )}
                                <p className="font-semibold text-center">
                                    {name || 'Token Name'}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    ${symbol || 'SYMBOL'}
                                </p>
                                {description && (
                                    <p className="text-xs text-muted-foreground text-center mt-2 line-clamp-3">
                                        {description}
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        <p className="text-xs text-muted-foreground text-center mt-4">
                            A preview of how the coin will look like
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
