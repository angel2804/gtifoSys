import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { SupabaseSync } from "@/components/supabase-sync";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GrifoSys",
  description: "Sistema de gestión para estación de servicios",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Aplica el tema guardado ANTES del primer pintado para evitar el
            "flash" de modo claro (script externo en /public para no renderizar
            un <script> inline dentro del árbol de React). */}
        <Script src="/theme-init.js" strategy="beforeInteractive" />
        {children}
        <SupabaseSync />
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
