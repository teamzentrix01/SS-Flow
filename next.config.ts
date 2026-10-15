import type { NextConfig } from "next";

const deskRouteRedirects = [
  ["/settings/users/:path*", "/users/:path*"],
  ["/people/employees/:path*", "/employees/:path*"],
  ["/masters/categories/:path*", "/categories/:path*"],
  ["/masters/products/:path*", "/products/:path*"],
  ["/purchasing/suppliers/:path*", "/suppliers/:path*"],
  ["/purchasing/orders/:path*", "/purchase-orders/:path*"],
  ["/purchasing/requisitions/:path*", "/requisitions/:path*"],
  ["/purchasing/receipts/:path*", "/receipts/:path*"],
] as const;

const nextConfig: NextConfig = {
  async redirects() {
    return deskRouteRedirects.map(([source, destination]) => ({
      source,
      destination,
      permanent: true,
    }));
  },
  cacheComponents: false,
  partialPrefetching: false,
  reactCompiler: true,
  serverExternalPackages: ["@prisma/client", "@node-rs/argon2", "nodemailer"],
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
