import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://jobpilot-ai-sand.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard", "/jobs", "/applications", "/profile", "/cv-builder", "/automation", "/companies", "/interviews", "/settings", "/onboarding", "/api/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
