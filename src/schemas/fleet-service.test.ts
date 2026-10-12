import { describe, expect, it } from "vitest";

import { vehiculNouSchema } from "./fleet";
import {
  actualizeazaPlanServiceSchema,
  cheltuialaSchema,
  filtreServiceSchema,
  intrareServiceSchema,
  planServiceSchema,
} from "./fleet-service";

const ID = "6f1c1c58-3b7e-4a43-9a52-1f3d5c0d7e11";
const ID_2 = "0b2a9a7a-77c4-4d6e-8a52-5c1a4a8f0a22";

const plan = {
  vehicle_id: ID,
  denumire: "Revizie periodică",
  interval_km: "10000",
  interval_luni: "12",
  baza_data: "2026-07-01",
  baza_km: "40000",
};

function mesaje(
  rezultat: ReturnType<typeof planServiceSchema.safeParse>,
): Record<string, string[]> {
  if (rezultat.success) return {};
  const iesire: Record<string, string[]> = {};
  for (const i of rezultat.error.issues) {
    const cheie = String(i.path[0] ?? "");
    (iesire[cheie] ??= []).push(i.message);
  }
  return iesire;
}

describe("planServiceSchema", () => {
  it("primește valorile ca șiruri, cum vin din formular, și le face numere", () => {
    const r = planServiceSchema.parse(plan);
    expect(r).toMatchObject({
      interval_km: 10000,
      interval_luni: 12,
      baza_km: 40000,
      tip: "revizie",
      prag_avertizare_km: 1000,
      observatii: null,
    });
  });

  it("un singur interval ajunge: celălalt rămâne null, nu 0", () => {
    const doarLuni = planServiceSchema.parse({ ...plan, interval_km: "" });
    expect(doarLuni.interval_km).toBeNull();
    expect(doarLuni.interval_luni).toBe(12);
    const doarKm = planServiceSchema.parse({ ...plan, interval_luni: "" });
    expect(doarKm.interval_luni).toBeNull();
  });

  it("fără niciun interval: mesaj pe ambele câmpuri, nu 23514 de la bază", () => {
    const m = mesaje(planServiceSchema.safeParse({ ...plan, interval_km: "", interval_luni: "" }));
    expect(m["interval_km"]).toEqual(["Alegeți cel puțin un interval: în kilometri sau în luni."]);
    expect(m["interval_luni"]).toEqual([
      "Alegeți cel puțin un interval: în kilometri sau în luni.",
    ]);
  });

  it("kilometrajul de bază lipsă spune că lipsește, nu devine 0", () => {
    const m = mesaje(planServiceSchema.safeParse({ ...plan, baza_km: "" }));
    expect(m["baza_km"]?.[0]).toContain("Scrieți kilometrajul");
  });

  it("intervalele în afara limitelor bazei sunt refuzate cu mesaj pe câmp", () => {
    expect(
      mesaje(planServiceSchema.safeParse({ ...plan, interval_km: "50" }))["interval_km"],
    ).toBeDefined();
    expect(
      mesaje(planServiceSchema.safeParse({ ...plan, interval_km: "1000001" }))["interval_km"],
    ).toBeDefined();
    expect(
      mesaje(planServiceSchema.safeParse({ ...plan, interval_luni: "241" }))["interval_luni"],
    ).toBeDefined();
    expect(
      mesaje(planServiceSchema.safeParse({ ...plan, interval_luni: "1.5" }))["interval_luni"],
    ).toBeDefined();
  });

  it("derivatele calculate de bază nu trec prin schemă", () => {
    const r = planServiceSchema.parse({
      ...plan,
      urmatoarea_data: "2099-01-01",
      urmatorii_km: 1,
      ultima_data: "2099-01-01",
    });
    expect(r).not.toHaveProperty("urmatoarea_data");
    expect(r).not.toHaveProperty("urmatorii_km");
    expect(r).not.toHaveProperty("ultima_data");
  });

  it("denumirea trebuie scrisă; data trebuie să existe în calendar", () => {
    expect(
      mesaje(planServiceSchema.safeParse({ ...plan, denumire: " " }))["denumire"],
    ).toBeDefined();
    expect(
      mesaje(planServiceSchema.safeParse({ ...plan, baza_data: "2026-02-31" }))["baza_data"],
    ).toBeDefined();
    expect(
      mesaje(planServiceSchema.safeParse({ ...plan, baza_data: "" }))["baza_data"],
    ).toBeDefined();
  });
});

describe("actualizeazaPlanServiceSchema", () => {
  it("cere `activ` și id-ul, plus aceleași reguli de interval", () => {
    const ok = actualizeazaPlanServiceSchema.safeParse({ ...plan, id: ID_2, activ: false });
    expect(ok.success).toBe(true);
    const fara = actualizeazaPlanServiceSchema.safeParse({ ...plan, id: ID_2 });
    expect(fara.success).toBe(false);
    const goale = actualizeazaPlanServiceSchema.safeParse({
      ...plan,
      id: ID_2,
      activ: true,
      interval_km: "",
      interval_luni: "",
    });
    expect(goale.success).toBe(false);
  });
});

const intrare = {
  vehicle_id: ID,
  data_interventiei: "2026-10-01",
  km: "46500",
  tip: "revizie",
  descriere: "Ulei și filtre",
  cost_piese: "300",
  cost_manopera: "450.50",
};

