import { describe, expect, it } from "vitest";

import { CAMPURI_EXTRAS, ETICHETE_CAMP_EXTRAS, SINONIME_COMUNE, detecteazaMapare } from "./coloane";

describe("detecteazaMapare", () => {
  it("antet românesc", () => {
    const r = detecteazaMapare(
      ["Număr card", "Nr. auto", "Data", "Ora", "Produs", "Cantitate (litri)", "Valoare", "Stația"],
      "altul",
      null,
    );
    expect(r.mapare).toMatchObject({
      numar_card: "Număr card",
      nr_inmatriculare: "Nr. auto",
      data: "Data",
      ora: "Ora",
      produs: "Produs",
      cantitate: "Cantitate (litri)",
      valoare_bruta: "Valoare",
      statie: "Stația",
    });
    expect(r.lipsa).toEqual([]);
    expect(r.ambigue).toEqual([]);
  });

  it("antet englezesc", () => {
    const r = detecteazaMapare(
      [
        "Card Number",
        "Transaction Date",
        "Product",
        "Quantity",
        "Gross Amount",
        "Currency",
        "Site",
      ],
      "shell",
      null,
    );
    expect(r.mapare).toMatchObject({
      numar_card: "Card Number",
      data_ora: "Transaction Date",
      produs: "Product",
      cantitate: "Quantity",
      valoare_bruta: "Gross Amount",
      moneda: "Currency",
      statie: "Site",
    });
    expect(r.lipsa).toEqual([]);
  });

  it("antet nemțesc", () => {
    const r = detecteazaMapare(
      ["Kartennummer", "Kennzeichen", "Datum", "Uhrzeit", "Produkt", "Menge", "Bruttobetrag"],
      "dkv",
      null,
    );
    expect(r.mapare).toMatchObject({
      numar_card: "Kartennummer",
      nr_inmatriculare: "Kennzeichen",
      data: "Datum",
      ora: "Uhrzeit",
      produs: "Produkt",
      cantitate: "Menge",
      valoare_bruta: "Bruttobetrag",
    });
  });

  it("profilul salvat bate presetarea și sinonimele", () => {
    const antet = ["Card", "Card ID", "Data", "Produs", "Valoare"];
    const fara = detecteazaMapare(antet, "mol", null);
    expect(fara.mapare.numar_card).toBe("Card ID"); // presetarea MOL
    const cu = detecteazaMapare(antet, "mol", { mapare: { numar_card: "Card" } });
    expect(cu.mapare.numar_card).toBe("Card");
  });

  it("un profil care numește o coloană absentă din fișier nu se aplică", () => {
    const r = detecteazaMapare(["Nr card", "Data", "Produs", "Suma"], "altul", {
      mapare: { numar_card: "Coloana veche" },
    });
    expect(r.mapare.numar_card).toBe("Nr card");
  });

  it("obligatoriul lipsă apare în `lipsa`, cu eticheta grupului", () => {
    const r = detecteazaMapare(["Data", "Produs", "Valoare"], "altul", null);
    expect(r.lipsa).toEqual([
      `${ETICHETE_CAMP_EXTRAS.numar_card} sau ${ETICHETE_CAMP_EXTRAS.nr_inmatriculare}`,
    ]);
  });

  it("două coloane la fel de bune → `ambigue`, nu o alegere tăcută", () => {
    const r = detecteazaMapare(
      ["Nr card", "Card number", "Data", "Produs", "Valoare"],
      "altul",
      null,
    );
    expect(r.ambigue).toEqual([{ camp: "numar_card", coloane: ["Nr card", "Card number"] }]);
    expect(r.mapare.numar_card).toBeUndefined();
  });

  it("o coloană nu servește două câmpuri", () => {
    const r = detecteazaMapare(
      ["Valoare", "Valoare fara TVA", "TVA", "Data", "Produs", "Nr auto"],
      "altul",
      null,
    );
    expect(r.mapare.valoare_bruta).toBe("Valoare");
    expect(r.mapare.valoare_neta).toBe("Valoare fara TVA");
    expect(r.mapare.tva).toBe("TVA");
  });

  it("fiecare câmp canonic are etichetă și sinonime", () => {
    for (const camp of CAMPURI_EXTRAS) {
      expect(ETICHETE_CAMP_EXTRAS[camp].length).toBeGreaterThan(0);
      expect(SINONIME_COMUNE[camp].length).toBeGreaterThan(0);
    }
  });
});
