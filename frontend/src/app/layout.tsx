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
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
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
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased ambient-bg text-white min-h-screen relative`}
      >
        {/* Fixed ambient orbs - deep ocean glow */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          {/* Large red/crimson orb - top left */}
          <div
            className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full opacity-[0.035]"
            style={{
              background:
                "radial-gradient(circle, rgba(239, 68, 68, 1) 0%, rgba(239, 68, 68, 0.4) 40%, transparent 70%)",
              filter: "blur(80px)",
            }}
          />
          {/* Purple orb - top right */}
          <div
            className="absolute -top-20 -right-40 w-[600px] h-[600px] rounded-full opacity-[0.03]"
            style={{
              background:
                "radial-gradient(circle, rgba(168, 85, 247, 1) 0%, rgba(168, 85, 247, 0.4) 40%, transparent 70%)",
              filter: "blur(100px)",
            }}
          />
          {/* Cyan orb - center right */}
          <div
            className="absolute top-1/3 -right-20 w-[400px] h-[400px] rounded-full opacity-[0.025]"
            style={{
              background:
                "radial-gradient(circle, rgba(34, 211, 238, 1) 0%, rgba(34, 211, 238, 0.3) 40%, transparent 70%)",
              filter: "blur(80px)",
            }}
          />
          {/* Deep ocean blue orb - bottom center */}
          <div
            className="absolute -bottom-40 left-1/3 w-[700px] h-[700px] rounded-full opacity-[0.03]"
            style={{
              background:
                "radial-gradient(circle, rgba(14, 165, 233, 1) 0%, rgba(14, 165, 233, 0.3) 40%, transparent 70%)",
              filter: "blur(120px)",
            }}
          />
          {/* Small orange accent orb - mid-left */}
          <div
            className="absolute top-2/3 -left-20 w-[300px] h-[300px] rounded-full opacity-[0.02]"
            style={{
              background:
                "radial-gradient(circle, rgba(251, 146, 60, 1) 0%, rgba(251, 146, 60, 0.3) 40%, transparent 70%)",
              filter: "blur(60px)",
            }}
          />
          {/* Subtle crimson pulse - center */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-[0.015] animate-pulse"
            style={{
              background:
                "radial-gradient(circle, rgba(239, 68, 68, 0.5) 0%, transparent 60%)",
              filter: "blur(100px)",
            }}
          />
        </div>

        {/* Content layer */}
        <div className="relative z-10">
          <Providers>
            <Navbar />
            <main>{children}</main>
          </Providers>
        </div>
      </body>
    </html>
  );
}
