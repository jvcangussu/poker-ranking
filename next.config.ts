import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
  async redirects() {
    return [
      {
        source: "/:groupCode/dashboard",
        destination: "/:groupCode/ranking",
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cidadedopoker.vtexassets.com",
        pathname: "/arquivos/**",
      },
    ],
  },
};

export default nextConfig;
