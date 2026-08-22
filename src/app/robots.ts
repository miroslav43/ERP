import type { MetadataRoute } from "next";

import { ADRESA_SITE } from "@/content/landing/contact";

/**
 * Aplicația autentificată nu are ce căuta într-un index: `/panou`, `/portal` și
 * `/super-admin` cer sesiune, iar un robot care le cere primește redirect către
 * autentificare. Le excludem explicit ca să nu consume buget de crawl.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/panou", "/portal", "/super-admin", "/setari", "/api/", "/auth/"],
    },
    sitemap: `${ADRESA_SITE}/sitemap.xml`,
  };
}
