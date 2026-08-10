import type { Metadata } from "next"
import { Manrope } from "next/font/google"
import Script from "next/script"
import "./globals.css"

const wordmark = Manrope({ subsets: ["latin"], weight: ["300"], variable: "--font-wordmark" })

export const metadata: Metadata = {
  title: "Veritax UI",
  description: "Local file generator."
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={wordmark.variable} suppressHydrationWarning>
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
        {children}
      </body>
    </html>
  )
}
