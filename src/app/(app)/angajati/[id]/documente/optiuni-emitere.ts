// src/app/(app)/angajati/[id]/documente/optiuni-emitere.ts
//
// Ce poate emite aplicația pentru un angajat anume, cu motivul pentru fiecare
// document care NU se poate — lista din caseta „Emite documente".
//
// ── DE CE O LISTĂ CU MOTIVE, NU UN BUTON „EMITE CE LIPSEȘTE" ────────────────
// Butonul vechi răspundea „Toate documentele au fost deja emise" unui angajat
// cu trei documente din cinci: celelalte două nu se aplicau (fără fișa
// postului, fără telemuncă), dar ecranul nu spunea nici care, nici de ce. Iar
// documentele create de firmă nu apăreau deloc. Lista de aici le arată pe toate,
// fiecare cu starea ei.
//
// Pur: primește datele, întoarce opțiunile. Ambele pagini care au caseta
// (fișa angajatului, dosarul de documente) îl cheamă cu ce au citit deja.
import { coduriEligibile } from "@/lib/documents/inrolare";
import { CODURI_INROLARE, ETICHETE_SABLON } from "@/lib/documents/variabile";

export type OptiuneEmitere = Readonly<{
  cod: string;
  denumire: string;
  grup: "angajare" | "firma";
  /** `false` = bifa e dezactivată, iar `detaliu` spune de ce. */
  eligibil: boolean;
  detaliu: string;
}>;

export type DateEmitere = Readonly<{
  /** `work_mode` al contractului de bază; `null` dacă angajatul n-are contract. */
  codModLucru: string | null;
  areFisaPostului: boolean;
  /** Documentele ACTIVE (neanulate), pe codul șablonului → numărul afișat. */
  activePeCod: ReadonlyMap<string, string>;
  /** Documentele create de firmă (`doc_…`). */
  documenteFirma: readonly Readonly<{ cod: string; denumire: string; serie: string }>[];
}>;

const FARA_CONTRACT = "Angajatul nu are contract de muncă, iar documentele se completează din el.";

export function optiuniEmitere(date: DateEmitere): readonly OptiuneEmitere[] {
  const eligibile =
    date.codModLucru === null ? [] : coduriEligibile(date.codModLucru, date.areFisaPostului);

  const deAngajare = CODURI_INROLARE.map((cod): OptiuneEmitere => {
    const baza = { cod, denumire: ETICHETE_SABLON[cod], grup: "angajare" as const };
    const emis = date.activePeCod.get(cod);
    if (emis !== undefined) {
      return {
        ...baza,
        eligibil: false,
        detaliu: `Emis deja: ${emis}. Pentru o variantă nouă, folosește „Regenerează documente” din fișă.`,
      };
    }
    if (date.codModLucru === null) return { ...baza, eligibil: false, detaliu: FARA_CONTRACT };
    if (!eligibile.includes(cod)) {
      return {
        ...baza,
        eligibil: false,
        detaliu:
          cod === "fisa_postului"
            ? "Angajatul nu are fișa postului completată."
            : "Nu se aplică: contractul nu e de telemuncă, la domiciliu sau mixt.",
      };
    }
    return { ...baza, eligibil: true, detaliu: "Nu a fost emis încă." };
  });

  const aleFirmei = date.documenteFirma.map((d): OptiuneEmitere => ({
    cod: d.cod,
    denumire: d.denumire,
    grup: "firma",
    eligibil: date.codModLucru !== null,
    detaliu:
      date.codModLucru === null
        ? FARA_CONTRACT
        : `Seria ${d.serie} · se poate emite oricând, de câte ori e nevoie.`,
  }));

  return [...deAngajare, ...aleFirmei];
}
