import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // The research routes call out to the Anthropic API and can run long.
    serverActions: { bodySizeLimit: "2mb" },
  },
  /**
   * The planner is one generated HTML file, not a React route.
   *
   * public/planner.html is built by scripts/build-planner.mjs with the engine
   * inlined, and it is the same bytes as the copy handed out on a stick. A
   * rewrite serves it at /planner so the URL in the nav is the URL people
   * bookmark, and so the file:// copy and the hosted one never diverge.
   *
   * Links to it are plain <a>, not next/link: this is outside the router, and
   * a client-side navigation to it would fetch an RSC payload that is not
   * there and then hard-navigate anyway.
   */
  async rewrites() {
    return [{ source: "/planner", destination: "/planner.html" }];
  },
  /**
   * Serving out of public/ leaves /planner.html reachable as well, which is
   * the same page on two URLs. Redirects run before rewrites and the rewritten
   * path is not re-examined, so this sends people to the canonical one without
   * bouncing off the rewrite above.
   */
  async redirects() {
    return [{ source: "/planner.html", destination: "/planner", permanent: true }];
  },
};

export default nextConfig;
