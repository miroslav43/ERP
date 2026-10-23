import { describe, expect, it } from "vitest";

import {
  CATEGORII_PERMIS,
  avertismenteSofer,
  categoriiAcceptate,
  esteInLocalitate,
  rezumatScurt,
  starePermisCitit,
  type FapteSofer,
} from "./soferi";

const AZI = "2026-10-12";

const curat: FapteSofer = {
  employee_id: "e1",
  concediu: null,
  contract_incetat: false,
  permis_exista: true,
  permis_expira_la: "2030-01-01",
  permis_categorii: ["B"],
  aviz: "apt",
  delegatie: null,
};

describe("categoriile permisului", () => {
  it("sunt cele 18 din OUG 195/2002 art. 20, în ordinea din lege", () => {
    expect(CATEGORII_PERMIS).toHaveLength(18);
    expect(CATEGORII_PERMIS.slice(0, 6)).toEqual(["AM", "A1", "A2", "A", "B1", "B"]);
    expect(CATEGORII_PERMIS.at(-1)).toBe("Tv");
  });

  it("autoturismul și autoutilitara ușoară cer B", () => {
    expect(
      categoriiAcceptate({ categorie: "autoturism", masa_maxima_kg: null, numar_locuri: 5 }),
    ).toEqual(["B"]);
    expect(
      categoriiAcceptate({ categorie: "autoutilitara", masa_maxima_kg: 3500, numar_locuri: 3 }),
    ).toEqual(["B"]);
  });

  it("peste 3,5 t cere C1 sau C, peste 7,5 t doar C", () => {
    expect(
      categoriiAcceptate({ categorie: "autoutilitara", masa_maxima_kg: 5000, numar_locuri: 3 }),
    ).toEqual(["C1", "C"]);
    expect(
      categoriiAcceptate({ categorie: "camion", masa_maxima_kg: 12000, numar_locuri: 2 }),
    ).toEqual(["C"]);
    expect(
      categoriiAcceptate({ categorie: "camion", masa_maxima_kg: null, numar_locuri: null }),
    ).toEqual(["C1", "C"]);
  });

  it("microbuzul de 9 locuri cere B; peste, D1 sau D; autobuzul mare, D", () => {
    expect(
      categoriiAcceptate({ categorie: "microbuz", masa_maxima_kg: null, numar_locuri: 9 }),
    ).toEqual(["B"]);
    expect(
      categoriiAcceptate({ categorie: "microbuz", masa_maxima_kg: null, numar_locuri: 17 }),
    ).toEqual(["D1", "D"]);
    expect(
      categoriiAcceptate({ categorie: "autobuz", masa_maxima_kg: null, numar_locuri: 40 }),
    ).toEqual(["D"]);
  });

  it("remorca, utilajul și „altele” nu se judecă", () => {
    for (const categorie of ["remorca", "semiremorca", "utilaj", "altele"] as const) {
      expect(
        categoriiAcceptate({ categorie, masa_maxima_kg: null, numar_locuri: null }),
      ).toBeNull();
    }
  });
});

describe("localitatea firmei", () => {
  it("se potrivește fără diacritice și fără majuscule", () => {
    expect(esteInLocalitate("Str. Fabricii 3, Cluj-Napoca", "Cluj-Napoca")).toBe(true);
    expect(esteInLocalitate("cluj napoca, depozit", "Cluj-Napoca")).toBe(true);
    expect(esteInLocalitate("Târgu Mureș", "Targu Mures")).toBe(true);
    expect(esteInLocalitate("Turda", "Cluj-Napoca")).toBe(false);
  });

  it("un loc necompletat nu e o deplasare", () => {
    expect(esteInLocalitate(null, "Cluj-Napoca")).toBe(true);
    expect(esteInLocalitate("  ", "Cluj-Napoca")).toBe(true);
  });
});

