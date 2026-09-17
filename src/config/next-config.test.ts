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
});
