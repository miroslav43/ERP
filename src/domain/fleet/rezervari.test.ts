import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  ETICHETE_STARE_AFISATA,
  FEREASTRA_OCUPARE_MAX_ZILE,
  REZERVARI_MAX_ZILE,
  REZERVARI_MAX_ZILE_IMPLICIT,
  STATUS_REZERVARE,
  STARI_AFISATE,
  grilaOcupare,
  panaLaMaxim,
  poateAnula,
  poateDecide,
  poateScurta,
  pragScurtare,
  seSuprapun,
  stareAfisata,
  zileRezervare,
  type Ocupare,
} from "./rezervari";

const MIGRARE = readFileSync("supabase/migrations/0216_flota_rezervari.sql", "utf8");

describe("lipite de migrarea 0216", () => {
  it("statusurile sunt exact enum-ul bazei, în ordine", () => {
    const m = MIGRARE.match(/create type public\.vehicle_reservation_status as enum \(([^)]+)\)/);
    const dinBaza = [...(m?.[1] ?? "").matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
    expect(dinBaza).toEqual([...STATUS_REZERVARE]);
  });

  it("durata maximă: implicitul și intervalul CHECK-ului", () => {
    expect(MIGRARE).toContain(
      `rezervari_max_zile smallint not null default ${REZERVARI_MAX_ZILE_IMPLICIT}`,
    );
    expect(MIGRARE).toContain(
      `check (rezervari_max_zile between ${REZERVARI_MAX_ZILE.min} and ${REZERVARI_MAX_ZILE.max})`,
    );
  });

  it("fereastra de ocupare: cel mult 63 de zile, ca RPC-ul", () => {
    expect(MIGRARE).toContain(`p_pana_la - p_de_la > ${FEREASTRA_OCUPARE_MAX_ZILE - 1}`);
  });
});

describe("zileRezervare", () => {
  it("numără ambele capete: o zi = 1", () => {
    expect(zileRezervare("2026-10-14", "2026-10-14")).toBe(1);
    expect(zileRezervare("2026-10-14", "2026-10-15")).toBe(2);
  });

  it("trece peste lună și peste schimbarea orei", () => {
    expect(zileRezervare("2026-10-24", "2026-10-26")).toBe(3);
    expect(zileRezervare("2026-02-27", "2026-03-02")).toBe(4);
  });
});

describe("seSuprapun", () => {
  it("luni–luni și marți–marți nu se suprapun", () => {
    expect(
      seSuprapun(
        { de_la: "2026-10-12", pana_la: "2026-10-12" },
        { de_la: "2026-10-13", pana_la: "2026-10-13" },
      ),
    ).toBe(false);
  });

  it("aceeași zi la capăt se suprapune (intervale închise)", () => {
    expect(
      seSuprapun(
        { de_la: "2026-10-12", pana_la: "2026-10-14" },
        { de_la: "2026-10-14", pana_la: "2026-10-20" },
      ),
    ).toBe(true);
  });

  it("cuprinderea se suprapune, în ambele sensuri", () => {
    const mare = { de_la: "2026-10-10", pana_la: "2026-10-20" };
    const mic = { de_la: "2026-10-12", pana_la: "2026-10-13" };
    expect(seSuprapun(mare, mic)).toBe(true);
    expect(seSuprapun(mic, mare)).toBe(true);
  });
});

describe("stareAfisata", () => {
  const azi = "2026-10-14";
  it.each([
    ["ceruta", "2026-10-15", "2026-10-16", "in_asteptare"],
    ["ceruta", "2026-10-12", "2026-10-13", "expirata_nedecisa"],
    ["ceruta", "2026-10-14", "2026-10-14", "in_asteptare"],
    ["confirmata", "2026-10-15", "2026-10-16", "viitoare"],
    ["confirmata", "2026-10-13", "2026-10-15", "in_curs"],
    ["confirmata", "2026-10-14", "2026-10-14", "in_curs"],
    ["confirmata", "2026-10-10", "2026-10-13", "incheiata"],
    ["respinsa", "2026-10-15", "2026-10-16", "respinsa"],
    ["anulata", "2026-10-15", "2026-10-16", "anulata"],
  ] as const)("%s %s–%s → %s", (status, de_la, pana_la, asteptat) => {
    expect(stareAfisata({ status, de_la, pana_la }, azi)).toBe(asteptat);
  });

  it("toate cele 7 stări au etichetă", () => {
    expect(STARI_AFISATE).toHaveLength(7);
    for (const s of STARI_AFISATE) expect(ETICHETE_STARE_AFISATA[s].length).toBeGreaterThan(0);
  });
});

