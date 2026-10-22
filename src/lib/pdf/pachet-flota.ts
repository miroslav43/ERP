// src/lib/pdf/pachet-flota.ts
//
// Pachetul lunar pentru contabil (F8): un ZIP cu Excelul raportului la rădăcină și
// câte un PDF pe fiecare foaie de parcurs APROBATĂ a lunii, în `foi/`. Din F12g,
// și jurnalul de costuri al lunii, cu conturile propuse.
//
// ── DE CE PDF-URILE SE GENEREAZĂ UNUL CÂTE UNUL ─────────────────────────────
// Fiecare PDF ține în memorie un `PDFDocument` cu fonturile încorporate. Un
// `Promise.all` peste patru sute de foi ar fi pus patru sute de documente în
// aer deodată, în același proces care servește restul aplicației. Serial, vârful
// de memorie e un document, iar plafonul de foi (`PLAFON_FOI_PACHET`) pune limita
// de timp.
//
// ── DE CE NUMELE SE FAC UNICE ───────────────────────────────────────────────
// Numele vine din număr, vehicul și zi. O foaie veche, dinaintea numerotării,
// poate să nu aibă număr, iar două foi ale aceluiași vehicul în aceeași zi sunt
// posibile (una respinsă și refăcută). Fără sufix, a doua ar suprascrie-o pe
// prima în arhivă, tăcut. Comparația e fără majuscule: Windows și macOS tratează
// `Foaie.pdf` și `foaie.pdf` ca același fișier.
import "server-only";

import JSZip from "jszip";

import type { AlimentareFoaie } from "@/domain/fleet/foaie";
import type { AntetOrganizatie } from "@/lib/documents/bloc-firma";
import type { FoaieDetaliata } from "@/lib/queries/fleet-rapoarte";

import { numeFisier } from "./document";
import { genereazaFoaieParcurs } from "./foaie-parcurs";
import { modelFoaieDinDate, type VehiculPdf } from "./foaie-din-date";

/** `cale/nume.ext` → aceeași cale cu `-2`, `-3`… înaintea extensiei, dacă numele e luat. */
export function numeUnic(cale: string, folosite: Set<string>): string {
  const punct = cale.lastIndexOf(".");
  const baza = punct === -1 ? cale : cale.slice(0, punct);
  const extensie = punct === -1 ? "" : cale.slice(punct);
  let nume = cale;
  for (let k = 2; folosite.has(nume.toLowerCase()); k += 1)
    nume = `${baza}-${String(k)}${extensie}`;
  folosite.add(nume.toLowerCase());
  return nume;
}

export interface ParametriPachet {
  readonly organizatie: AntetOrganizatie;
  readonly foi: readonly FoaieDetaliata[];
  readonly vehicule: ReadonlyMap<string, VehiculPdf>;
  /** Numele șoferilor, după id-ul fișei de angajat. */
  readonly soferi: ReadonlyMap<string, string>;
  /** Numele aprobatorilor, după id-ul contului (`aprobat_de`). */
  readonly aprobatori: ReadonlyMap<string, string>;
  readonly xlsx: Readonly<{ nume: string; octeti: Uint8Array }>;
  /**
   * Jurnalul de costuri al lunii (F12g, implicita I-g7), cu conturile PROPUSE din
   * `CONFIGURARE_IMPLICITA`. E de citit, nu de importat: fișierele de import se
   * descarcă din „Export pentru contabilitate”, cu conturile confirmate.
   */
  readonly jurnal?: Readonly<{ nume: string; continut: string }>;
  /** Momentul generării, deja formatat: pe subsolul fiecărui PDF. */
  readonly generatLa: string;
}

export async function pachetLunarFlota(p: ParametriPachet): Promise<Uint8Array> {
  const zip = new JSZip();
  const folosite = new Set<string>();
  zip.file(numeUnic(p.xlsx.nume, folosite), p.xlsx.octeti);
  if (p.jurnal !== undefined) zip.file(numeUnic(p.jurnal.nume, folosite), p.jurnal.continut);

  for (const foaie of p.foi) {
    const alimentari: readonly AlimentareFoaie[] = foaie.alimentari;
    const model = modelFoaieDinDate({
      foaie: { ...foaie, status: "aprobat" },
      vehicul: p.vehicule.get(foaie.vehicle_id),
      sofer: (foaie.employee_id === null ? undefined : p.soferi.get(foaie.employee_id)) ?? "—",
      aprobator: foaie.aprobat_de === null ? null : (p.aprobatori.get(foaie.aprobat_de) ?? null),
      curse: foaie.curse,
      alimentari,
      // F12f (0217): codurile UIT, ca pe PDF-ul foii singure.
      uituri: foaie.uituri,
    });
    const pdf = await genereazaFoaieParcurs({
      organizatie: p.organizatie,
      model,
      generatLa: p.generatLa,
    });
    zip.file(numeUnic(`foi/${numeFisier(model.numeFisier)}.pdf`, folosite), pdf);
  }

  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}
