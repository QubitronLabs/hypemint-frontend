import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */
	reactCompiler: true,
	images: {
		dangerouslyAllowSVG: true,
		remotePatterns: [
			{
				protocol: "http",
				hostname: "localhost",
				port: "4000",
				pathname: "/uploads/**",
			},
			{
				protocol: "http",
				hostname: "0.0.0.0",
				port: "4000",
				pathname: "/uploads/**",
			},
			{
				protocol: "http",
				hostname: "localhost",
				pathname: "/**",
			},
			{
				protocol: "https",
				hostname: "**",
			},
		],
		// Allow unoptimized images for development
		unoptimized: process.env.NODE_ENV === "development",
	},
	htmlLimitedBots:
		/googlebot|bingbot|yandex|baiduspider|facebookexternalhit|twitterbot|rogerbot|linkedinbot|embedly|quora\ link\ preview|showyoubot|outbrain|pinterest\/0\.|pinterestbot|slackbot|vkShare|W3C_Validator|discordbot|whatsapp/i,

	async headers() {
		return [
			{
				source: "/:path*",
				headers: [{ key: "X-Accel-Buffering", value: "no" }],
			},
		];
	},
};

export default nextConfig;