describe("pragScurtare și acțiunile permise", () => {
  const azi = "2026-10-14";

  it("rezervarea viitoare se scurtează cel mult până la prima ei zi", () => {
    expect(pragScurtare({ de_la: "2026-10-20", pana_la: "2026-10-25" }, azi)).toBe("2026-10-20");
  });

  it("rezervarea în curs se scurtează cel mult până azi", () => {
    expect(pragScurtare({ de_la: "2026-10-10", pana_la: "2026-10-20" }, azi)).toBe(azi);
  });

  it("scurtarea cere loc: o rezervare de o zi, sau una care se termină azi, nu se scurtează", () => {
    expect(
      poateScurta({ status: "confirmata", de_la: "2026-10-20", pana_la: "2026-10-20" }, azi),
    ).toBe(false);
    expect(poateScurta({ status: "confirmata", de_la: "2026-10-10", pana_la: azi }, azi)).toBe(
      false,
    );
    expect(
      poateScurta({ status: "confirmata", de_la: "2026-10-10", pana_la: "2026-10-16" }, azi),
    ).toBe(true);
    expect(
      poateScurta({ status: "anulata", de_la: "2026-10-10", pana_la: "2026-10-16" }, azi),
    ).toBe(false);
  });

  it("anularea: cererea oricând, confirmata doar până în ultima ei zi", () => {
    expect(poateAnula({ status: "ceruta", de_la: "2026-10-01", pana_la: "2026-10-02" }, azi)).toBe(
      true,
    );
    expect(poateAnula({ status: "confirmata", de_la: "2026-10-10", pana_la: azi }, azi)).toBe(true);
    expect(
      poateAnula({ status: "confirmata", de_la: "2026-10-10", pana_la: "2026-10-13" }, azi),
    ).toBe(false);
    expect(
      poateAnula({ status: "respinsa", de_la: "2026-10-20", pana_la: "2026-10-21" }, azi),
    ).toBe(false);
  });

  it("decizia: doar cererea care n-a trecut", () => {
    expect(poateDecide({ status: "ceruta", de_la: "2026-10-14", pana_la: "2026-10-14" }, azi)).toBe(
      true,
    );
    expect(poateDecide({ status: "ceruta", de_la: "2026-10-12", pana_la: "2026-10-13" }, azi)).toBe(
      false,
    );
    expect(
      poateDecide({ status: "confirmata", de_la: "2026-10-20", pana_la: "2026-10-21" }, azi),
    ).toBe(false);
  });

  it("panaLaMaxim: ultima zi permisă de durata maximă", () => {
    expect(panaLaMaxim("2026-10-14", 1)).toBe("2026-10-14");
    expect(panaLaMaxim("2026-10-14", 14)).toBe("2026-10-27");
  });
});

describe("grilaOcupare", () => {
  const vehicule = [
    { id: "v1", nr_inmatriculare: "B100AAA" },
    { id: "v2", nr_inmatriculare: "B200BBB" },
  ];

  it("o zi × un vehicul, cu toate cele trei surse", () => {
    const ocupari: Ocupare[] = [
      {
        vehicle_id: "v1",
        de_la: "2026-10-14",
        pana_la: "2026-10-15",
        sursa: "rezervare",
        status: "confirmata",
        a_mea: true,
        rezervare_id: "r1",
      },
      {
        vehicle_id: "v1",
        de_la: "2026-10-16",
        pana_la: "2026-10-16",
        sursa: "rezervare",
        status: "ceruta",
        a_mea: false,
        rezervare_id: null,
      },
      {
        vehicle_id: "v2",
        de_la: "2026-10-15",
        pana_la: "2026-10-15",
        sursa: "foaie",
        status: "draft",
        a_mea: false,
        rezervare_id: null,
      },
      {
        vehicle_id: "v2",
        de_la: "2026-10-16",
        pana_la: "2026-10-17",
        sursa: "alocare",
        status: null,
        a_mea: false,
        rezervare_id: null,
      },
    ];
    const grila = grilaOcupare(ocupari, vehicule, "2026-10-14", 4);

    expect(grila.zile).toEqual(["2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17"]);
    expect(grila.randuri.map((r) => r.vehicul.id)).toEqual(["v1", "v2"]);
    const [v1, v2] = grila.randuri;
    expect(v1?.celule.map((c) => c.stare)).toEqual(["al_meu", "al_meu", "in_asteptare", "liber"]);
    expect(v1?.celule[0]?.rezervareId).toBe("r1");
    expect(v2?.celule.map((c) => c.stare)).toEqual(["liber", "ocupat", "ocupat", "ocupat"]);
    expect(v2?.celule.map((c) => c.sursa)).toEqual([null, "foaie", "alocare", "alocare"]);
  });

  it("ocupat bate în așteptare pe aceeași zi, al meu bate tot", () => {
    const zi = "2026-10-14";
    const baza = { vehicle_id: "v1", de_la: zi, pana_la: zi, rezervare_id: null } as const;
    const grila = grilaOcupare(
      [
        { ...baza, sursa: "rezervare", status: "ceruta", a_mea: false },
        { ...baza, sursa: "alocare", status: null, a_mea: false },
      ],
      vehicule.slice(0, 1),
      zi,
      1,
    );
    expect(grila.randuri[0]?.celule[0]?.stare).toBe("ocupat");

    const alMeu = grilaOcupare(
      [
        { ...baza, sursa: "alocare", status: null, a_mea: false },
        { ...baza, sursa: "foaie", status: "draft", a_mea: true },
      ],
      vehicule.slice(0, 1),
      zi,
      1,
    );
    expect(alMeu.randuri[0]?.celule[0]?.stare).toBe("al_meu");
  });

  it("ocupările pe un vehicul care nu e în listă se ignoră; fereastra goală nu are zile", () => {
    const grila = grilaOcupare(
      [
        {
          vehicle_id: "altul",
          de_la: "2026-10-14",
          pana_la: "2026-10-14",
          sursa: "foaie",
          status: "draft",
          a_mea: false,
          rezervare_id: null,
        },
      ],
      vehicule,
      "2026-10-14",
      0,
    );
    expect(grila.zile).toEqual([]);
    expect(grila.randuri.every((r) => r.celule.length === 0)).toBe(true);
  });
});
