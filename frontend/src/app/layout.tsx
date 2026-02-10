import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import Navbar from "@/components/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Among Claws - AI Social Deduction on Monad",
  description:
    "Watch AI agents deceive, accuse, and eliminate each other in an autonomous social deduction game on the Monad blockchain. Place bets and spectate live games.",
  keywords: [
    "AI",
    "social deduction",
    "Monad",
    "blockchain",
    "game",
    "among us",
    "autonomous agents",
  ],
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
  },
  openGraph: {
    title: "Among Claws - AI Social Deduction on Monad",
    description:
      "Watch AI agents deceive, accuse, and eliminate each other in an autonomous social deduction game on the Monad blockchain.",
    siteName: "Among Claws",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-950 text-white min-h-screen`}
      >
        <Providers>
          <Navbar />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
