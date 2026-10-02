import type { DocumentTabelar } from "@/lib/unelte/document-tabelar";

import type { Foaie } from "./foaie";

/**
 * Foaia de pontaj ca `DocumentTabelar`, pentru PDF și Word.
 *
 * Excelul rămâne pe generatorul lui din `route.ts`: acolo totalurile sunt
 * FORMULE, iar modelul comun nu știe de formule. PDF-ul și Word-ul se tipăresc
 * și se completează de mână, deci totalul e o coloană goală.
 */
export function foaieCaDocument(foaie: Foaie): DocumentTabelar {
  const sarbatori = foaie.zile.filter((z) => z.sarbatoare !== null);
  const listaSarbatori = sarbatori.map((z) => `${String(z.zi)} ${z.sarbatoare ?? ""}`).join("; ");
  return {
    titlu: `Foaie colectivă de prezență — ${foaie.eticheta}`,
    subtitlu: `${String(foaie.zileLucratoare)} zile lucrătoare × ${String(foaie.oreZi)} h = ${String(foaie.normaLunara)} h normă`,
    campuri: [],
    paragrafe: [],
    coloane: [
      { eticheta: "Angajat", latime: 8 },
      ...foaie.zile.map((z) => ({ eticheta: `${String(z.zi)}\n${z.litera}`, latime: 1 })),
      { eticheta: "Total", latime: 2 },
    ],
    randuri: foaie.angajati.map((nume) => [nume, ...foaie.zile.map(() => ""), ""]),
    umbrite: foaie.zile.flatMap((z, i) => (z.weekend || z.sarbatoare !== null ? [i + 1] : [])),
    note: [`Sărbători legale în lună: ${listaSarbatori === "" ? "niciuna" : listaSarbatori}`],
    semnaturi: ["Întocmit", "Verificat"],
    orientare: "peisaj",
    numeFisier: `pontaj-${String(foaie.an)}-${String(foaie.luna).padStart(2, "0")}`,
  };
}
