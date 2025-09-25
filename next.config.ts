import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Enable static optimization
  trailingSlash: false,
  // Disable x-powered-by header
  poweredByHeader: false,
};

export default nextConfig;
