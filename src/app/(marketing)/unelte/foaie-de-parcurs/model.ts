import type { DocumentTabelar } from "@/lib/unelte/document-tabelar";

import { construiesteFoaie, normalizeazaAn, normalizeazaLuna } from "../foaie-de-pontaj/foaie";

/**
 * Foaia de parcurs lunară: un rând pe fiecare zi, cu traseul, scopul și
 * kilometrii. Zilele vin din `construiesteFoaie`; weekendurile NU se scot,
 * fiindcă o mașină de serviciu poate circula și sâmbăta.
 */

export type ParametriFoaieParcurs = Readonly<{
  an: number;
  luna: number;
  nrAuto: string;
  marca: string;
  sofer: string;
  firma: string;
}>;

const text = (v: string | null) => (v ?? "").trim().slice(0, 120);

export function parametriFoaieParcurs(q: URLSearchParams): ParametriFoaieParcurs {
  const acum = new Date();
  return {
    an: normalizeazaAn(q.get("an") ?? undefined, acum.getUTCFullYear()),
    luna: normalizeazaLuna(q.get("luna") ?? undefined, acum.getUTCMonth() + 1),
    nrAuto: text(q.get("auto")),
    marca: text(q.get("marca")),
    sofer: text(q.get("sofer")),
    firma: text(q.get("firma")),
  };
}

export function construiesteFoaieParcurs(o: ParametriFoaieParcurs): DocumentTabelar {
  const foaie = construiesteFoaie(o.an, o.luna, [""], 8);
  const ll = String(o.luna).padStart(2, "0");
  return {
    titlu: `Foaie de parcurs — ${foaie.eticheta}`,
    subtitlu: o.firma === "" ? null : o.firma,
    campuri: [
      { eticheta: "Nr. de înmatriculare", valoare: o.nrAuto },
      { eticheta: "Marca și modelul", valoare: o.marca },
      { eticheta: "Conducător auto", valoare: o.sofer },
    ],
    paragrafe: [],
    coloane: [
      { eticheta: "Data", latime: 2 },
      { eticheta: "Ora\nplecării", latime: 1.5 },
      { eticheta: "Traseul (de la – la)", latime: 6 },
      { eticheta: "Scopul deplasării", latime: 5 },
      { eticheta: "Km la\nplecare", latime: 2 },
      { eticheta: "Km la\nsosire", latime: 2 },
      { eticheta: "Km\nparcurși", latime: 1.5 },
      { eticheta: "Semnătura", latime: 2.5 },
    ],
    randuri: foaie.zile.map((z) => [
      `${String(z.zi).padStart(2, "0")}.${ll}.${String(o.an)}`,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ]),
    umbrite: [],
    note: [
      "Total km parcurși în lună: ________   Consum normat (l/100 km): ________   Combustibil consumat (l): ________",
    ],
    semnaturi: ["Conducător auto", "Verificat (administrator)"],
    orientare: "peisaj",
    numeFisier: `foaie-de-parcurs-${String(o.an)}-${ll}`,
  };
}

export function foaieParcursDinParametri(q: URLSearchParams): DocumentTabelar {
  return construiesteFoaieParcurs(parametriFoaieParcurs(q));
}
