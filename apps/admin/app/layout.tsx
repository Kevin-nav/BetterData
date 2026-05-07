import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Better Data Admin",
  description: "Secured operations dashboard for Better Data."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
