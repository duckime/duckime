import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.animepahe.pw" },
      { protocol: "https", hostname: "s4.anilist.co" },
      { protocol: "https", hostname: "img.animepahe.ru" },
    ],
  },
};

export default nextConfig;
