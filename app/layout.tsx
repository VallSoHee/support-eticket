import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { BRAND } from "@/lib/brand";
import { THEME_COOKIE, parseThemeCookie } from "@/lib/theme";
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
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description: "Helpdesk e-ticket dengan chatbot dan live chat petugas,",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Warna tema dari cookie browser dipasang di HTML dari server -> tidak ada kedipan warna bawaan.
  const themeColor = parseThemeCookie((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      style={themeColor ? ({ "--color-brand": themeColor } as React.CSSProperties) : undefined}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
