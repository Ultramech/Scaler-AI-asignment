/**
 * When API_PROXY_TARGET is set (the Vercel deployment), the browser talks only to its own origin: requests to /api/*
 * are forwarded to the API server-side. That avoids cross-site requests (CORS, extensions or networks that block them).
 * Locally the variable is unset and the app calls the API directly (NEXT_PUBLIC_API_URL, default http://localhost:8000).
 */
const target = (process.env.API_PROXY_TARGET || "").replace(/\/$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return target ? [{ source: "/api/:path*", destination: `${target}/:path*` }] : [];
  },
};

export default nextConfig;
