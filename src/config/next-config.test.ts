import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

/**
 * Ce apără fișierul: regulile din `next.config.ts` care se văd doar pe un build
 * rulat — antetele și, mai jos, redirecturile. `pnpm build` nu face parte din
 * lanțul de verificare obișnuit, deci fără testul ăsta o regulă greșită ar
 * ajunge în producție fără nicio poartă.
 *
 * Importul e relativ, nu prin `@/`: `next.config.ts` se încarcă în container cu
 * rezoluția de module a lui Node, unde alias-ul nu există.
 */
describe("next.config", () => {
  it("paginile engleze poartă Content-Language: en, iar restul nu", async () => {
    const reguli = (await nextConfig.headers?.()) ?? [];
    const pentru = (sursa: string) =>
      reguli
        .filter((r) => r.source === sursa)
        .flatMap((r) => r.headers)
        .find((h) => h.key === "Content-Language")?.value;

    expect(pentru("/en")).toBe("en");
    expect(pentru("/en/:path*")).toBe("en");
    expect(reguli.every((r) => r.source.startsWith("/en"))).toBe(true);
  });

  it("adresele vechi de modul redirecționează permanent spre slug, fără bucle", async () => {
    const { SLUG_MODUL } = await import("../content/landing/slug-module");
    const redirecturi = (await nextConfig.redirects?.()) ?? [];
    const deModul = redirecturi.filter((r) => r.source.startsWith("/module/"));

    const asteptate = Object.entries(SLUG_MODUL)
      .filter(([cheie, slug]) => cheie !== slug)
      .map(([cheie, slug]) => `/module/${cheie} → /module/${slug}`)
      .sort();
    expect(deModul.map((r) => `${r.source} → ${r.destination}`).sort()).toEqual(asteptate);
    expect(asteptate.length, "harta n-a schimbat nicio adresă").toBeGreaterThan(0);

    for (const r of deModul) {
      expect(r.source, "redirect către el însuși").not.toBe(r.destination);
      expect("permanent" in r && r.permanent, `${r.source} nu e permanent`).toBe(true);
      // Destinația nu poate fi la rândul ei sursa altui redirect.
      expect(
        deModul.some((x) => x.source === r.destination),
        `${r.destination} e lanț`,
      ).toBe(false);
    }
  });
});
