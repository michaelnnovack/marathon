import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserSelector } from "@/components/UserSelector";
import { RaceCountdown } from "@/components/RaceCountdown";
import { HomeIcon, Cog6ToothIcon, CalendarIcon, ChartBarIcon } from "@heroicons/react/24/outline";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: 'swap',
  preload: true
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: 'swap',
  preload: false
});

export const metadata: Metadata = {
  title: "Marathon Trainer",
  description: "Personal marathon training coach",
  icons: {
    icon: "/bbm.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-[--background] text-[--foreground]`}>
        <div className="min-h-screen flex flex-col">
          <header className="sticky top-0 z-30 backdrop-blur bg-white/60 dark:bg-black/30 border-b border-black/10 dark:border-white/10">
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
              <Link href="/" className="font-semibold tracking-tight flex items-center gap-2">
                <Image src="/Running.png" alt="Running" width={36} height={36} className="sm:w-[54px] sm:h-[54px]" />
                <span className="hidden xs:inline sm:inline">Marathon</span>
              </Link>
              <nav className="hidden md:flex items-center gap-4 lg:gap-6 text-sm">
                <Link href="/" className="flex items-center gap-1.5 hover:underline">
                  <HomeIcon className="w-4 h-4" />
                  Dashboard
                </Link>
                <Link href="/plan" className="flex items-center gap-1.5 hover:underline">
                  <CalendarIcon className="w-4 h-4" />
                  Plan
                </Link>
                <Link href="/analyze" className="flex items-center gap-1.5 hover:underline">
                  <ChartBarIcon className="w-4 h-4" />
                  Analyze
                </Link>
                <Link href="/setup" className="flex items-center gap-1.5 hover:underline">
                  <Cog6ToothIcon className="w-4 h-4" />
                  Setup
                </Link>
              </nav>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="text-xs sm:text-sm hidden sm:block opacity-80"><RaceCountdown /></div>
                <div className="scale-90 sm:scale-100"><UserSelector /></div>
                <ThemeToggle />
              </div>
            </div>
            <nav className="md:hidden border-t border-black/10 dark:border-white/10 bg-white/40 dark:bg-black/20">
              <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-4 text-sm overflow-x-auto">
                <Link href="/" className="flex items-center gap-1.5 hover:underline whitespace-nowrap">
                  <HomeIcon className="w-4 h-4" />
                  Dashboard
                </Link>
                <Link href="/plan" className="flex items-center gap-1.5 hover:underline whitespace-nowrap">
                  <CalendarIcon className="w-4 h-4" />
                  Plan
                </Link>
                <Link href="/analyze" className="flex items-center gap-1.5 hover:underline whitespace-nowrap">
                  <ChartBarIcon className="w-4 h-4" />
                  Analyze
                </Link>
                <Link href="/setup" className="flex items-center gap-1.5 hover:underline whitespace-nowrap">
                  <Cog6ToothIcon className="w-4 h-4" />
                  Setup
                </Link>
              </div>
            </nav>
          </header>
          <main className="flex-1">
            <div className="max-w-6xl mx-auto px-4 py-6">{children}</div>
          </main>
          <footer className="border-t border-black/10 dark:border-white/10 py-6 text-xs text-center opacity-70">
            <a href="https://builtbymikey.com" target="_blank" rel="noopener noreferrer" className="hover:underline">builtbymikey.com</a>
          </footer>
        </div>
      </body>
    </html>
  );
}
