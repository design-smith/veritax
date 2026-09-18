import type { Metadata } from "next"
import { IBM_Plex_Mono, Newsreader } from "next/font/google"
import Script from "next/script"
import "./globals.css"
import AnalyticsProvider from "@/components/AnalyticsProvider"

const display = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
})

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Veritax",
  description: "Global company data for transfer-pricing work.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Script id="strip-extension-hydration-attrs" strategy="beforeInteractive">
          {`
            (() => {
              const shouldStrip = name => name === "jf-observer-attached" || name.startsWith("jf-ext-") || name.startsWith("jf-");
              const cleanElement = el => {
                if (!el || !el.attributes) return;
                for (const attr of Array.from(el.attributes)) {
                  if (shouldStrip(attr.name)) el.removeAttribute(attr.name);
                }
              };
              const cleanTree = root => {
                cleanElement(root);
                if (root.querySelectorAll) root.querySelectorAll("*").forEach(cleanElement);
              };
              const install = () => {
                cleanTree(document.documentElement);
                const observer = new MutationObserver(mutations => {
                  for (const mutation of mutations) {
                    if (mutation.type === "attributes") cleanElement(mutation.target);
                    mutation.addedNodes.forEach(node => {
                      if (node.nodeType === 1) cleanTree(node);
                    });
                  }
                });
                observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true });
                window.addEventListener("load", () => setTimeout(() => observer.disconnect(), 3000), { once: true });
              };
              if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
              else install();
            })();
          `}
        </Script>
        <AnalyticsProvider />
        {children}
      </body>
    </html>
  )
}
