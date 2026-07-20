import type { Metadata } from "next"
import { Jost } from "next/font/google"
import "./globals.css"

const jost = Jost({ subsets: ["latin"], weight: ["300"], variable: "--font-wordmark" })

export const metadata: Metadata = {
  title: "Veritax UI",
  description: "Design system based on OpenAI apps-sdk-ui",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jost.variable}>
      <body>{children}</body>
    </html>
  )
}
