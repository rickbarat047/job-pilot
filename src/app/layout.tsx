import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { ViewportGuard } from "@/components/viewport-guard";
import { Toaster } from "sonner";
import { CookieConsent } from "@/components/cookie-consent";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { InstallPrompt } from "@/components/install-prompt";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://jobpilot-ai-sand.vercel.app"),
  title: {
    default: "JobPilot AI — Autonomous job hunting for India",
    template: "%s — JobPilot AI",
  },
  description: "Discover, match, tailor and track job applications across India with an AI career agent.",
  openGraph: {
    title: "JobPilot AI — Your next opportunity. Already in motion.",
    description: "Discover relevant jobs across India, create tailored applications, and manage your entire job search with an AI career assistant that keeps you in control.",
    type: "website",
    siteName: "JobPilot AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "JobPilot AI — Your next opportunity. Already in motion.",
    description: "An AI career assistant for India — approval-first, CV-true, in your control.",
  },
  alternates: { canonical: "/" },
  verification: {
    google: "_D_v_lDkVdskxKpdOc3hOPlw98tjKpZfA1mxGG6scaM",
  },
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
  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#087F68" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="JobPilot AI" />
        <link rel="apple-touch-icon" href="/icon.svg" />
        {plausibleDomain ? (
          <script defer data-domain={plausibleDomain} src="https://plausible.io/js/script.js" />
        ) : null}
      </head>
      <body className={inter.variable}>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:text-sm focus:font-medium"
        >
          Skip to content
        </a>
        <ThemeProvider>{children}</ThemeProvider>
        <ViewportGuard />
        <Toaster richColors position="top-right" />
        <CookieConsent />
        <ServiceWorkerRegister />
        <InstallPrompt />
      </body>
    </html>
  );
}
