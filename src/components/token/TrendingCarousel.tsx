"use client";

import { useMemo, useCallback, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useTrendingTokens } from "@/hooks/useTokens";
import { formatCompactMarketCap } from "@/lib/formatters";
import { pickRandom } from "@/lib/utils/arrays";
import { ChevronLeft, ChevronRight, Coins } from "lucide-react";
import type { Token } from "@/types";

/*
 * Responsive slide widths:
 *   mobile  → 1 card  (85%)
 *   sm      → 2 cards
 *   lg      → 3 cards
 *   2xl     → 4 cards
 *   ≥1920px → 5 cards (3xl)
 *
 * Formula: (100% - (N-1)*gap) / N  where gap = 16px (gap-4)
 */
const SLIDE_CLASSES =
	"pl-4 flex-shrink-0 w-[85%] sm:w-1/2 lg:w-1/3 2xl:w-1/4 min-[1920px]:w-1/5 min-w-0";

/**
 * TrendingCarousel — Pump.fun-style large banner card carousel.
 *
 * Each card shows:
 *   - Token image fills the entire card as banner background
 *   - Market cap overlaid at bottom-left in bold white
 *   - Token name + symbol overlaid below the mcap
 *   - Description in muted text below the card
 *
 * Responsive: 1 card mobile, 2 sm, 3 lg, 4 2xl, 5 3xl.
 */
export function TrendingCarousel() {
	const { data: trendingTokens = [], isLoading } = useTrendingTokens({
		pageSize: 40,
	});

	const carouselTokens = useMemo(() => {
		const source = Array.isArray(trendingTokens) ? trendingTokens : [];
		if (source.length === 0) return [];
		return pickRandom(source as Token[], 20);
	}, [trendingTokens]);

	// Detect if screen is tablet or larger (>= 768px)
	const [isTabletOrLarger, setIsTabletOrLarger] = useState(false);

	useEffect(() => {
		const mediaQuery = window.matchMedia("(min-width: 768px)");

		// Set initial value
		setIsTabletOrLarger(mediaQuery.matches);

		// Listen for changes
		const handleChange = (e: MediaQueryListEvent) => {
			setIsTabletOrLarger(e.matches);
		};

		mediaQuery.addEventListener("change", handleChange);
		return () => mediaQuery.removeEventListener("change", handleChange);
	}, []);

	// Conditionally enable autoplay only on tablet+ screens
	const plugins = useMemo(() => {
		if (!isTabletOrLarger) return [];

		return [
			Autoplay({
				delay: 4000,
				stopOnInteraction: false,
				stopOnMouseEnter: true,
			}),
		];
	}, [isTabletOrLarger]);

	const [emblaRef, emblaApi] = useEmblaCarousel(
		{
			align: "start",
			loop: true,
			dragFree: false,
			containScroll: "trimSnaps",
			slidesToScroll: 1,
		},
		plugins,
	);

	const [canScrollPrev, setCanScrollPrev] = useState(false);
	const [canScrollNext, setCanScrollNext] = useState(false);

	const onSelect = useCallback(() => {
		if (!emblaApi) return;
		setCanScrollPrev(emblaApi.canScrollPrev());
		setCanScrollNext(emblaApi.canScrollNext());
	}, [emblaApi]);

	useEffect(() => {
		if (!emblaApi) return;
		onSelect();
		emblaApi.on("select", onSelect);
		emblaApi.on("reInit", onSelect);
		return () => {
			emblaApi.off("select", onSelect);
		};
	}, [emblaApi, onSelect]);

	const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
	const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

	// ─── Loading skeleton ────────────────────────────────────
	if (isLoading) {
		return (
			<section>
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-lg font-semibold text-foreground">
						Trending coins
					</h2>
					<div className="flex items-center gap-1">
						<Skeleton className="h-8 w-8 rounded-full" />
						<Skeleton className="h-8 w-8 rounded-full" />
					</div>
				</div>
				<div className="flex -ml-4 overflow-hidden">
					{Array.from({ length: 5 }).map((_, i) => (
						<div
							key={i}
							className="pl-4 flex-shrink-0 w-[85%] sm:w-1/2 lg:w-1/3 2xl:w-1/4 min-[1920px]:w-1/5"
						>
							<Skeleton className="w-full h-44 rounded-xl" />
							<Skeleton className="h-3.5 w-3/4 mt-2.5" />
						</div>
					))}
				</div>
			</section>
		);
	}

	if (carouselTokens.length === 0) return null;

	return (
		<section>
			{/* Header: title + nav arrows (pump.fun style) */}
			<div className="flex items-center justify-between mb-4">
				<h2 className="text-lg font-semibold text-foreground">
					Trending coins
				</h2>
				<div className="flex items-center gap-1">
					<Button
						variant="secondary"
						size="icon"
						onClick={scrollPrev}
						disabled={!canScrollPrev}
						className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground disabled:opacity-30"
					>
						<ChevronLeft className="h-4 w-4" />
					</Button>
					<Button
						variant="secondary"
						size="icon"
						onClick={scrollNext}
						disabled={!canScrollNext}
						className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground disabled:opacity-30"
					>
						<ChevronRight className="h-4 w-4" />
					</Button>
				</div>
			</div>

			{/* Embla carousel */}
			<div ref={emblaRef} className="overflow-hidden">
				<div className="flex -ml-4">
					{carouselTokens.map((token) => {
						const mcap = formatCompactMarketCap(token.marketCap);

						return (
							<div key={token.id} className={SLIDE_CLASSES}>
								<Link
									href={`/token/${token.id}`}
									className="block group"
								>
									{/* Banner card — pump.fun style */}
									<div className="relative w-full h-44 rounded-xl overflow-hidden bg-[#1a1a1a]">
										{/* Token image as background with hover zoom */}
										<div className="absolute inset-0 transition-transform duration-300 group-hover:scale-110">
											<BannerImage
												src={token.imageUrl}
												alt={token.name}
												symbol={token.symbol}
											/>
										</div>

										{/* Gradient overlay for text readability */}
										<div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/30 to-transparent" />

										{/* Overlaid info at bottom */}
										<div className="absolute bottom-0 left-0 right-0 p-3.5">
											<p className="text-white text-xl font-bold leading-tight mb-0.5">
												{mcap}
											</p>
											<div className="flex items-center gap-1.5">
												<span className="text-white/90 text-sm font-medium truncate">
													{token.name}
												</span>
												<span className="text-white/50 text-xs truncate">
													{token.symbol}
												</span>
											</div>
										</div>
									</div>
								</Link>

								{/* Description below the card */}
								{token.description && (
									<p className="text-xs text-muted-foreground mt-2.5 line-clamp-2 leading-relaxed">
										{token.description}
									</p>
								)}
							</div>
						);
					})}
				</div>
			</div>
		</section>
	);
}

