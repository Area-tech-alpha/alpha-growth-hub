import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/providers/providers";
import AppShell from "@/components/AppShell";
import { Toaster } from "@/components/ui/sonner";
import GlobalToastListeners from "@/components/GlobalToastListeners";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: typeof process !== 'undefined' && process.env.NEXTAUTH_URL ? new URL(process.env.NEXTAUTH_URL) : undefined,
  title: {
    default: "Growth Hub - Assessoria Alpha",
    template: "%s | Growth Hub",
  },
  description: "Plataforma de leilões e compra de leads da Assessoria Alpha.",
  keywords: [
    "assessoria alpha",
    "growth hub",
    "leilões",
    "leads",
    "comprar leads",
  ],
  applicationName: "Growth Hub",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/",
    siteName: "Growth Hub - Assessoria Alpha",
    title: "Growth Hub - Assessoria Alpha",
    description: "Plataforma de leilões e compra de leads da Assessoria Alpha.",
    images: [
      {
        url: "/vercel.svg",
        width: 1200,
        height: 630,
        alt: "Growth Hub - Assessoria Alpha",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Growth Hub - Assessoria Alpha",
    description: "Plataforma de leilões e compra de leads da Assessoria Alpha.",
    images: ["/vercel.svg"],
  },
  icons: {
    icon: "/favicon.ico",
  },
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <AppShell>
            {children}
          </AppShell>
          <GlobalToastListeners />
        </Providers>
        <Toaster />
      </body>
    </html>
  );
}
