// src/domain/fleet/proces-verbal.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CATEGORII_VEHICUL } from "@/schemas/fleet";

import {
  ANVELOPE_PV,
  DOCUMENTE_BORD_PV,
  DOTARI_PV,
  NIVELURI_REZERVOR,
  STARI_GENERALE,
  ZONE_DAUNA,
  avertismentePv,
  bifePropuse,
  citesteDaune,
  citesteInstantaneu,
  dotariObligatoriiPentru,
  etichetaNivel,
  modelPv,
  numeFisierPv,
  tipPv,
  type ContextAvertismente,
  type DatePv,
  type IntrareModelPv,
} from "./proces-verbal";

const MIGRARE = readFileSync(
  join(process.cwd(), "supabase/migrations/0215_flota_proces_verbal.sql"),
  "utf8",
);

/** Lista de coduri dintre `<@ array[` și `]::text[]` a CHECK-ului numit. */
function listaDinCheck(nume: string): readonly string[] {
  const re = new RegExp(
    `constraint ${nume} check \\(\\w+ <@ array\\[([^\\]]+)\\]::text\\[\\]\\)`,
    "u",
  );
  const potrivire = re.exec(MIGRARE);
  if (potrivire === null) throw new Error(`CHECK-ul ${nume} lipsește din migrare`);
  return [...(potrivire[1] ?? "").matchAll(/'([a-z_]+)'/gu)].map((m) => m[1] ?? "");
}

/** Valorile unui enum creat în migrare. */
function enumDinMigrare(nume: string): readonly string[] {
  const re = new RegExp(`create type public\\.${nume} as enum \\(([^)]+)\\)`, "u");
  const potrivire = re.exec(MIGRARE);
  if (potrivire === null) throw new Error(`enum-ul ${nume} lipsește din migrare`);
  return [...(potrivire[1] ?? "").matchAll(/'([a-z_]+)'/gu)].map((m) => m[1] ?? "");
}

describe("paritatea listelor cu baza (0215)", () => {
  // O listă care diverge de CHECK dă 23514 la salvare, pe un câmp pe care
  // omul l-a completat corect.
  it("dotările sunt exact cele din `pvv_dotari_ck`", () => {
    expect([...DOTARI_PV].sort()).toEqual([...listaDinCheck("pvv_dotari_ck")].sort());
  });

  it("documentele de bord sunt exact cele din `pvv_documente_ck`", () => {
    expect([...DOCUMENTE_BORD_PV].sort()).toEqual([...listaDinCheck("pvv_documente_ck")].sort());
  });

  it("zonele de daună sunt exact cele din trigger", () => {
    const bloc = /coalesce\(v_e ->> 'zona', ''\) not in \(([^)]+)\)/u.exec(MIGRARE);
    expect(bloc).not.toBeNull();
    const zone = [...(bloc?.[1] ?? "").matchAll(/'([a-z_]+)'/gu)].map((m) => m[1]);
    expect([...ZONE_DAUNA].sort()).toEqual([...zone].sort());
  });

  it("anvelopele, nivelurile și stările generale urmează CHECK-ul și enum-urile", () => {
    const anvelope =
      /constraint pvv_anvelope_ck check \(anvelope is null or anvelope in \(([^)]+)\)\)/u.exec(
        MIGRARE,
      );
    expect([...(anvelope?.[1] ?? "").matchAll(/'([a-z_]+)'/gu)].map((m) => m[1])).toEqual([
      ...ANVELOPE_PV,
    ]);
    expect(enumDinMigrare("pv_nivel_rezervor")).toEqual([...NIVELURI_REZERVOR]);
    expect(enumDinMigrare("pv_stare_generala")).toEqual([...STARI_GENERALE]);
  });
});

describe("dotariObligatoriiPentru (OUG 195/2002 art. 8)", () => {
  it.each([
    ["autoturism", 3],
    ["autoutilitara", 3],
    ["camion", 3],
    ["autobuz", 3],
    ["microbuz", 3],
    ["remorca", 0],
    ["semiremorca", 0],
    ["motocicleta", 0],
    ["utilaj", 0],
    ["altele", 0],
  ] as const)("%s → %i dotări obligatorii", (categorie, n) => {
    expect(dotariObligatoriiPentru(categorie)).toHaveLength(n);
  });

  it("acoperă toate cele zece categorii ale vehiculului", () => {
    expect(CATEGORII_VEHICUL).toHaveLength(10);
  });

  it("obligatoriile sunt trusa, triunghiurile și stingătorul", () => {
    expect(dotariObligatoriiPentru("autoturism")).toEqual([
      "trusa_medicala",
      "triunghiuri",
      "extinctor",
    ]);
  });
});

