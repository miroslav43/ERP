import { describe, expect, it } from "vitest";

import {
  potrivesteTranzactii,
  type ContextPotrivire,
  type TranzactieDePotrivit,
} from "./potrivire";

const V1 = "veh-1";
const V2 = "veh-2";
const S1 = "sofer-1";
const F1 = "foaie-1";
const A1 = "alim-1";
const A2 = "alim-2";
const C1 = "card-1";

const tx = (peste: Partial<TranzactieDePotrivit> = {}): TranzactieDePotrivit => ({
  emitent: "omv_petrom",
  cifreCard: "1234",
  amprentaCard: null,
  nrInmatriculare: null,
  efectuatLa: "2026-10-05T11:02:00.000Z",
  dataRo: "2026-10-05",
  areOra: true,
  categorie: "combustibil",
  tipCombustibil: "motorina",
  cantitate: 52.3,
  valoareBruta: 380.15,
  moneda: "RON",
  kmDeclarat: null,
  numarBon: null,
  ...peste,
});

const ctx = (peste: Partial<ContextPotrivire> = {}): ContextPotrivire => ({
  carduri: [
    {
      id: C1,
      emitent: "omv_petrom",
      ultimele_cifre: "1234",
      amprenta_numar: null,
      vehicle_id: V1,
      employee_id: null,
    },
  ],
  vehicule: [
    {
      id: V1,
      nr_inmatriculare: "B100XYZ",
      tip_combustibil: "motorina",
      deleted_at: null,
      data_iesire: null,
    },
    {
      id: V2,
      nr_inmatriculare: "CJ12ABC",
      tip_combustibil: "benzina",
      deleted_at: null,
      data_iesire: null,
    },
  ],
  alocari: [],
  foi: [
    {
      id: F1,
      vehicle_id: V1,
      employee_id: S1,
      data: "2026-10-05",
      status: "trimis",
      km_plecare: 10_000,
      km_sosire: 10_250,
    },
  ],
  alimentari: [
    {
      id: A1,
      trip_sheet_id: F1,
      litri: 52.1,
      cost: 379.5,
      alimentat_la: "2026-10-05T10:30:00.000Z",
      numar_bon: null,
    },
  ],
  alimentariDejaLegate: new Set(),
  ...peste,
});

const unu = (t: TranzactieDePotrivit, c: ContextPotrivire = ctx()) => {
  const [r] = potrivesteTranzactii([t], c);
  if (r === undefined) throw new Error("niciun rezultat");
  return r;
};

describe("potrivesteTranzactii — o stare pentru fiecare valoare a enum-ului", () => {
  it("potrivita: litrii și ora în toleranță", () => {
    expect(unu(tx())).toMatchObject({
      stare: "potrivita",
      cardId: C1,
      vehicleId: V1,
      tripSheetId: F1,
      fuelEntryId: A1,
      motiv: null,
    });
  });

  it("diferenta: bonul egal câștigă, dar litrii ies din toleranță", () => {
    const c = ctx({
      alimentari: [
        {
          id: A1,
          trip_sheet_id: F1,
          litri: 40,
          cost: 290,
          alimentat_la: "2026-10-05T06:00:00.000Z",
          numar_bon: "BON-7",
        },
      ],
    });
    const r = unu(tx({ numarBon: "bon-7" }), c);
    expect(r.stare).toBe("diferenta");
    expect(r.fuelEntryId).toBe(A1);
    expect(r.motiv).toContain("litri: card 52,3, foaie 40");
  });

  it("fara_alimentare: foaia există, alimentarea nu", () => {
    expect(unu(tx(), ctx({ alimentari: [] }))).toMatchObject({
      stare: "fara_alimentare",
      tripSheetId: F1,
      fuelEntryId: null,
    });
  });

  it("fara_foaie: vehiculul e cunoscut, foaia zilei nu", () => {
    expect(unu(tx({ dataRo: "2026-10-06", efectuatLa: "2026-10-06T08:00:00.000Z" }))).toMatchObject(
      { stare: "fara_foaie", vehicleId: V1, tripSheetId: null },
    );
  });

  it("vehicul_necunoscut: cardul e de rezervă, fără vehicul și fără șofer", () => {
    const c = ctx({
      carduri: [
        {
          id: C1,
          emitent: "omv_petrom",
          ultimele_cifre: "1234",
          amprenta_numar: null,
          vehicle_id: null,
          employee_id: null,
        },
      ],
    });
    expect(unu(tx(), c)).toMatchObject({
      stare: "vehicul_necunoscut",
      cardId: C1,
      vehicleId: null,
    });
  });

  it("card_necunoscut: nici cardul, nici extrasul nu duc la un vehicul", () => {
    expect(unu(tx({ cifreCard: "9999" }))).toMatchObject({
      stare: "card_necunoscut",
      cardId: null,
    });
  });

  it("necombustibil: AdBlue nu cere și nu primește alimentare pe foaie", () => {
    const r = unu(tx({ categorie: "adblue", tipCombustibil: null, cantitate: 10 }));
    expect(r).toMatchObject({ stare: "necombustibil", categorie: "adblue", vehicleId: V1 });
    expect(r.fuelEntryId).toBeNull();
    expect(r.tripSheetId).toBeNull();
  });

  it("ignorata: stornoul (cantitate sau valoare negativă) → `corectie`", () => {
    expect(unu(tx({ cantitate: -52.3, valoareBruta: -380.15 }))).toMatchObject({
      stare: "ignorata",
      categorie: "corectie",
      motiv: "Storno din extras.",
      fuelEntryId: null,
    });
  });
});

