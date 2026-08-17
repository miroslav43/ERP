// src/lib/import/excel.ts
// Citire Excel în memorie, cu limite explicite. Nu scrie nimic pe disc și nu
// evaluează formule: pentru celulele cu formulă folosim rezultatul cached.
import * as ExcelJS from "exceljs";

export const LIMITA_FISIER_BYTES = 5 * 1024 * 1024; // 5 MB
export const LIMITA_RANDURI = 1000;
export const LOT_IMPORT = 25; // rânduri procesate într-o singură invocare de Server Action
const EXTENSII_ACCEPTATE = [".xlsx", ".xlsm"] as const;

export type RandBrut = { readonly rand: number; readonly celule: ReadonlyMap<string, string> };
export type FoaieCitita = {
  readonly numeFoaie: string;
  readonly antet: readonly string[];
  readonly randuri: readonly RandBrut[];
  readonly trunchiat: boolean;
};
export type RezultatCitire =
  | { readonly ok: true; readonly foaie: FoaieCitita }
  | { readonly ok: false; readonly mesaj: string };

/** Verificare identică pe client (înainte de încărcare) și pe server (înainte de parsare). */
export function verificaFisierImport(numeFisier: string, dimensiune: number): string | null {
  const nume = numeFisier.toLowerCase();
  if (!EXTENSII_ACCEPTATE.some((ext) => nume.endsWith(ext))) {
    return "Acceptăm doar fișiere Excel (.xlsx sau .xlsm). Salvează fișierul în acest format și încearcă din nou.";
  }
  if (dimensiune <= 0) return "Fișierul selectat este gol.";
  if (dimensiune > LIMITA_FISIER_BYTES) {
    return `Fișierul depășește ${Math.round(LIMITA_FISIER_BYTES / 1024 / 1024)} MB. Împarte-l în mai multe fișiere mai mici.`;
  }
  return null;
}

function dataIso(valoare: Date): string {
  // Excel stochează datele raportat la UTC; luăm componentele UTC ca să nu pierdem o zi.
  const an = valoare.getUTCFullYear();
  const luna = String(valoare.getUTCMonth() + 1).padStart(2, "0");
  const zi = String(valoare.getUTCDate()).padStart(2, "0");
  return `${an}-${luna}-${zi}`;
}

function textDinCelula(valoare: unknown): string {
  if (valoare === null || valoare === undefined) return "";
  if (typeof valoare === "string") return valoare.trim();
  if (typeof valoare === "number" || typeof valoare === "boolean") return String(valoare);
  if (valoare instanceof Date) return dataIso(valoare);
  if (typeof valoare === "object") {
    const obiect: Record<string, unknown> = { ...(valoare as Record<string, unknown>) };
    const bogat = obiect["richText"];
    if (Array.isArray(bogat)) {
      return bogat
        .map((fragment) => {
          if (typeof fragment !== "object" || fragment === null) return "";
          const text = (fragment as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        })
        .join("")
        .trim();
    }
    if (typeof obiect["text"] === "string") return obiect["text"].trim();
    if ("result" in obiect) return textDinCelula(obiect["result"]);
  }
  return "";
}

export async function citesteExcelDinBuffer(buffer: ArrayBuffer): Promise<RezultatCitire> {
  if (buffer.byteLength > LIMITA_FISIER_BYTES) {
    return { ok: false, mesaj: "Fișierul depășește dimensiunea maximă acceptată." };
  }
  const registru = new ExcelJS.Workbook();
  try {
    await registru.xlsx.load(buffer);
  } catch {
    return {
      ok: false,
      mesaj:
        "Fișierul nu a putut fi deschis. Verifică dacă este un Excel valid și neprotejat cu parolă.",
    };
  }
  const foaie = registru.worksheets[0];
  if (!foaie || foaie.rowCount < 2) {
    return { ok: false, mesaj: "Fișierul nu conține niciun rând de date sub linia de antet." };
  }

  const randAntet = foaie.getRow(1);
  const nrColoane = Math.max(foaie.columnCount, 1);
  const antet = Array.from({ length: nrColoane }, (_, i) => {
    const text = textDinCelula(randAntet.getCell(i + 1).value);
    return text.length > 0 ? text : `Coloana ${i + 1}`;
  });
  const antetUnic = antet.map((nume, i) =>
    antet.indexOf(nume) === i ? nume : `${nume} (${i + 1})`,
  );

  const ultimul = Math.min(foaie.rowCount, LIMITA_RANDURI + 1);
  const randuri: RandBrut[] = [];
  for (let i = 2; i <= ultimul; i += 1) {
    const rand = foaie.getRow(i);
    const celule = new Map<string, string>();
    let areContinut = false;
    for (let c = 0; c < nrColoane; c += 1) {
      const cheie = antetUnic[c];
      if (cheie === undefined) continue;
      const text = textDinCelula(rand.getCell(c + 1).value);
      if (text.length > 0) areContinut = true;
      celule.set(cheie, text);
    }
    if (areContinut) randuri.push({ rand: i, celule });
  }

  if (randuri.length === 0) {
    return { ok: false, mesaj: "Toate rândurile din fișier sunt goale." };
  }
  return {
    ok: true,
    foaie: {
      numeFoaie: foaie.name,
      antet: antetUnic,
      randuri,
      trunchiat: foaie.rowCount > ultimul,
    },
  };
}
