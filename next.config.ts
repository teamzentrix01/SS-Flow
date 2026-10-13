import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: false,
  partialPrefetching: false,
  reactCompiler: true,
  serverExternalPackages: ["@prisma/client", "@node-rs/argon2"],
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