describe("potrivesteTranzactii — reguli", () => {
  it("bonul egal bate litrii: alege alimentarea cu bonul, nu pe cea mai apropiată", () => {
    const c = ctx({
      alimentari: [
        {
          id: A1,
          trip_sheet_id: F1,
          litri: 52.3,
          cost: 380.15,
          alimentat_la: "2026-10-05T11:00:00.000Z",
          numar_bon: null,
        },
        {
          id: A2,
          trip_sheet_id: F1,
          litri: 52.2,
          cost: 380,
          alimentat_la: "2026-10-05T11:00:00.000Z",
          numar_bon: "77",
        },
      ],
    });
    expect(unu(tx({ numarBon: "77" }), c).fuelEntryId).toBe(A2);
  });

  it("o alimentare nu se leagă de două tranzacții din același lot", () => {
    const [a, b] = potrivesteTranzactii([tx(), tx()], ctx());
    expect(a?.stare).toBe("potrivita");
    expect(b?.stare).toBe("fara_alimentare");
  });

  it("alimentarea legată deja în bază nu se mai ia", () => {
    expect(unu(tx(), ctx({ alimentariDejaLegate: new Set([A1]) })).stare).toBe("fara_alimentare");
  });

  it("cifre duplicate la același emitent → card_necunoscut, cu motivul", () => {
    const c = ctx({
      carduri: [
        {
          id: C1,
          emitent: "omv_petrom",
          ultimele_cifre: "1234",
          amprenta_numar: null,
          vehicle_id: V1,
          employee_id: null,
        },
        {
          id: "card-2",
          emitent: "omv_petrom",
          ultimele_cifre: "991234",
          amprenta_numar: null,
          vehicle_id: V2,
          employee_id: null,
        },
      ],
    });
    const r = unu(tx({ cifreCard: "1234" }), c);
    expect(r.stare).toBe("card_necunoscut");
    expect(r.motiv).toContain("se potrivesc cu 2 carduri");
  });

  it("amprenta numărului întreg rezolvă cifrele duplicate", () => {
    const c = ctx({
      carduri: [
        {
          id: C1,
          emitent: "omv_petrom",
          ultimele_cifre: "1234",
          amprenta_numar: "a".repeat(64),
          vehicle_id: V1,
          employee_id: null,
        },
        {
          id: "card-2",
          emitent: "omv_petrom",
          ultimele_cifre: "1234",
          amprenta_numar: "b".repeat(64),
          vehicle_id: V2,
          employee_id: null,
        },
      ],
    });
    expect(unu(tx({ amprentaCard: "a".repeat(64) }), c).cardId).toBe(C1);
  });

  it("cardul altui emitent nu se potrivește", () => {
    expect(unu(tx({ emitent: "mol" })).stare).toBe("card_necunoscut");
  });

  it("extrasul cu alt număr de înmatriculare decât cardul: extrasul câștigă, cu motiv", () => {
    const r = unu(tx({ nrInmatriculare: "CJ12ABC" }));
    expect(r.vehicleId).toBe(V2);
    expect(r.stare).toBe("fara_foaie");
    expect(r.motiv).toContain("Cardul e înregistrat pe alt vehicul.");
  });

  // Din 0218 (F12h, implicita I-h2), numărul unui vehicul ieșit se poate pune pe
  // o mașină nouă: același număr stă pe DOUĂ vehicule neșterse. Ordinea din
  // context e arbitrară, deci fiecare caz pune vehiculul greșit primul.
  it("numărul păstrat, pe mașina nouă: după ieșire, extrasul ajunge la mașina din parc", () => {
    const V3 = "veh-3";
    const c = ctx({
      vehicule: [
        {
          id: V1,
          nr_inmatriculare: "B100XYZ",
          tip_combustibil: "motorina",
          deleted_at: null,
          data_iesire: "2026-09-30",
        },
        {
          id: V3,
          nr_inmatriculare: "B100XYZ",
          tip_combustibil: "motorina",
          deleted_at: null,
          data_iesire: null,
        },
      ],
    });
    expect(unu(tx({ nrInmatriculare: "B100XYZ" }), c).vehicleId).toBe(V3);
  });

  it("numărul păstrat: o tranzacție din ziua ieșirii sau dinainte rămâne a vehiculului ieșit", () => {
    const V3 = "veh-3";
    const c = ctx({
      vehicule: [
        {
          id: V3,
          nr_inmatriculare: "B100XYZ",
          tip_combustibil: "motorina",
          deleted_at: null,
          data_iesire: null,
        },
        {
          id: V1,
          nr_inmatriculare: "B100XYZ",
          tip_combustibil: "motorina",
          deleted_at: null,
          data_iesire: "2026-10-05",
        },
      ],
    });
    expect(unu(tx({ nrInmatriculare: "B100XYZ" }), c).vehicleId).toBe(V1);
    expect(
      unu(
        tx({
          nrInmatriculare: "B100XYZ",
          dataRo: "2026-09-28",
          efectuatLa: "2026-09-28T08:00:00.000Z",
        }),
        c,
      ).vehicleId,
    ).toBe(V1);
  });

  it("foaia `respins` e ignorată", () => {
    const c = ctx({
      foi: [
        {
          id: F1,
          vehicle_id: V1,
          employee_id: S1,
          data: "2026-10-05",
          status: "respins",
          km_plecare: 1,
          km_sosire: 2,
        },
      ],
    });
    expect(unu(tx(), c).stare).toBe("fara_foaie");
  });

  it("cifre pe sufix: card cu 4, extras cu 6, și invers", () => {
    expect(unu(tx({ cifreCard: "561234" })).cardId).toBe(C1);
    const c = ctx({
      carduri: [
        {
          id: C1,
          emitent: "omv_petrom",
          ultimele_cifre: "561234",
          amprenta_numar: null,
          vehicle_id: V1,
          employee_id: null,
        },
      ],
    });
    expect(unu(tx({ cifreCard: "1234" }), c).cardId).toBe(C1);
  });

  it("benzină pe un vehicul diesel → motivul o spune, starea rămâne", () => {
    const r = unu(tx({ tipCombustibil: "benzina" }));
    expect(r.stare).toBe("potrivita");
    expect(r.motiv).toBe("Produsul (benzină) nu corespunde vehiculului (motorină).");
  });

  it("valoarea în afara toleranței contează doar în RON", () => {
    const ron = unu(tx({ valoareBruta: 420 }));
    expect(ron.stare).toBe("diferenta");
    expect(ron.motiv).toContain("valoare: card 420 lei");
    expect(unu(tx({ valoareBruta: 420, moneda: "EUR" })).stare).toBe("potrivita");
  });

  it("ora în afara a ±3 h nu potrivește; fără oră în extras, ora nu se judecă", () => {
    const departe = tx({ efectuatLa: "2026-10-05T16:00:00.000Z" });
    expect(unu(departe).stare).toBe("fara_alimentare");
    expect(unu({ ...departe, areOra: false }).stare).toBe("potrivita");
  });

  it("kilometrajul de la pompă în afara foii se adaugă la motiv", () => {
    const r = unu(tx({ kmDeclarat: 12_000 }));
    expect(r.stare).toBe("potrivita");
    expect(r.motiv).toBe("Kilometrajul de la pompă (12000) e în afara foii (10000–10250).");
  });

  it("cardul pe șofer: foaia unică a șoferului în ziua aceea dă vehiculul", () => {
    const c = ctx({
      carduri: [
        {
          id: C1,
          emitent: "omv_petrom",
          ultimele_cifre: "1234",
          amprenta_numar: null,
          vehicle_id: null,
          employee_id: S1,
        },
      ],
    });
    expect(unu(tx(), c)).toMatchObject({ vehicleId: V1, stare: "potrivita" });
  });

  it("cardul pe șofer fără foaie: alocarea lui la moment dă vehiculul", () => {
    const c = ctx({
      carduri: [
        {
          id: C1,
          emitent: "omv_petrom",
          ultimele_cifre: "1234",
          amprenta_numar: null,
          vehicle_id: null,
          employee_id: S1,
        },
      ],
      foi: [],
      alocari: [
        { vehicle_id: V2, employee_id: S1, de_la: "2026-10-01T00:00:00.000Z", pana_la: null },
      ],
    });
    expect(unu(tx(), c)).toMatchObject({ vehicleId: V2, stare: "fara_foaie" });
  });
});
