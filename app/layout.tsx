import type { Metadata } from "next";
import { Montserrat, Geist_Mono } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import NavTracker from "@/components/NavTracker";

export const metadata: Metadata = {
  title: "Croacia",
  description: "Sistema de gestión de trabajos",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body
        suppressHydrationWarning
        className={`${montserrat.variable} ${geistMono.variable} min-h-full flex flex-col`}
      >
        <NavTracker />
        {children}
      </body>
    </html>
  );
}
