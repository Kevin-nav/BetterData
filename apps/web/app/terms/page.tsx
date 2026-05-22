import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms and Conditions",
  description:
    "Review Better Data's terms for mobile data bundle purchases, recipient numbers, payments, wallet use, agents, refunds, and acceptable platform use.",
  alternates: {
    canonical: "/legal#terms",
  },
  openGraph: {
    type: "article",
    url: "/legal#terms",
    title: "Terms and Conditions | Better Data",
    description:
      "Better Data terms covering Ghana data bundle purchases, payments, wallet use, agents, refunds, and support.",
    siteName: "Better Data",
  },
};

export default function TermsPage() {
  redirect("/legal#terms");
}
