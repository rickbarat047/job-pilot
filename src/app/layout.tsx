import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "JobPilot AI — Autonomous job hunting for India",
  description: "Discover, match, tailor and track job applications across India with an AI career agent.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
