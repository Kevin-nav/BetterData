import type { Metadata } from "next";
import { DM_Sans, Space_Grotesk } from "next/font/google";

import { ConvexClientProvider } from "./lib/convex";
import { AdminAuthProvider } from "./lib/auth";
import { ToastProvider } from "./components/Toast";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Better Data Admin",
  description: "Secured operations dashboard for Better Data.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${spaceGrotesk.variable}`}
    >
      <body>
        <AdminAuthProvider>
          <ConvexClientProvider>
            <ToastProvider>{children}</ToastProvider>
          </ConvexClientProvider>
        </AdminAuthProvider>
      </body>
    </html>
  );
}