/**
 * BannerImage — fills the card as a cover image with fallback.
 */
function BannerImage({
	src,
	alt,
	symbol,
}: {
	src?: string | null;
	alt: string;
	symbol: string;
}) {
	const [hasError, setHasError] = useState(false);

	const getImageUrl = (url?: string | null): string | null => {
		if (!url) return null;
		if (url.startsWith("http://") || url.startsWith("https://")) return url;
		if (url.startsWith("/")) return url;
		if (url.startsWith("ipfs://"))
			return url.replace("ipfs://", "https://ipfs.io/ipfs/");
		return `/api/images/${url}`;
	};

	const imageUrl = getImageUrl(src);

	if (!imageUrl || hasError) {
		return (
			<div className="absolute inset-0 bg-linear-to-br from-[#1a1a1a] to-[#2a2a2a] flex items-center justify-center">
				<div className="flex flex-col items-center gap-1.5 text-muted-foreground/40">
					<Coins className="h-10 w-10" />
					<span className="text-sm font-semibold">{symbol}</span>
				</div>
			</div>
		);
	}

	return (
		<Image
			src={imageUrl}
			alt={alt}
			fill
			className="object-cover"
			sizes="(max-width: 640px) 85vw, (max-width: 1024px) 50vw, (max-width: 1536px) 33vw, (max-width: 1920px) 25vw, 20vw"
			onError={() => setHasError(true)}
		/>
	);
}
