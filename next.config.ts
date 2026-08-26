import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Product images live in Supabase Storage
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
};

export default nextConfig;