describe("avertismentele șoferului", () => {
  it("fără nimic de semnalat, lista e goală", () => {
    expect(avertismenteSofer({ fapte: curat, zi: AZI })).toEqual([]);
  });

  it("absența aprobată se spune la fel, oricare ar fi tipul concediului (art. 9 GDPR)", () => {
    for (const concediu of ["absent", "medical", "concediu"]) {
      const lista = avertismenteSofer({ fapte: { ...curat, concediu }, zi: AZI });
      expect(lista.map((a) => a.cod)).toEqual(["absent"]);
      // Chiar dacă un fapt vechi ar spune „medical”, ecranul nu pomenește CM-ul.
      expect(lista[0]?.mesaj.toLowerCase()).not.toContain("medical");
    }
    expect(
      avertismenteSofer({ fapte: { ...curat, concediu: "absent" }, zi: AZI, momentul: "azi" })[0]
        ?.mesaj,
    ).toBe("Șoferul are o absență aprobată astăzi.");
  });

  it("avizul fără acces SSM (`null`) e „fără semnal”, nu o problemă; la fel orice alt text în afară de expirat/lipsa", () => {
    // Baza întoarce `null` pentru cine n-are acces SSM pe fișa șoferului: nici
    // „apt”, nici „de verificat” (ar dezvălui că avizul nu e valabil). Ecranul
    // nu scrie nimic. Un text necunoscut (un fapt vechi „de_verificat”) tace la fel.
    for (const aviz of [null, "apt", "de_verificat", "ceva"]) {
      expect(avertismenteSofer({ fapte: { ...curat, aviz }, zi: AZI })).toEqual([]);
    }
  });

  it("permisul necunoscut (`null`: apelantul n-are citirea permisului) nu produce nimic, nici „fără permis”", () => {
    // Pentru cine nu trece `driver_licenses_select`, baza întoarce `null` la toate
    // trei câmpurile: „nu se știe” nu e „n-are permis” și nu e „categorie greșită”.
    const necunoscut: FapteSofer = {
      ...curat,
      permis_exista: null,
      permis_expira_la: null,
      permis_categorii: null,
    };
    expect(avertismenteSofer({ fapte: necunoscut, zi: AZI })).toEqual([]);
    expect(
      avertismenteSofer({
        fapte: necunoscut,
        zi: AZI,
        vehicul: { categorie: "camion", masa_maxima_kg: 12000, numar_locuri: 2 },
      }),
    ).toEqual([]);
    // Celelalte fapte (absența, contractul) rămân.
    expect(
      avertismenteSofer({
        fapte: { ...necunoscut, concediu: "absent", contract_incetat: true },
        zi: AZI,
      }).map((a) => a.cod),
    ).toEqual(["absent", "contract_incetat"]);
  });

  it("contractul încetat, permisul expirat sau lipsă, avizul expirat sau lipsă", () => {
    const coduri = avertismenteSofer({
      fapte: {
        ...curat,
        contract_incetat: true,
        permis_expira_la: "2026-10-11",
        aviz: "expirat",
      },
      zi: AZI,
    }).map((a) => a.cod);
    expect(coduri).toEqual(["contract_incetat", "permis_expirat", "aviz_expirat"]);

    expect(
      avertismenteSofer({
        fapte: {
          ...curat,
          permis_exista: false,
          permis_expira_la: null,
          permis_categorii: [],
          aviz: "lipsa",
        },
        zi: AZI,
      }).map((a) => a.cod),
    ).toEqual(["permis_lipsa", "aviz_lipsa"]);
  });

  it("permisul care expiră chiar azi e încă valabil", () => {
    expect(avertismenteSofer({ fapte: { ...curat, permis_expira_la: AZI }, zi: AZI })).toEqual([]);
  });

  it("avizul `null` (SSM oprit) nu produce nimic", () => {
    expect(avertismenteSofer({ fapte: { ...curat, aviz: null }, zi: AZI })).toEqual([]);
  });

  it("categoria lipsă pentru vehicul se semnalează cu ce cere vehiculul", () => {
    const [a] = avertismenteSofer({
      fapte: curat,
      zi: AZI,
      vehicul: { categorie: "camion", masa_maxima_kg: 12000, numar_locuri: 2 },
    });
    expect(a?.cod).toBe("permis_categorie");
    expect(a?.mesaj).toContain("C");
  });

  it("categoria nu se judecă pe un permis lipsă (avertismentul e deja „lipsă”)", () => {
    const coduri = avertismenteSofer({
      fapte: { ...curat, permis_exista: false, permis_expira_la: null, permis_categorii: [] },
      zi: AZI,
      vehicul: { categorie: "camion", masa_maxima_kg: 12000, numar_locuri: 2 },
    }).map((a) => a.cod);
    expect(coduri).toEqual(["permis_lipsa"]);
  });

  it("cursa în altă localitate fără delegație avertizează; cu delegație sau foaie legată, nu", () => {
    const curse = [{ de_la_loc: "Sediu Cluj-Napoca", pana_la_loc: "Turda" }];
    const fara = avertismenteSofer({
      fapte: { ...curat, delegatie: false },
      zi: AZI,
      curse,
      orasFirma: "Cluj-Napoca",
    });
    expect(fara.map((a) => a.cod)).toEqual(["fara_delegatie"]);
    expect(fara[0]?.mesaj).toContain("Turda");

    expect(
      avertismenteSofer({
        fapte: { ...curat, delegatie: true },
        zi: AZI,
        curse,
        orasFirma: "Cluj-Napoca",
      }),
    ).toEqual([]);
    expect(
      avertismenteSofer({
        fapte: { ...curat, delegatie: false },
        zi: AZI,
        curse,
        orasFirma: "Cluj-Napoca",
        legataDeDeplasare: true,
      }),
    ).toEqual([]);
  });

  it("fără orașul firmei sau cu delegația necunoscută (`delegatie: null`: diurna oprită sau apelantul nu vede deplasările), deplasarea nu se judecă", () => {
    const curse = [{ de_la_loc: null, pana_la_loc: "Turda" }];
    expect(
      avertismenteSofer({ fapte: { ...curat, delegatie: false }, zi: AZI, curse, orasFirma: null }),
    ).toEqual([]);
    expect(avertismenteSofer({ fapte: curat, zi: AZI, curse, orasFirma: "Cluj-Napoca" })).toEqual(
      [],
    );
  });

  it("fiecare mesaj se termină cu punct", () => {
    const toate = avertismenteSofer({
      fapte: {
        employee_id: "e1",
        concediu: "absent",
        contract_incetat: true,
        permis_exista: true,
        permis_expira_la: "2020-01-01",
        permis_categorii: ["B"],
        aviz: "lipsa",
        delegatie: false,
      },
      zi: AZI,
      vehicul: { categorie: "autobuz", masa_maxima_kg: null, numar_locuri: 40 },
      curse: [{ de_la_loc: "Cluj-Napoca", pana_la_loc: "Dej" }],
      orasFirma: "Cluj-Napoca",
    });
    expect(toate).toHaveLength(6);
    for (const a of toate) expect(a.mesaj.endsWith(".")).toBe(true);
  });
});

