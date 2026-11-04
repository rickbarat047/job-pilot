import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  serverExternalPackages: ["unpdf", "mammoth", "pdf-lib", "docx", "nodemailer", "word-extractor", "pg", "@supabase/supabase-js", "tesseract.js", "@napi-rs/canvas", "pdfjs-dist", "imapflow", "mailparser"],
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default withSentryConfig(nextConfig, {
  // Only upload source maps when SENTRY_AUTH_TOKEN is set; otherwise no-op.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
});
