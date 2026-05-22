import type { MetadataRoute } from "next";

const siteUrl = "https://betterdatagh.com";
const lastModified = new Date("2026-05-22");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      lastModified,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${siteUrl}/buy`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/agents`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.75,
    },
    {
      url: `${siteUrl}/agents/apply`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.65,
    },
    {
      url: `${siteUrl}/legal`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.55,
    },
  ];
}
