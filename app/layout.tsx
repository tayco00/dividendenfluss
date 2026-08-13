import type { Metadata } from "next";
import { headers } from "next/headers";
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

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const rawHost = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const host = rawHost.replace(/[^a-zA-Z0-9.:[\]-]/g, "") || "localhost:3000";
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto");
  const protocol = forwardedProtocol === "http" || host.startsWith("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;
  const title = "Dividendenfluss — dein lokaler Dividendentracker";
  const description = "Portfolio, Ausschüttungen und Dividendenziele privat auf deinem Gerät verfolgen.";

  return {
    title,
    description,
    metadataBase: new URL(origin),
    icons: {
      icon: [{ url: "/favicon.png?v=3", type: "image/png", sizes: "1254x1254" }],
      shortcut: "/favicon.png?v=3",
    },
    openGraph: {
      title,
      description,
      type: "website",
      locale: "de_DE",
      images: [{ url: `${origin}/og.png`, width: 1733, height: 909, alt: "Dividendenfluss — dein lokaler Dividendentracker" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
