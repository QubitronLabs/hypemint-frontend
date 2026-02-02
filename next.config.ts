import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Disable React compiler in production to prevent code splitting issues with Dynamic SDK
  experimental: {
    optimizePackageImports: ["@dynamic-labs/sdk-react-core"],
  },
  images: {
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
};

export default nextConfig;
