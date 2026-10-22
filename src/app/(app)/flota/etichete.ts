// src/app/(app)/flota/etichete.ts
import type { TonStare } from "@/components/ui/badge";
import type { CategorieVehicul, Combustibil, StatusFoaie, StatusVehicul } from "@/schemas/fleet";
import type { StareScadentaFlota } from "@/domain/fleet/scadente";
import {
  grupeazaUit,
  intervalValabilitate,
  stareUitLaZi,
  type AvertismentETransport,
  type EIncadrare,
  type StareUitLaZi,
  type VALABILITATI_UIT,
} from "@/domain/fleet/uit";
import { formatDate } from "@/lib/format/date";

export const ETICHETE_STATUS_VEHICUL: Readonly<Record<StatusVehicul, string>> = {
  activ: "În parc",
  in_service: "În service",
  vandut: "Vândut",
  casat: "Casat",
};

export const TONURI_STATUS_VEHICUL: Readonly<Record<StatusVehicul, TonStare>> = {
  activ: "succes",
  // „În service” nu e o defecțiune, e o indisponibilitate temporară: vehiculul
  // se întoarce în parc. Atenție, nu pericol.
  in_service: "atentie",
  // Vândut și casat sunt sfârșituri de viață, nu probleme — ies din parc și nu
  // mai cer nicio acțiune.
  vandut: "neutru",
  casat: "neutru",
};

export const ETICHETE_CATEGORIE: Readonly<Record<CategorieVehicul, string>> = {
  autoturism: "Autoturism",
  autoutilitara: "Autoutilitară",
  camion: "Camion",
  autobuz: "Autobuz",
  microbuz: "Microbuz",
  remorca: "Remorcă",
  semiremorca: "Semiremorcă",
  utilaj: "Utilaj",
  motocicleta: "Motocicletă",
  altele: "Altele",
};

export const ETICHETE_COMBUSTIBIL: Readonly<Record<Combustibil, string>> = {
  benzina: "Benzină",
  motorina: "Motorină",
  gpl: "GPL",
  gnc: "GNC",
  electric: "Electric",
  hibrid: "Hibrid",
  hibrid_plugin: "Hibrid plug-in",
  altul: "Altul",
};

export const ETICHETE_STATUS_FOAIE: Readonly<Record<StatusFoaie, string>> = {
  draft: "Ciornă",
  trimis: "Trimisă spre aprobare",
  aprobat: "Aprobată",
  respins: "Respinsă",
};

export const TONURI_STATUS_FOAIE: Readonly<Record<StatusFoaie, TonStare>> = {
  draft: "ciorna",
  // Trimisă = așteaptă pe altcineva. E o stare deschisă, care cere o acțiune de
  // la aprobator, deci atenție — nu succes și nici stare neutră.
  trimis: "atentie",
  aprobat: "succes",
  respins: "pericol",
};

/**
 * Tipul unei anomalii de kilometraj. Era CITIT din bază și nerandat nicăieri,
 * deși ecranul dedica un paragraf întreg distincției dintre cele două.
 *
 * `regres` e „pericol”, `salt` e „atentie”: un odometru care dă înapoi e
 * imposibil fizic și e refuzat din start de bază, deci apariția lui înseamnă că
 * s-a umblat la cifre. Un salt are explicații banale — cel mai des o cursă
 * necompletată.
 */
export const ETICHETE_TIP_ANOMALIE: Readonly<Record<"regres" | "salt", string>> = {
  regres: "Regres",
  salt: "Salt",
};

export const TONURI_TIP_ANOMALIE: Readonly<Record<"regres" | "salt", TonStare>> = {
  regres: "pericol",
  salt: "atentie",
};

/**
 * Scadențele: aici rămâne doar cum ARATĂ o treaptă, nu cum se calculează.
 *
 * `stareScadenta` și pragul de 30 de zile au plecat în `@/domain/fleet/scadente`
 * (decizia B1 din `docs/design/redesign/0-decizii-de-pornire.md`): un fișier de
 * rută nu e testabil de proiectul `unit`, iar portalul importă acest `etichete.ts`
 * fără să aibă nevoie de logică. Numele vechi rămâne exportat de aici cât timp
 * `page.tsx` și `[id]/page.tsx` îl mai importă sub el.
 */
export { stareScadentaFlota as stareScadenta } from "@/domain/fleet/scadente";
export type { StareScadentaFlota as StareScadenta } from "@/domain/fleet/scadente";

/**
 * Doar CUVÂNTUL, nu și tonul.
 *
 * `TONURI_SCADENTA` a dispărut odată cu trecerea celor două ecrane pe
 * `<Scadenta>`: pastila își ia culoarea ȘI forma din treaptă, iar treapta o
 * calculează `stareScadentaFlota`. Harta de tonuri ar fi fost a doua sursă
 * pentru aceeași severitate — exact felul de divergență din care s-a născut
 * primitiva. Textul rămâne aici, fiindcă `<Scadenta>` nu-și scrie niciodată
 * singură conținutul (marketingul bilingv importă aceleași primitive).
 *
 * „Lipsește” e MAI GRAV decât „Expirat”: documentul nu există deloc, deci nu
 * are nicio dată de la care să se numere și nu se va aprinde niciodată singur
 * în „Expiră curând”. Ordinea o ține acum `RANG_SCADENTA` din `src/domain/scadente.ts`.
 */
export const ETICHETE_SCADENTA: Readonly<Record<StareScadentaFlota, string>> = {
  expirat: "Expirat",
  curand: "Expiră curând",
  in_regula: "În regulă",
  lipsa: "Lipsește",
};

