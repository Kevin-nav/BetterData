import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/dashboard/",
          "/payments/",
          "/api/",
        ],
      },
    ],
    sitemap: "https://betterdatagh.com/sitemap.xml",
  };
}
