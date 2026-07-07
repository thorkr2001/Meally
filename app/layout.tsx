import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Meally",
  description: "Your personalized AI food planner and calorie tracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable} h-full`}>
      <body className="min-h-full bg-app-bg font-sans text-ink antialiased">
        <div className="flex min-h-full flex-col items-center sm:px-5 sm:py-8 md:py-10">
          <AppShell>{children}</AppShell>
        </div>
      </body>
    </html>
  );
}