/**
 * Consumul real, în convenția românească: „9,40 l/100 km”, nu „9.40”.
 *
 * Era scris cu `toFixed(2)` — care produce ÎNTOTDEAUNA punct zecimal, indiferent
 * de limbă — în două locuri: pe fișa foii și, de la reparația cozii de aprobare,
 * și acolo. Pe același rând cu `formatLei` și cu kilometrajul trecut prin
 * `toLocaleString("ro-RO")`, aceeași cifră apărea în două convenții.
 */
const formatorConsum = new Intl.NumberFormat("ro-RO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatConsum(litriLa100Km: number): string {
  return `${formatorConsum.format(litriLa100Km)} l/100 km`;
}

// ── ÎNCEPUT BLOC: codul UIT (RO e-Transport) pe cursă (0217, F12f) ──

/** Încadrarea cursei, cum o citește omul în selector. */
export const ETICHETE_E_TRANSPORT: Readonly<Record<EIncadrare, string>> = {
  neaplicabil: "Nu se aplică",
  risc_fiscal_national: "Bunuri cu risc fiscal ridicat (transport intern)",
  international: "Transport internațional",
};

/** Forma scurtă, pentru coloana de pe foaie și pentru PDF. */
export const ETICHETE_E_TRANSPORT_SCURT: Readonly<Record<EIncadrare, string>> = {
  neaplicabil: "Nu se aplică",
  risc_fiscal_national: "Risc fiscal (intern)",
  international: "Internațional",
};

/**
 * Ce face și ce NU face aplicația, sub selector. Fără „conform e-Transport”:
 * declararea, confirmarea și poziția GPS rămân în afara aplicației.
 */
export const AJUTOR_E_TRANSPORT =
  "Codul UIT îl primiți de la cel care a declarat transportul (furnizor, beneficiar sau firma proprie). Aplicația îl păstrează și îl verifică, dar nu declară nimic la ANAF.";

export const AJUTOR_DATA_INCEPUT_UIT =
  "Data declarată pentru începerea transportului, nu data la care a fost generat codul.";

/** Valabilitățile din OUG 41/2022 art. 11 alin. (2), cum apar în selector. */
export const ETICHETE_VALABILITATE_UIT: Readonly<
  Record<(typeof VALABILITATI_UIT)[number], string>
> = {
  5: "5 zile — standard",
  15: "15 zile — achiziție intracomunitară, tranzit cu depozitare, nontransfer, stocuri la dispoziția clientului",
};

export const TONURI_STARE_UIT: Readonly<Record<StareUitLaZi, TonStare>> = {
  valabil: "succes",
  neinceput: "atentie",
  expirat: "pericol",
};

/** Pastila codului, în ziua foii: „Valabil”, „Expirat din 29.06.2024”, „Începe pe 24.06.2024”. */
export function etichetaStareUit(
  u: Readonly<{ data_inceput: string; valabilitate_zile: number }>,
  ziuaFoii: string,
): string {
  const stare = stareUitLaZi(u, ziuaFoii);
  if (stare === "valabil") return "Valabil";
  if (stare === "neinceput") return `Începe pe ${formatDate(u.data_inceput)}`;
  return `Expirat din ${formatDate(intervalValabilitate(u.data_inceput, u.valabilitate_zile).primaZiExpirata)}`;
}

/** Textul unui avertisment, așa cum apare pe foaie, în coadă și în PDF. */
export function textAvertismentETransport(a: AvertismentETransport): string {
  switch (a.tip) {
    case "lipsa_uit":
      return "Cursa e marcată e-Transport, dar n-are cod UIT.";
    case "uit_expirat":
      return `Codul ${grupeazaUit(a.uit)} e expirat din ${formatDate(a.primaZiExpirata)}, deci nu mai acoperă ziua foii.`;
    case "uit_neinceput":
      return `Codul ${grupeazaUit(a.uit)} începe pe ${formatDate(a.dataInceput)}, după ziua foii.`;
    case "vehicul_sub_prag":
      return `Vehiculul are ${a.masaKg.toLocaleString("ro-RO")} kg masă maximă în fișă, sub pragul de 2.500 kg al RO e-Transport. Verificați dacă transportul chiar e monitorizat.`;
  }
}

/**
 * Rezumatul foii, deasupra tabelului de curse: „2 curse marcate e-Transport
 * n-au cod UIT.” Doar avertismentele care cer o acțiune; nota de prag rămâne
 * pe rândul ei.
 */
export function rezumatETransport(
  avertismente: readonly (readonly AvertismentETransport[])[],
): readonly string[] {
  const faraUit = avertismente.filter((lista) => lista.some((a) => a.tip === "lipsa_uit")).length;
  const nevalabile = avertismente
    .flat()
    .filter((a) => a.tip === "uit_expirat" || a.tip === "uit_neinceput").length;
  const randuri: string[] = [];
  if (faraUit > 0) {
    randuri.push(
      faraUit === 1
        ? "O cursă marcată e-Transport n-are cod UIT."
        : `${String(faraUit)} curse marcate e-Transport n-au cod UIT.`,
    );
  }
  if (nevalabile > 0) {
    randuri.push(
      nevalabile === 1
        ? "Un cod UIT nu e valabil în ziua foii."
        : `${String(nevalabile)} coduri UIT nu sunt valabile în ziua foii.`,
    );
  }
  return randuri;
}
// ── SFÂRȘIT BLOC: codul UIT pe cursă ──
