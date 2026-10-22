import type { Metadata, Viewport } from "next";
import { Inter, Lora } from "next/font/google";
import { AppHeader } from "@/components/layout/AppHeader";
import { StorageNotice } from "@/components/layout/StorageNotice";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const lora = Lora({ variable: "--font-lora", subsets: ["latin"], weight: ["500", "600"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "DesignSync QA | Arnifi", template: "%s | DesignSync QA" },
  description: "Compare a Figma design screenshot with the developed website, review the differences and track fixes. Internal prototype.",
  // Internal tool for unreleased designs (PRD §16): keep it out of search engines.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${inter.variable} ${lora.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <TooltipProvider delayDuration={300}>
          <a
            href="#main"
            className="sr-only z-50 rounded-control bg-white px-4 py-2 text-p3 font-medium text-brand focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
          >
            Skip to content
          </a>
          <AppHeader />
          <StorageNotice />
          <main id="main" className="flex flex-1 flex-col">
            {children}
          </main>
        </TooltipProvider>
      </body>
    </html>
  );
}
