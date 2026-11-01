import type { Metadata } from "next";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geist = localFont({
  src: "./fonts/geist.woff2",
  variable: "--font-geist",
  display: "swap",
});
const title = "Zen: An agent inside your dashboard";
const description =
  "An interactive prototype for discovering capabilities, exploring sample account data, and reviewing actions through conversation.";
const sharingImage = {
  url: "/og/zen-og-v1.png",
  width: 1730,
  height: 909,
  alt: "Zen: From question to next step. An agent inside your dashboard, with an illustrative sample workflow.",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://zen-workspace-preview.vercel.app"),
  title,
  description,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Zen",
    title,
    description,
    images: [sharingImage],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [sharingImage],
  },
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={geist.variable}>
      <body>
        <TooltipProvider delayDuration={350}>
          {children}
          <Toaster richColors position="bottom-right" />
        </TooltipProvider>
      </body>
    </html>
  );
}
