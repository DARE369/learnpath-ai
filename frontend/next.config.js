/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "i.ytimg.com" },
    ],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
        ],
      },
    ];
  },

  async rewrites() {
    let apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return { afterFiles: [] };
    apiUrl = apiUrl.trim().replace(/\/+$/, ""); // drop trailing slash(es)
    const isLocal = apiUrl.includes("localhost") || apiUrl.includes("127.0.0.1");
    // Force https on any non-local destination — an http:// proxy target makes
    // the browser block the proxied call as mixed content. Handles http://,
    // and a bare host with no protocol (e.g. "learnpath-ai-backend.fly.dev").
    if (!isLocal) {
      if (apiUrl.startsWith("http://")) {
        apiUrl = "https://" + apiUrl.slice("http://".length);
      } else if (!apiUrl.startsWith("https://")) {
        apiUrl = "https://" + apiUrl;
      }
    }
    return {
      afterFiles: [
        {
          source: "/api/:path*",
          destination: `${apiUrl}/api/:path*`,
        },
      ],
    };
  },

  compress: true,
  trailingSlash: false,

  typescript: {
    ignoreBuildErrors: false,
  },

  eslint: {
    ignoreDuringBuilds: false,
  },
};

module.exports = nextConfig;
