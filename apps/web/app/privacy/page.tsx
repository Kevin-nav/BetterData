import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Learn how Better Data collects, uses, shares, and protects personal information for mobile data bundle purchases, payments, accounts, and support.",
  alternates: {
    canonical: "/legal#privacy",
  },
  openGraph: {
    type: "article",
    url: "/legal#privacy",
    title: "Privacy Policy | Better Data",
    description:
      "Better Data privacy information for mobile data bundle customers, account holders, guests, and agents.",
    siteName: "Better Data",
  },
};

export default function PrivacyPage() {
  redirect("/legal#privacy");
}
