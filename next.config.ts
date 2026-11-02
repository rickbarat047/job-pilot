import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["unpdf", "mammoth", "pdf-lib", "docx", "nodemailer", "word-extractor", "pg", "@supabase/supabase-js", "tesseract.js", "@napi-rs/canvas", "pdfjs-dist"],
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