describe("intrareServiceSchema", () => {
  it("costurile sunt lei cu cel mult două zecimale; goale înseamnă zero", () => {
    const r = intrareServiceSchema.parse({ ...intrare, cost_piese: "", cost_manopera: "450.5" });
    expect(r.cost_piese).toBe(0);
    expect(r.cost_manopera).toBe(450.5);
    expect(intrareServiceSchema.safeParse({ ...intrare, cost_piese: "10.123" }).success).toBe(
      false,
    );
    expect(intrareServiceSchema.safeParse({ ...intrare, cost_piese: "-5" }).success).toBe(false);
  });

  it("planul e opțional: gol devine null, un uuid trece, altceva pică", () => {
    expect(intrareServiceSchema.parse({ ...intrare, plan_id: "" }).plan_id).toBeNull();
    expect(intrareServiceSchema.parse({ ...intrare, plan_id: ID_2 }).plan_id).toBe(ID_2);
    expect(intrareServiceSchema.safeParse({ ...intrare, plan_id: "nu-e-uuid" }).success).toBe(
      false,
    );
  });

  it("anvelopele montate doar la tipul „anvelope” — mesaj pe câmp, nu 23514", () => {
    const gresit = intrareServiceSchema.safeParse({ ...intrare, anvelope_montate: "iarna" });
    expect(gresit.success).toBe(false);
    if (!gresit.success) {
      expect(gresit.error.issues[0]?.path).toEqual(["anvelope_montate"]);
    }
    const bun = intrareServiceSchema.parse({
      ...intrare,
      tip: "anvelope",
      anvelope_montate: "iarna",
    });
    expect(bun.anvelope_montate).toBe("iarna");
    // „Necunoscut” (șir gol) e permis la orice tip: devine null.
    expect(
      intrareServiceSchema.parse({ ...intrare, anvelope_montate: "" }).anvelope_montate,
    ).toBeNull();
  });

  it("descrierea și kilometrajul sunt obligatorii", () => {
    expect(intrareServiceSchema.safeParse({ ...intrare, descriere: "" }).success).toBe(false);
    expect(intrareServiceSchema.safeParse({ ...intrare, km: "" }).success).toBe(false);
    expect(intrareServiceSchema.safeParse({ ...intrare, km: "10000001" }).success).toBe(false);
  });
});

const cheltuiala = {
  vehicle_id: ID,
  categorie: "parcare",
  data_cheltuielii: "2026-10-02",
  suma: "15",
};

describe("cheltuialaSchema", () => {
  it("suma e obligatorie și pozitivă, cu cel mult două zecimale", () => {
    expect(cheltuialaSchema.parse(cheltuiala).suma).toBe(15);
    expect(cheltuialaSchema.safeParse({ ...cheltuiala, suma: "" }).success).toBe(false);
    expect(cheltuialaSchema.safeParse({ ...cheltuiala, suma: "0" }).success).toBe(false);
    expect(cheltuialaSchema.safeParse({ ...cheltuiala, suma: "12.345" }).success).toBe(false);
  });

  it("litrii doar la „Combustibil fără foaie”", () => {
    expect(cheltuialaSchema.safeParse({ ...cheltuiala, litri: "20" }).success).toBe(false);
    const bun = cheltuialaSchema.parse({
      ...cheltuiala,
      categorie: "combustibil_fara_foaie",
      litri: "40.5",
      km_bord: "46550",
    });
    expect(bun.litri).toBe(40.5);
    expect(bun.km_bord).toBe(46550);
  });

  it("câmpurile opționale goale devin null, nu zero", () => {
    const r = cheltuialaSchema.parse({ ...cheltuiala, litri: "", km_bord: "", numar_document: "" });
    expect(r.litri).toBeNull();
    expect(r.km_bord).toBeNull();
    expect(r.numar_document).toBeNull();
  });
});

describe("filtreServiceSchema", () => {
  it("implicit: fără filă, ultimele 12 luni", () => {
    expect(filtreServiceSchema.parse({})).toEqual({ fila: null, perioada: "12", cursor: null });
  });

  it("acceptă filele și perioadele cunoscute", () => {
    expect(filtreServiceSchema.parse({ fila: "costuri", perioada: "tot" })).toMatchObject({
      fila: "costuri",
      perioada: "tot",
    });
  });

  it("o valoare necunoscută nu trece: pagina cade pe implicit prin filtreDinUrl", () => {
    expect(filtreServiceSchema.safeParse({ fila: "altceva" }).success).toBe(false);
    expect(filtreServiceSchema.safeParse({ perioada: "7" }).success).toBe(false);
  });
});

describe("vehiculNouSchema — anvelopele montate", () => {
  const vehicul = {
    nr_inmatriculare: "B123ABC",
    marca: "Dacia",
    model: "Logan",
    km_curent: "1000",
  };

  it("lipsa sau „Necunoscut” înseamnă null; o valoare din listă trece", () => {
    expect(vehiculNouSchema.parse(vehicul).anvelope_montate).toBeNull();
    expect(
      vehiculNouSchema.parse({ ...vehicul, anvelope_montate: "" }).anvelope_montate,
    ).toBeNull();
    expect(vehiculNouSchema.parse({ ...vehicul, anvelope_montate: "vara" }).anvelope_montate).toBe(
      "vara",
    );
    expect(vehiculNouSchema.safeParse({ ...vehicul, anvelope_montate: "toate" }).success).toBe(
      false,
    );
  });
});