describe("rezumatul scurt pentru selectoare", () => {
  it("pune etichetele scurte una după alta", () => {
    expect(
      rezumatScurt(
        avertismenteSofer({
          fapte: { ...curat, permis_expira_la: "2020-01-01", aviz: "lipsa" },
          zi: AZI,
        }),
      ),
    ).toBe("permis expirat, aviz lipsă");
  });

  it("fără avertismente, `null`", () => {
    expect(rezumatScurt([])).toBeNull();
  });

  it("absența are o etichetă neutră, iar avizul necunoscut nu apare în ea", () => {
    expect(
      rezumatScurt(
        avertismenteSofer({
          fapte: { ...curat, concediu: "absent", aviz: null },
          zi: AZI,
        }),
      ),
    ).toBe("absent");
  });
});

/*
 * A1: secțiunea „Permis de conducere” spunea „Niciun permis înregistrat” și când
 * RLS-ul ascundea permisul. Faptul `permis_exista` deosebește cele două: `false`
 * = baza a putut verifica și omul n-are permis; `null` (sau angajatul lipsă din
 * hartă) = „nu se știe”, deci nu se afirmă nimic despre existența permisului.
 */
describe("starePermisCitit", () => {
  it("permisul citit e înregistrat, orice ar spune faptele", () => {
    expect(starePermisCitit(true, true)).toBe("inregistrat");
    expect(starePermisCitit(true, null)).toBe("inregistrat");
  });

  it("fără rând și cu `permis_exista = false`: lipsește", () => {
    expect(starePermisCitit(false, false)).toBe("lipsa");
  });

  it("fără rând și fără semnal (`null`): fără acces, NU „niciun permis”", () => {
    expect(starePermisCitit(false, null)).toBe("fara_acces");
  });

  it("fără rând deși faptele spun că există: tot fără acces", () => {
    expect(starePermisCitit(false, true)).toBe("fara_acces");
  });
});
