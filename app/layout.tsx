import type { Metadata } from "next"
import { Manrope } from "next/font/google"
import "./globals.css"

const wordmark = Manrope({ subsets: ["latin"], weight: ["300"], variable: "--font-wordmark" })

export const metadata: Metadata = {
  title: "Veritax UI",
  description: "Design system based on OpenAI apps-sdk-ui",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={wordmark.variable}>
      <body>{children}</body>
    </html>
  )
}
