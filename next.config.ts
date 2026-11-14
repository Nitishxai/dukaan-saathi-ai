import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep fresh build output separate from existing OneDrive-synced artifacts.
  distDir: process.env.DUKAAN_BUILD_DIR || ".next-pilot",
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  webpack(config) {
    // Run the installed Tailwind loader under webpack too (no IPC worker required).
    config.module.rules.push({ test: /globals\.css$/, use: ['@tailwindcss/turbopack'] });
    return config;
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
