import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { ViewportGuard } from "@/components/viewport-guard";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "JobPilot AI — Autonomous job hunting for India",
  description: "Discover, match, tailor and track job applications across India with an AI career agent.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Prevent zoom-out, which is what leaves the top of the page at a stale
  // scale while the bottom reflows (the iOS Safari half-painted artifact).
  minimumScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f9fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0e14" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.variable}>
        <ThemeProvider>{children}</ThemeProvider>
        <ViewportGuard />
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
