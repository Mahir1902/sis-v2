import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "hushed-bass-123.convex.cloud",
      },
    ],
  },
};

export default nextConfig;
