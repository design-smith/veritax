import type { Metadata } from "next";
import { cn } from "@/lib/utils";
import "@/style/globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Veritax",
  description: "The Intercompany Record",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "bg-background font-sans antialiased",
        )}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
