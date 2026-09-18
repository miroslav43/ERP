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

    /*
     * Aici stătea `reguli.every((r) => r.source.startsWith("/en"))` — adevărat
     * cât timp singurele antete emise erau cele două englezești. Din 18 sept
     * 2026 se emite și un CSP raportat, pe toate rutele, iar invariantul acela
     * a devenit fals fără ca nimic să fie în neregulă.
     *
     * Ce voia să apere el trăiește mai departe, scris pe ce contează: NICIO
     * regulă în afara paginilor englezești nu are voie să trimită
     * `Content-Language`. Un `en` scăpat pe tot situl ar spune motoarelor că
     * paginile românești sunt în engleză.
     */
    const cuLimba = reguli.filter((r) => r.headers.some((h) => h.key === "Content-Language"));
    expect(cuLimba.length).toBe(2);
    expect(cuLimba.every((r) => r.source.startsWith("/en"))).toBe(true);
  });

  it("CSP-ul se emite raportat, pe tot situl, fără directivele pe care browserele le ignoră", async () => {
    /*
     * Trei decizii care se pierd ușor la o reformulare, toate plătite:
     *
     *  1. `Report-Only`. O politică scrisă din citirea codului e o ipoteză;
     *     trecută în vigoare, rupe ecrane pe care nu le-am deschis.
     *  2. O SINGURĂ regulă, pe toate rutele. Două reguli care potrivesc aceeași
     *     cale și declară aceeași cheie se suprascriu după ordine — un mecanism
     *     pe care nu vrem să-l descoperim în producție.
     *  3. FĂRĂ `frame-ancestors`. Browserele o ignoră într-o politică raportată,
     *     iar Chrome scrie un avertisment în consolă la fiecare încărcare de
     *     pagină. Munca ei o face `X-Frame-Options`, din nginx.
     */
    const reguli = (await nextConfig.headers?.()) ?? [];
    const cuCsp = reguli.filter((r) =>
      r.headers.some((h) => h.key === "Content-Security-Policy-Report-Only"),
    );
    expect(cuCsp.map((r) => r.source)).toEqual(["/:cale*"]);

    const politica =
      cuCsp[0]?.headers.find((h) => h.key === "Content-Security-Policy-Report-Only")?.value ?? "";
    for (const directiva of ["default-src", "object-src 'none'", "form-action", "report-uri"]) {
      expect(politica, `lipsește ${directiva}`).toContain(directiva);
    }
    expect(politica, "frame-ancestors e ignorată în Report-Only").not.toContain("frame-ancestors");

    // Politica executorie ar fi trebuit să fie o decizie, nu o scăpare de tipar.
    expect(
      reguli.some((r) => r.headers.some((h) => h.key === "Content-Security-Policy")),
      "CSP-ul a devenit executoriu — dacă e intenționat, schimbă și testul",
    ).toBe(false);
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
