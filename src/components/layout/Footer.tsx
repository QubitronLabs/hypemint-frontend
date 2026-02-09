"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface FooterPage {
	title: string;
	slug: string;
}

export function Footer() {
	const [pages, setPages] = useState<FooterPage[]>([]);

	useEffect(() => {
		async function fetchPages() {
			try {
				const res = await fetch(`${API_BASE_URL}/api/v1/pages`);
				const json = await res.json();
				if (json?.data && Array.isArray(json.data)) {
					setPages(json.data);
				}
			} catch {
				// Silently fail — footer is non-critical
			}
		}
		fetchPages();
	}, []);

	return (
		<footer className="md:ml-17.5 w-full md:w-[calc(100vw-70px)] border-t border-border/40 bg-background/80 backdrop-blur-sm">
			<div className="max-w-[1600px] mx-auto px-4 md:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
				{/* Copyright */}
				<p className="text-xs text-muted-foreground">
					&copy; HypeMint {new Date().getFullYear()}
				</p>

				{/* Page links */}
				{pages.length > 0 && (
					<nav className="flex flex-wrap items-center gap-1 text-xs">
						{pages.map((page, i) => (
							<span key={page.slug} className="flex items-center">
								{i > 0 && (
									<span className="text-muted-foreground/40 mx-1.5">|</span>
								)}
								<Link
									href={`/docs/${page.slug}`}
									className="text-primary/80 hover:text-primary transition-colors"
								>
									{page.title}
								</Link>
							</span>
						))}
					</nav>
				)}
			</div>
		</footer>
	);
}
