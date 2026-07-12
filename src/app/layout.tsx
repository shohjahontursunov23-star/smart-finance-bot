import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Smart Finance Bot — Moliyaviy Avtomatlashtirish",
  description:
    "Shaxsiy moliyaviy avtomatlashtirish tizimi. 50/30/20 qoidasi bo'yicha byudjet taqsimoti, SMS tahlil, va Telegram bot integratsiyasi.",
  keywords: [
    "Smart Finance",
    "Moliya",
    "Budget",
    "50/30/20",
    "Telegram Bot",
    "O'zbekiston",
  ],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
      </body>
    </html>
  );
}