describe("tipPv", () => {
  it("oglinda regulii din trigger", () => {
    expect(tipPv({ predataId: "a", primitaId: "b" })).toBe("transfer");
    expect(tipPv({ predataId: null, primitaId: "b" })).toBe("predare");
    expect(tipPv({ predataId: "a", primitaId: null })).toBe("restituire");
    expect(tipPv({ predataId: null, primitaId: null })).toBeNull();
  });
});

describe("bifePropuse", () => {
  it("RCA și CASCO devin polițe la bord; stingătorul și trusa, dotări; certificatul e mereu propus", () => {
    expect(bifePropuse(["rca", "casco", "itp", "extinctor", "trusa_medicala"])).toEqual({
      documente: ["certificat_inmatriculare", "polita_rca", "polita_casco"],
      dotari: ["trusa_medicala", "extinctor"],
    });
  });
});

function pv(peste: Partial<DatePv> = {}): DatePv {
  return {
    tip: "predare",
    stare: "finalizat",
    moment: "2026-10-12T07:30:00.000Z",
    data_pv: "2026-10-12",
    numar: "PVA-2026-0003",
    numar_registru: "437/12.10.2026",
    km_bord: 51200,
    nivel_rezervor: "trei_sferturi",
    numar_chei: 2,
    stare_generala: "buna",
    anvelope: "iarna",
    documente_bord: ["certificat_inmatriculare", "polita_rca"],
    dotari: ["trusa_medicala", "triunghiuri", "extinctor"],
    daune_constatate: false,
    daune: [],
    observatii: null,
    finalizat_la: "2026-10-12T08:00:00.000Z",
    confirmat_predator_la: null,
    confirmat_primitor_la: null,
    anulat_la: null,
    motiv_anulare: null,
    ...peste,
  };
}

function context(peste: Partial<ContextAvertismente> = {}): ContextAvertismente {
  return {
    categorie: "autoturism",
    documente: [],
    kmCurentVehicul: null,
    predecesorLipit: null,
    alocareDinIstoric: false,
    ziuaIntocmirii: "2026-10-12",
    ...peste,
  };
}

describe("avertismentePv", () => {
  it("un PV complet pe un autoturism nu avertizează nimic", () => {
    expect(avertismentePv(pv(), context())).toEqual([]);
  });

  it("dotarea obligatorie lipsă se spune, cu temeiul", () => {
    const a = avertismentePv(pv({ dotari: ["trusa_medicala", "triunghiuri"] }), context());
    expect(a).toEqual(["Lipsește dotarea obligatorie: stingător (OUG 195/2002 art. 8)."]);
  });

  it("remorca nu cere dotări", () => {
    expect(avertismentePv(pv({ dotari: [] }), context({ categorie: "remorca" }))).toEqual([]);
  });

  it("utilajul cere verificarea drumurilor publice", () => {
    expect(avertismentePv(pv({ dotari: [] }), context({ categorie: "utilaj" }))[0]).toMatch(
      /^Verificați dacă vehiculul circulă pe drumuri publice/u,
    );
  });

  it("certificatul de înmatriculare nebifat se spune", () => {
    expect(avertismentePv(pv({ documente_bord: ["polita_rca"] }), context())).toEqual([
      "Certificatul de înmatriculare nu e bifat la bord. Poliția îl cere la control (OUG 195/2002 art. 35).",
    ]);
  });

  it("documentul expirat la data predării se spune", () => {
    const a = avertismentePv(
      pv(),
      context({
        documente: [
          {
            cod: "rca",
            denumire: "Asigurare RCA",
            numar: null,
            expira_la: "2026-10-01",
            valabil: false,
          },
        ],
      }),
    );
    expect(a).toEqual(["Asigurare RCA era expirat la data predării."]);
  });

  it("kilometrajul sub cel curent al vehiculului întreabă de retroactivitate", () => {
    const a = avertismentePv(pv({ km_bord: 50000 }), context({ kmCurentVehicul: 51200 }));
    expect(a).toHaveLength(1);
    expect(a[0]).toMatch(/Predarea e înregistrată retroactiv\?$/u);
  });

  it("predarea simplă cu un predecesor lipit cere transfer", () => {
    expect(avertismentePv(pv(), context({ predecesorLipit: "Popescu Ana" }))).toEqual([
      "Vehiculul vine direct de la Popescu Ana. Întocmiți un proces-verbal de transfer, nu de predare.",
    ]);
  });

  it("alocarea din istoric și întocmirea la distanță de predare se spun", () => {
    const a = avertismentePv(
      pv(),
      context({ alocareDinIstoric: true, ziuaIntocmirii: "2026-10-20" }),
    );
    expect(a).toEqual([
      "Data predării a fost dedusă la introducerea istoricului; verificați-o.",
      "Procesul-verbal se întocmește la 8 zile după predare. Hârtia poartă ambele date: a predării și a întocmirii.",
    ]);
  });

  it("o zi diferență nu avertizează (predarea de seară, finalizată dimineața)", () => {
    expect(avertismentePv(pv(), context({ ziuaIntocmirii: "2026-10-13" }))).toEqual([]);
  });
});

