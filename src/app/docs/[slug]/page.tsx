/**
 * Docs Page
 *
 * SEO metadata handled centrally by app/layout.tsx
 * @see src/lib/seo/router.ts → handleDocsPage()
 *
 * This component only renders page content + JSON-LD structured data.
 */

import { notFound } from "next/navigation";
import type { SeoPageData } from "@/types/seo";

interface DocPageProps {
	params: Promise<{ slug: string }>;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// Fetch page data server-side
async function getPageData(slug: string): Promise<SeoPageData | null> {
	try {
		const response = await fetch(`${API_BASE}/api/v1/pages/${slug}`, {
			cache: "no-store",
		});

		if (!response.ok) return null;

		const json = await response.json();
		return json?.data ?? null;
	} catch {
		console.error("Error fetching page data");
		return null;
	}
}

// Fetch SEO schema for structured data
async function getSeoSchema(
	slug: string,
): Promise<Record<string, unknown> | null> {
	try {
		const response = await fetch(`${API_BASE}/api/v1/pages/${slug}/seo`, {
			cache: "no-store",
		});

		if (!response.ok) return null;

		const json = await response.json();
		return json?.data?.schemaJson ?? null;
	} catch {
		return null;
	}
}

export default async function DocPage({ params }: DocPageProps) {
	const { slug } = await params;

	const [pageResult, schemaResult] = await Promise.allSettled([
		getPageData(slug),
		getSeoSchema(slug),
	]);

	const pageData =
		pageResult.status === "fulfilled" ? pageResult.value : null;
	const schemaJson =
		schemaResult.status === "fulfilled" ? schemaResult.value : null;

	if (!pageData) {
		notFound();
	}

	return (
		<div className="container mx-auto px-4 py-8 max-w-4xl">
			{/* Structured data */}
			{schemaJson && (
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{
						__html: JSON.stringify(schemaJson),
					}}
				/>
			)}

			<article
				className="
					prose prose-invert prose-zinc 
					max-w-none
					prose-headings:text-white
					prose-h1:text-4xl prose-h1:font-bold prose-h1:mb-4 prose-h1:mt-8
					prose-h2:text-3xl prose-h2:font-semibold prose-h2:mb-3 prose-h2:mt-6
					prose-h3:text-2xl prose-h3:font-medium prose-h3:mb-2 prose-h3:mt-4
					prose-p:text-zinc-300 prose-p:mb-4 prose-p:leading-relaxed
					prose-a:text-primary prose-a:no-underline hover:prose-a:underline
					prose-strong:text-white prose-strong:font-semibold
					prose-code:bg-zinc-800 prose-code:px-1.5 prose-code:py-0.5 
					prose-code:rounded prose-code:text-sm prose-code:text-zinc-100
					prose-code:before:content-[''] prose-code:after:content-['']
					prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800
					prose-ul:ml-6 prose-ul:mb-4
					prose-ol:ml-6 prose-ol:mb-4
					prose-li:mb-2 prose-li:text-zinc-300
					prose-blockquote:border-l-4 prose-blockquote:border-primary 
					prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-zinc-400
					prose-img:rounded-lg prose-img:my-4
					prose-table:w-full prose-table:mb-4
					prose-th:bg-zinc-800 prose-th:p-3 prose-th:text-left prose-th:font-semibold
					prose-td:border prose-td:border-zinc-700 prose-td:p-3 prose-td:text-zinc-300
					prose-hr:border-zinc-700
				"
			>
				{/* Header */}
				<header className="mb-8 border-b border-zinc-800 pb-6 not-prose">
					<h1 className="text-4xl font-bold mb-2 text-white">
						{pageData.title}
					</h1>
					{pageData.updatedAt && (
						<p className="text-sm text-muted-foreground">
							Last updated:{" "}
							{new Date(pageData.updatedAt).toLocaleDateString(
								"en-US",
								{
									year: "numeric",
									month: "long",
									day: "numeric",
								},
							)}
						</p>
					)}
				</header>

				{/* Content */}
				<div dangerouslySetInnerHTML={{ __html: pageData.content }} />
			</article>
		</div>
	);
}
