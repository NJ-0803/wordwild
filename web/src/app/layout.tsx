import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Inter, Inter_Tight, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { Nav } from "@/components/Nav";
import { ClerkProvider } from "@clerk/nextjs";
import { Account } from "@/components/Account";
import { QuickSaved } from "@/components/QuickSaved";
import { MetricsWatcher } from "@/components/MetricsWatcher";
import { DepthMount } from "@/components/DepthMount";
import { Sidebar } from "@/components/Sidebar";

// next/font self-hosts these at build time, so no visitor request goes to Google.
const serif = Instrument_Serif({ variable: "--font-serif", subsets: ["latin"], weight: "400" });
const inter = Inter({ variable: "--font-body", subsets: ["latin"] });
const tight = Inter_Tight({ variable: "--font-head", subsets: ["latin"] });
const mono = IBM_Plex_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Wordwild",
  description: "Learn English words by listening, understanding and using them. Your words grow a garden.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${serif.variable} ${inter.variable} ${tight.variable} ${mono.variable}`}>
      <head><script dangerouslySetInnerHTML={{ __html: `try{document.documentElement.dataset.theme=localStorage.getItem("ww.theme")==="light"?"light":"dark"}catch(e){document.documentElement.dataset.theme="dark"}` }} /></head>
      <body suppressHydrationWarning>
        <ClerkProvider>
          <StoreProvider>
            <MetricsWatcher />
            <QuickSaved />
            <DepthMount />
            <div className="shell">
              <Sidebar />
              <main className="wrap"><Account />{children}</main>
            </div>
            <Nav />
          </StoreProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