const VEHICUL = {
  nr_inmatriculare: "B123ABC",
  marca: "Dacia",
  model: "Duster",
  vin: null,
  categorie: "autoturism",
  tip_combustibil: "motorina",
  an_fabricatie: 2021,
} as const;

function intrare(peste: Partial<IntrareModelPv> = {}): IntrareModelPv {
  return {
    pv: pv(),
    vehicul: VEHICUL,
    predator: { tip: "firma", nume: "Transport Exemplu SRL", marca: null, functie: null },
    primitor: { tip: "angajat", nume: "Popescu Ana", marca: "A-12", functie: "Agent vânzări" },
    reprezentant: { nume: "Ionescu Maria", functie: "Administrator" },
    firma: "Transport Exemplu SRL",
    documente: [],
    etichete: {
      categorie: { autoturism: "Autoturism" },
      combustibil: { motorina: "Motorină", electric: "Electric" },
    },
    ...peste,
  };
}

function valoare(
  model: ReturnType<typeof modelPv>,
  sectiune: string,
  eticheta: string,
): string | undefined {
  return model.sectiuni
    .find((s) => s.titlu === sectiune)
    ?.randuri.find((r) => r.eticheta === eticheta)?.valoare;
}

describe("modelPv", () => {
  it("subtitlul poartă numărul, data, ora predării și înregistrarea", () => {
    const m = modelPv(intrare());
    expect(m.subtitlu).toBe(
      "Nr. PVA-2026-0003 din 12.10.2026 · predare la 12.10.2026, 10:30 · Înregistrat sub nr. 437/12.10.2026",
    );
    expect(m.operatiunea).toBe("Predarea vehiculului către salariat");
    expect(m.banda).toBeNull();
  });

  it("întocmirea în altă zi decât predarea apare pe hârtie (decizia I-c7)", () => {
    const m = modelPv(intrare({ pv: pv({ finalizat_la: "2026-10-20T09:00:00.000Z" }) }));
    expect(m.subtitlu).toMatch(/· Întocmit la 20\.10\.2026$/u);
  });

  it("fără daune → textul explicit, nu un rând gol", () => {
    expect(modelPv(intrare()).daune).toEqual(["Nu s-au constatat daune vizibile."]);
    const cu = modelPv(
      intrare({
        pv: pv({
          daune_constatate: true,
          daune: [{ zona: "lateral_dreapta", descriere: "Zgârietură ușă" }],
        }),
      }),
    );
    expect(cu.daune).toEqual(["Lateral dreapta — Zgârietură ușă"]);
  });

  it("la electric, nivelul e al bateriei", () => {
    const m = modelPv(intrare({ vehicul: { ...VEHICUL, tip_combustibil: "electric" } }));
    expect(valoare(m, "Kilometraj, rezervor, chei", "Nivel baterie")).toBe("Trei sferturi");
    expect(etichetaNivel("hibrid_plugin")).toBe("Nivel combustibil");
  });

  it("remorca n-are bord: kilometrajul 0 se tipărește „—”", () => {
    const m = modelPv(
      intrare({ vehicul: { ...VEHICUL, categorie: "remorca" }, pv: pv({ km_bord: 0 }) }),
    );
    expect(valoare(m, "Kilometraj, rezervor, chei", "Kilometraj la bord")).toBe("—");
  });

  it("PV-ul anulat poartă banda cu motivul", () => {
    const m = modelPv(
      intrare({
        pv: pv({
          anulat_la: "2026-10-13T09:00:00.000Z",
          motiv_anulare: "Kilometraj citit greșit.",
        }),
      }),
    );
    expect(m.banda).toBe("ANULAT la 13.10.2026, 12:00 — motiv: Kilometraj citit greșit.");
  });

  it("documentul expirat la data predării iese marcat", () => {
    const m = modelPv(
      intrare({
        documente: [
          {
            cod: "rca",
            denumire: "Asigurare RCA",
            numar: "X1",
            expira_la: "2026-10-01",
            valabil: false,
          },
        ],
      }),
    );
    const rca = m.sectiuni
      .find((s) => s.titlu === "Documente la bord")
      ?.randuri.find((r) => r.eticheta === "Polița RCA");
    expect(rca).toEqual({
      eticheta: "Polița RCA",
      valoare: "Da · expirat la data predării (01.10.2026)",
      atentie: true,
    });
  });

  it("dotarea obligatorie lipsă iese marcată, cu temeiul în etichetă", () => {
    const m = modelPv(intrare({ pv: pv({ dotari: [] }) }));
    const stingator = m.sectiuni
      .find((s) => s.titlu === "Dotări")
      ?.randuri.find((r) => r.eticheta.startsWith("Stingător"));
    expect(stingator).toEqual({
      eticheta: "Stingător — obligatorie (OUG 195/2002 art. 8)",
      valoare: "Nu",
      atentie: true,
    });
  });

  it("predarea are două rubrici; transferul trei, cu reprezentantul firmei", () => {
    expect(modelPv(intrare()).semnaturi.map((s) => s.rol)).toEqual(["Am predat", "Am primit"]);
    const transfer = modelPv(
      intrare({
        pv: pv({ tip: "transfer", confirmat_predator_la: "2026-10-12T09:00:00.000Z" }),
        predator: { tip: "angajat", nume: "Ionescu Bogdan", marca: null, functie: null },
      }),
    );
    expect(transfer.semnaturi.map((s) => s.rol)).toEqual([
      "Am predat",
      "Am primit",
      "Reprezentantul firmei",
    ]);
    expect(transfer.semnaturi[0]?.confirmare).toBe(
      "Confirmat în aplicație de Ionescu Bogdan la 12.10.2026, 12:00.",
    );
    expect(transfer.formula).toMatch(/în 3 exemplare/u);
  });

  it("partea-firmă semnează prin reprezentant; formula NU spune că aplicația ține loc de semnătură", () => {
    const m = modelPv(intrare());
    expect(m.semnaturi[0]?.nume).toBe("Transport Exemplu SRL, prin Ionescu Maria");
    expect(m.formula).not.toMatch(/ține loc/u);
    expect(m.formula).toMatch(/în 2 exemplare/u);
  });

  it("ciorna n-are număr", () => {
    expect(
      modelPv(
        intrare({
          pv: pv({ stare: "ciorna", numar: "", numar_registru: null, finalizat_la: null }),
        }),
      ).subtitlu,
    ).toBe("Ciornă, fără număr · predare la 12.10.2026, 10:30");
  });

  it("toate textele au ș și ț cu virgulă dedesubt, fără sedilă", () => {
    const m = modelPv(intrare({ pv: pv({ dotari: [] }) }));
    const tot = JSON.stringify(m);
    expect(tot).not.toMatch(/[şţŞŢ]/u);
  });
});

