import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  FUNCTIE_UMAMI,
  PARAMETRI_PASTRATI,
  PARAMETRI_RECLAMA,
  adresaCurata,
  areDateDeFormular,
  cuParametriiPastrati,
  pregatestePentruUmami,
} from "./adresa-analitice";

const PONTAJ =
  "https://administrativo.ro/unelte/foaie-de-pontaj?luna=10&an=2026&angajati=Zzsecret+Popescu%0D%0AZzsecret+Ionescu&utm_source=fisier#documentul";

describe("adresaCurata", () => {
  it("taie valorile din formular și fragmentul, păstrează campania", () => {
    expect(adresaCurata(PONTAJ)).toBe(
      "https://administrativo.ro/unelte/foaie-de-pontaj?utm_source=fisier",
    );
  });

  it("o cale relativă rămâne relativă", () => {
    expect(adresaCurata("/unelte/condica-de-prezenta?firma=Zzsecret&m=1728")).toBe(
      "/unelte/condica-de-prezenta?m=1728",
    );
  });

  it("fără parametri permiși dispare și semnul întrebării", () => {
    expect(adresaCurata("https://administrativo.ro/unelte/fisa-evaluare?nume=Zzsecret")).toBe(
      "https://administrativo.ro/unelte/fisa-evaluare",
    );
  });

  it("șirul gol și adresa de necitit dau șir gol, nu adresa brută", () => {
    expect(adresaCurata("")).toBe("");
    expect(adresaCurata("http://[::1/unelte?nume=Zzsecret")).toBe("");
  });

  it("identificatorul de clic al reclamei nu pleacă spre Umami", () => {
    expect(adresaCurata("https://administrativo.ro/preturi?gclid=abc&utm_source=google")).toBe(
      "https://administrativo.ro/preturi?utm_source=google",
    );
  });

  it("o sursă externă fără parametri trece neschimbată", () => {
    expect(adresaCurata("https://www.google.com/")).toBe("https://www.google.com/");
  });
});

describe("areDateDeFormular", () => {
  it("valorile unei unelte înseamnă date", () => {
    expect(areDateDeFormular(PONTAJ)).toBe(true);
    expect(areDateDeFormular("https://administrativo.ro/unelte/calculator-salariu?suma=5000")).toBe(
      true,
    );
  });

  it("doar campanie și marcaj de audit nu înseamnă date", () => {
    expect(areDateDeFormular("https://administrativo.ro/unelte?utm_source=fisier&m=1")).toBe(false);
    expect(areDateDeFormular("https://administrativo.ro/unelte/foaie-de-pontaj")).toBe(false);
    expect(areDateDeFormular("")).toBe(false);
  });

  it("identificatorii de clic ai reclamelor nu închid poarta, valorile da", () => {
    expect(areDateDeFormular("https://administrativo.ro/unelte/foaie-de-pontaj?gclid=abc")).toBe(
      false,
    );
    expect(areDateDeFormular("https://administrativo.ro/?gclid=abc&angajati=Zzsecret")).toBe(true);
  });

  it("o adresă de necitit închide poarta", () => {
    expect(areDateDeFormular("http://[::1/unelte?nume=Zzsecret")).toBe(true);
  });
});

describe("cuParametriiPastrati", () => {
  it("readaugă campania paginii curente, fără valorile din formular", () => {
    expect(
      cuParametriiPastrati(
        "https://administrativo.ro/unelte/foaie-de-pontaj",
        "https://administrativo.ro/unelte/foaie-de-pontaj?utm_source=fisier&angajati=Zzsecret",
      ),
    ).toBe("https://administrativo.ro/unelte/foaie-de-pontaj?utm_source=fisier");
  });

  it("nu mută campania pe altă pagină", () => {
    expect(cuParametriiPastrati("/preturi", "https://administrativo.ro/module?utm_source=x")).toBe(
      "/preturi",
    );
  });

  it("fără campanie pe pagina curentă, adresa rămâne cum era", () => {
    expect(
      cuParametriiPastrati(
        "https://administrativo.ro/preturi",
        "https://administrativo.ro/preturi?nume=Zzsecret",
      ),
    ).toBe("https://administrativo.ro/preturi");
  });
});

describe("pregatestePentruUmami", () => {
  it("niciun câmp trimis nu mai conține valorile, iar restul trec neatinse", () => {
    const rezultat = pregatestePentruUmami(
      {
        website: "id",
        url: PONTAJ,
        referrer: "/unelte/condica-de-prezenta?firma=Zzsecret",
        name: "foaie-pdf",
      },
      PONTAJ,
    );
    expect(rezultat).toEqual({
      website: "id",
      url: "https://administrativo.ro/unelte/foaie-de-pontaj?utm_source=fisier",
      referrer: "/unelte/condica-de-prezenta",
      name: "foaie-pdf",
    });
    expect(JSON.stringify(rezultat)).not.toContain("Zzsecret");
  });

  it("un corp fără url și referrer trece neschimbat", () => {
    expect(pregatestePentruUmami({ website: "id", data: { secunde: 4 } }, PONTAJ)).toEqual({
      website: "id",
      data: { secunde: 4 },
    });
  });

  it("numele funcției globale e un identificator valid", () => {
    expect(FUNCTIE_UMAMI).toMatch(/^[A-Za-z_$][\w$]*$/u);
  });
});

/**
 * Paza listei albe și a porții GA, citite direct din paginile uneltelor:
 * `name="…"` în JSX și `nume: "…"` în listele de câmpuri.
 */
describe("paginile uneltelor", () => {
  const RADACINA = "src/app/(marketing)/unelte";
  const pagini = readdirSync(RADACINA, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx"))
    .map((f) => readFileSync(join(RADACINA, f), "utf8"));
  // `(?:async )?`: cele șapte unelte sunt `export default async function`
  // (citesc `searchParams`); fără el, doar hub-ul s-ar număra (1 < 8).
  const surseDePagina = pagini.filter((s) => /export default (?:async )?function/u.test(s));
  const nume = new Set(
    pagini.flatMap((sursa) => [
      ...[...sursa.matchAll(/\bname="([a-z_]+)"/gu)].map((m) => m[1] ?? ""),
      ...[...sursa.matchAll(/\bnume: "([a-z_]+)"/gu)].map((m) => m[1] ?? ""),
    ]),
  );

  it("scanarea găsește câmpurile (altfel testul ar trece gol)", () => {
    expect(surseDePagina.length).toBeGreaterThanOrEqual(8);
    expect(nume.size).toBeGreaterThanOrEqual(20);
    expect(nume).toContain("angajati");
    expect(nume).toContain("sofer");
  });

  it("niciun câmp nu poartă numele unui parametru păstrat", () => {
    expect([...nume].filter((n) => PARAMETRI_PASTRATI.has(n) || PARAMETRI_RECLAMA.has(n))).toEqual(
      [],
    );
  });

  /**
   * Poarta GA (`pornire-ga.tsx`) se decide O DATĂ, la încărcarea documentului.
   * O unealtă care și-ar scrie valorile în adresă din client — `next/form`,
   * `router.replace`, `history.replaceState` — le-ar pune într-un document
   * deja măsurat, iar GA le-ar trimite la următoarea afișare din istorie.
   */
  it("nicio unealtă nu-și rescrie adresa din client", () => {
    const interzise = /from "next\/form"|useRouter\(|history\.(?:push|replace)State/u;
    expect(pagini.filter((s) => interzise.test(s))).toEqual([]);
  });
});
