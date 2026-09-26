import type { MetadataRoute } from "next";
const base = process.env.APP_URL ?? "https://wordwild-seven.vercel.app";
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: ["/", "/word/"], disallow: ["/api/", "/dev/"] }], sitemap: `${base}/sitemap.xml` };
}
