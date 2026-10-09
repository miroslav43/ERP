import type { DocumentTabelar } from "@/lib/unelte/document-tabelar";

import { textNorma, type Foaie } from "./foaie";

/**
 * Foaia de pontaj ca `DocumentTabelar`, pentru PDF și Word.
 *
 * Excelul rămâne pe generatorul lui din `route.ts`: acolo totalurile sunt
 * FORMULE, iar modelul comun nu știe de formule. PDF-ul și Word-ul se tipăresc
 * și se completează de mână, deci totalul e o coloană goală.
 */
export function foaieCaDocument(foaie: Foaie, notaAngajati: string | null = null): DocumentTabelar {
  const sarbatori = foaie.zile.filter((z) => z.sarbatoare !== null);
  const listaSarbatori = sarbatori.map((z) => `${String(z.zi)} ${z.sarbatoare ?? ""}`).join("; ");
  return {
    titlu: `Foaie colectivă de prezență — ${foaie.eticheta}`,
    subtitlu: textNorma(foaie),
    campuri: [],
    paragrafe: [],
    coloane: [
      { eticheta: "Angajat", latime: 8 },
      ...foaie.zile.map((z) => ({ eticheta: `${String(z.zi)}\n${z.litera}`, latime: 1 })),
      { eticheta: "Total", latime: 2 },
    ],
    randuri: foaie.angajati.map((nume) => [nume, ...foaie.zile.map(() => ""), ""]),
    umbrite: foaie.zile.flatMap((z, i) => (z.weekend || z.sarbatoare !== null ? [i + 1] : [])),
    note: [
      `Sărbători legale în lună: ${listaSarbatori === "" ? "niciuna" : listaSarbatori}`,
      ...(notaAngajati === null ? [] : [notaAngajati]),
    ],
    semnaturi: ["Întocmit", "Verificat"],
    orientare: "peisaj",
    numeFisier: `pontaj-${String(foaie.an)}-${String(foaie.luna).padStart(2, "0")}`,
  };
}
