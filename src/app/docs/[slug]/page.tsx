import { Metadata } from "next";
import { notFound } from "next/navigation";

interface DocPageProps {
	params: Promise<{ slug: string }>;
}

interface DocData {
	title: string;
	slug: string;
	content: string;
	updatedAt?: string;
}

interface SeoData {
	pageTitle?: string;
	metaDescription?: string;
	keywords?: string[];
	canonicalUrl?: string;
	robots?: string;
	ogTitle?: string;
	ogDescription?: string;
	ogImage?: string;
	ogType?: string;
	ogUrl?: string;
	twitterCard?: string;
	twitterTitle?: string;
	twitterDescription?: string;
	twitterImage?: string;
	schemaJson?: Record<string, unknown>;
}

const API_BASE =
	process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// Generate metadata for SEO
export async function generateMetadata({
	params,
}: DocPageProps): Promise<Metadata> {
	const { slug } = await params;

	try {
		// Fetch page data and SEO data in parallel
		const [pageRes, seoRes] = await Promise.all([
			fetch(`${API_BASE}/api/v1/pages/${slug}`, {
				next: { revalidate: 3600 },
			}),
			fetch(`${API_BASE}/api/v1/pages/${slug}/seo`, {
				next: { revalidate: 3600 },
			}),
		]);

		if (!pageRes.ok) {
			return { title: "Page Not Found" };
		}

		const pageJson = await pageRes.json();
		const pageData: DocData | null = pageJson?.data ?? null;

		let seoData: SeoData | null = null;
		if (seoRes.ok) {
			const seoJson = await seoRes.json();
			seoData = seoJson?.data ?? null;
		}

		const title = seoData?.pageTitle || pageData?.title || "HypeMint";
		const description =
			seoData?.metaDescription ||
			`${pageData?.title || slug} — HypeMint`;

		return {
			title: `${title} | HypeMint`,
			description,
			keywords: seoData?.keywords,
			robots: seoData?.robots,
			alternates: seoData?.canonicalUrl
				? { canonical: seoData.canonicalUrl }
				: undefined,
			openGraph: {
				title: seoData?.ogTitle || title,
				description: seoData?.ogDescription || description,
				images: seoData?.ogImage ? [seoData.ogImage] : undefined,
				type: (seoData?.ogType as "website" | "article") || "website",
				url: seoData?.ogUrl || undefined,
			},
			twitter: {
				card:
					(seoData?.twitterCard as
						| "summary"
						| "summary_large_image") || "summary_large_image",
				title: seoData?.twitterTitle || title,
				description: seoData?.twitterDescription || description,
				images: seoData?.twitterImage
					? [seoData.twitterImage]
					: undefined,
			},
		};
	} catch (error) {
		console.error("Error fetching page metadata:", error);
		return { title: "HypeMint" };
	}
}

// Fetch page data server-side
async function getPageData(slug: string): Promise<DocData | null> {
	try {
		const response = await fetch(`${API_BASE}/api/v1/pages/${slug}`, {
			next: { revalidate: 3600 },
			cache: "force-cache",
		});

		if (!response.ok) return null;

		const json = await response.json();
		return json?.data ?? null;
	} catch (error) {
		console.error("Error fetching page data:", error);
		return null;
	}
}

// Fetch SEO schema for structured data
async function getSeoSchema(
	slug: string,
): Promise<Record<string, unknown> | null> {
	try {
		const response = await fetch(
			`${API_BASE}/api/v1/pages/${slug}/seo`,
			{
				next: { revalidate: 3600 },
				cache: "force-cache",
			},
		);

		if (!response.ok) return null;

		const json = await response.json();
		return json?.data?.schemaJson ?? null;
	} catch (error) {
		return null;
	}
}

export default async function DocPage({ params }: DocPageProps) {
	const { slug } = await params;

	const [pageData, schemaJson] = await Promise.all([
		getPageData(slug),
		getSeoSchema(slug),
	]);

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
