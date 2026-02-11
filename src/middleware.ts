import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js Middleware
 *
 * Injects the current pathname into the request headers so that
 * the root layout's generateMetadata() can determine which route
 * is being rendered and return the correct SEO metadata.
 *
 * Header: x-pathname → e.g. "/token/abc123", "/user/0x...", "/docs/faq"
 */
export function middleware(request: NextRequest) {
	const requestHeaders = new Headers(request.headers);
	requestHeaders.set("x-pathname", request.nextUrl.pathname);

	return NextResponse.next({
		request: {
			headers: requestHeaders,
		},
	});
}

export const config = {
	matcher: [
		/*
		 * Match all routes EXCEPT:
		 * - _next/static (static files)
		 * - _next/image (image optimization)
		 * - favicon.ico and other static assets
		 */
		"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)",
	],
};
