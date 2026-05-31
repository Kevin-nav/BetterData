import type { Metadata } from "next";
import { DM_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./lib/AuthContext";
import { PostHogProvider } from "./lib/PostHogProvider";

const siteUrl = new URL("https://betterdatagh.com");
const siteTitle = "Better Data - Better Data Bundle Offers in Ghana";
const siteDescription =
  "Better Data helps customers in Ghana buy affordable MTN, Telecel, and AirtelTigo data bundles with a smooth Mobile Money purchase experience.";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["300", "400", "500", "600", "700"],
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: siteUrl,
  applicationName: "Better Data",
  title: {
    default: siteTitle,
    template: "%s | Better Data",
  },
  description: siteDescription,
  keywords: [
    "Better Data",
    "data bundles Ghana",
    "cheap data bundles Ghana",
    "MTN data bundles",
    "Telecel data bundles",
    "AirtelTigo data bundles",
    "Mobile Money data bundles",
    "buy data online Ghana",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_GH",
    url: "/",
    siteName: "Better Data",
    title: siteTitle,
    description: siteDescription,
    images: [
      {
        url: "/hero-bg.png",
        width: 1200,
        height: 630,
        alt: "Better Data mobile data bundle purchase experience",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/hero-bg.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t)}else if(window.matchMedia('(prefers-color-scheme:dark)').matches){document.documentElement.setAttribute('data-theme','dark')}}catch(e){}})()`,
          }}
        />
      </head>
      <body className={`${dmSans.variable} ${spaceGrotesk.variable}`}>
        <PostHogProvider>
          <AuthProvider>{children}</AuthProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