describe("citesteInstantaneu și citesteDaune", () => {
  it("instantaneul fără vehicul nu e instantaneu", () => {
    expect(citesteInstantaneu(null)).toBeNull();
    expect(citesteInstantaneu({ predator: {} })).toBeNull();
  });

  it("citește forma scrisă de `internal.pv_vehicul_instantaneu`", () => {
    const i = citesteInstantaneu({
      vehicul: { ...VEHICUL },
      predator: { tip: "firma", nume: "Firma SRL", marca: null, functie: null },
      primitor: { tip: "angajat", nume: "Popescu Ana", marca: "A-12", functie: null },
      reprezentant: { nume: "Ionescu Maria", functie: null },
      firma: { denumire: "Firma SRL" },
      documente: [
        {
          cod: "rca",
          denumire: "Asigurare RCA",
          numar: "X",
          expira_la: "2027-01-01",
          valabil: true,
        },
      ],
    });
    expect(i?.vehicul.nr_inmatriculare).toBe("B123ABC");
    expect(i?.primitor).toEqual({
      tip: "angajat",
      nume: "Popescu Ana",
      marca: "A-12",
      functie: null,
    });
    expect(i?.documente).toHaveLength(1);
  });

  it("daunele fără forma cerută se sar", () => {
    expect(
      citesteDaune([
        { zona: "fata", descriere: "Bară" },
        { zona: "necunoscuta", descriere: "x" },
        "text",
      ]),
    ).toEqual([{ zona: "fata", descriere: "Bară" }]);
  });
});

describe("numeFisierPv", () => {
  it("tip, număr de înmatriculare, număr de PV", () => {
    expect(numeFisierPv("predare", "B123ABC", "PVA-2026-0003")).toBe(
      "pv-predare-B123ABC-PVA-2026-0003",
    );
  });
});
