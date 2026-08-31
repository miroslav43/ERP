// src/lib/asistent/marcaje.test.ts
/**
 * Cazul central e al treilea: identificatorul inventat. Restul testelor apără
 * randarea; acela apără promisiunea făcută utilizatorului — că orice pastilă
 * pe care o vede duce undeva.
 */
import { describe, expect, it } from "vitest";

import type { Destinatie } from "./destinatii";
import { imparteRaspuns, ruteleDinRaspuns, type Segment } from "./marcaje";

const text = (segmente: readonly Segment[]): readonly string[] =>
  segmente.flatMap((s) => (s.tip === "text" ? [s.text] : []));

const rute = (segmente: readonly Segment[]): readonly string[] =>
  segmente.flatMap((s) => (s.tip === "ruta" ? [s.destinatie.id] : []));

describe("imparteRaspuns", () => {
  it("lasă textul fără marcaje neatins", () => {
    const segmente = imparteRaspuns("Pontajul se completează zilnic.");
    expect(segmente).toEqual([{ tip: "text", text: "Pontajul se completează zilnic." }]);
  });

  it("transformă un marcaj cunoscut în destinație", () => {
    const segmente = imparteRaspuns("Mergi la [[ruta:pontaj.saptamana]] și completează orele.");
    expect(rute(segmente)).toEqual(["pontaj.saptamana"]);
    expect(text(segmente)).toEqual(["Mergi la ", " și completează orele."]);
  });

  it("ARUNCĂ un identificator inventat și păstrează fraza", () => {
    // Exact ce va face modelul din când în când. Omul vede o frază completă,
    // fără pastilă — niciodată o pastilă care duce în 404.
    const segmente = imparteRaspuns("Orele se trec în [[ruta:pontaj.orele-mele]] zilnic.");
    expect(rute(segmente)).toEqual([]);
    expect(text(segmente)).toEqual(["Orele se trec în  zilnic."]);
  });

  it("nu randează niciodată marcajul ca text brut", () => {
    for (const brut of [
      "[[ruta:inventat]]",
      "[[ruta:pontaj.saptamana]]",
      "[[ruta:]]",
      "[[ruta:MAJUSCULE]]",
    ]) {
      const scris = text(imparteRaspuns(`a ${brut} b`)).join("");
      expect(scris, brut).not.toContain("[[");
      expect(scris, brut).not.toContain("ruta:");
    }
  });

  it("acceptă mai multe marcaje în același răspuns", () => {
    const segmente = imparteRaspuns(
      "Întâi [[ruta:pontaj.saptamana]], apoi aprobarea în [[ruta:pontaj.aprobare]].",
    );
    expect(rute(segmente)).toEqual(["pontaj.saptamana", "pontaj.aprobare"]);
  });

  it("reunește textul rămas de o parte și de alta a unui marcaj aruncat", () => {
    // Două segmente de text lipite ar face randarea de markdown să vadă două
    // paragrafe acolo unde e o singură frază.
    const segmente = imparteRaspuns("Deschide [[ruta:habar-nu-am]] pagina.");
    expect(segmente).toHaveLength(1);
    expect(text(segmente)).toEqual(["Deschide  pagina."]);
  });
});

describe("marcaje tăiate de flux", () => {
  it("reține un marcaj neterminat de la coadă cât timp răspunsul curge", () => {
    // Fiecare prefix al unui marcaj complet trebuie ascuns, altfel gunoiul
    // clipește pe ecran la fiecare referință.
    const complet = "Mergi la [[ruta:pontaj.saptamana]]";
    for (let i = "Mergi la ".length; i < complet.length; i += 1) {
      const scris = text(imparteRaspuns(complet.slice(0, i), { inCurs: true })).join("");
      expect(scris, complet.slice(0, i)).toBe("Mergi la ");
    }
  });

  it("randează marcajul în clipa în care e întreg", () => {
    const segmente = imparteRaspuns("Mergi la [[ruta:pontaj.saptamana]]", { inCurs: true });
    expect(rute(segmente)).toEqual(["pontaj.saptamana"]);
  });

  it("nu reține nimic după ce fluxul s-a încheiat", () => {
    // Un răspuns care chiar se termină cu „[[" e text, nu marcaj în devenire.
    expect(text(imparteRaspuns("ceva [["))).toEqual(["ceva [["]);
  });

  it("nu blochează un `[[` orfan din mijlocul textului", () => {
    const segmente = imparteRaspuns("a [[ b [[ruta:panou]] c", { inCurs: true });
    expect(rute(segmente)).toEqual(["panou"]);
    expect(text(segmente).join("")).toContain("a [[ b ");
  });
});

describe("destinații efemere, produse de unelte", () => {
  const fisa: Destinatie = {
    id: "fisa.11111111-2222-3333-4444-555555555555",
    href: "/angajati/11111111-2222-3333-4444-555555555555",
    eticheta: "Ion Popescu",
    zona: "app",
    parinte: "angajati",
    fila: null,
    featureKey: null,
    permission: "employees:read",
    minScope: "team",
    descriere: "Fișa angajatului Ion Popescu.",
    drum: ["Personal", "Angajați", "Ion Popescu"],
  };

  const extra = new Map([[fisa.id, fisa]]);

  it("rezolvă o fișă întoarsă de unealtă în chiar răspunsul acesta", () => {
    const segmente = imparteRaspuns(`Fișa lui este [[ruta:${fisa.id}]].`, { extra });
    expect(rute(segmente)).toEqual([fisa.id]);
  });

  it("aruncă un UUID pe care nicio unealtă nu l-a întors", () => {
    // Mulțimea rămâne închisă, doar că e închisă prin proveniență: singurul mod
    // de a intra în `extra` e o citire pe care omul chiar avea dreptul să o facă.
    const segmente = imparteRaspuns(
      "Fișa e la [[ruta:fisa.99999999-0000-0000-0000-000000000000]].",
      {
        extra,
      },
    );
    expect(rute(segmente)).toEqual([]);
    expect(text(segmente).join("")).toBe("Fișa e la .");
  });

  it("nu strică rezolvarea destinațiilor statice", () => {
    const segmente = imparteRaspuns("[[ruta:panou]] și [[ruta:" + fisa.id + "]]", { extra });
    expect(rute(segmente)).toEqual(["panou", fisa.id]);
  });
});

describe("ruteleDinRaspuns", () => {
  it("adună destinațiile în ordine, o singură dată fiecare", () => {
    const rezultat = ruteleDinRaspuns("[[ruta:panou]] apoi [[ruta:pontaj]] și iar [[ruta:panou]].");
    expect(rezultat.map((d) => d.id)).toEqual(["panou", "pontaj"]);
  });

  it("întoarce lista goală când nu există nicio destinație validă", () => {
    expect(ruteleDinRaspuns("Nu știu unde e [[ruta:nicaieri]].")).toEqual([]);
  });

  it("dă destinații întregi, cu href și drum de click", () => {
    const [destinatie] = ruteleDinRaspuns("[[ruta:pontaj.saptamana]]");
    expect(destinatie?.href).toBe("/pontaj/saptamana");
    expect(destinatie?.drum).toEqual(["Operațiuni", "Pontaj", "Planul săptămânii"]);
  });
});
