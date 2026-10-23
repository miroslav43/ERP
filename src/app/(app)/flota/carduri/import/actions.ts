// src/app/(app)/flota/carduri/import/actions.ts
"use server";
//
// IMPORTUL EXTRASELOR DE CARD (0214, F12b), pe tiparul importului de angajați
// (`angajati/import/actions.ts`):
//
// 1) Limita de corp a unei Server Action (1 MB, `next.config` n-o ridică) ar
//    respinge un extras mare. Fișierul NU trece prin acțiune: acțiunea emite un
//    URL de încărcare semnat, iar browserul urcă direct în Storage.
// 2) Analiza citește, potrivește și urcă LOTUL validat ca JSON lângă sursă; NU
//    scrie nimic în bază. Sursa (cu numere întregi de card) se șterge la PRIMA
//    citire, deci o re-analiză (după pasul de mapare) cere re-urcarea: clientul
//    păstrează `File`-ul în memorie și reia ciclul cu alt `batchId`.
// 3) Aplicarea scrie în felii de `FELIE_APLICARE` rânduri, RECALCULÂND
//    potrivirea pe datele de atunci (o foaie poate apărea între analiză și
//    aplicare). Reluarea de la același offset nu dublează nimic: cheile deja
//    importate se filtrează, iar contoarele se recalculează din bază.
//
// LOTUL E EMIS DE SERVER (X2, `import_uploads`, 0226): pregătirea înregistrează
// `batchId` și calea; analiza consumă rândul (o dată, doar creatorul, doar pe
// calea înregistrată) ÎNAINTE să șteargă sursa cu clientul de serviciu, iar
// aplicarea cere un lot deja analizat. Fără asta, un `batchId` egal cu id-ul unui
// vehicul ștergea orice .csv/.xlsx din folderul acelui vehicul.
//
// Calea: `{org}/vehicles/{batchId}/…` în `org-documents`. Segmentul 2 e resursa
// `vehicles` (contractul din `src/lib/documents/cale.ts`); `storage_objects_insert`
// cere `vehicles:create`. Pe `team`/`own`, `app.can_path` verifică segmentul 3 ca
// vehicul (0199), deci un manager NU citește lotul (proba 18 din
// `tests/rls/proba-flota-carduri.sql`).
//
// „use server”: se exportă DOAR funcții async (capcana 39, `pnpm check:server`).

import { createHash } from "node:crypto";

import { cifreFinaleCard, mascheazaSecvente } from "@/domain/fleet/carduri/card";
import { categorieProdus } from "@/domain/fleet/carduri/categorii";
import {
  ETICHETE_CAMP_EXTRAS,
  detecteazaMapare,
  type CampExtras,
} from "@/domain/fleet/carduri/coloane";
import { detecteazaFormatData, parseazaMoment, type FormatData } from "@/domain/fleet/carduri/date";
import { atribuieOrdinale, bazaCheii } from "@/domain/fleet/carduri/dedup";
import {
  FELIE_APLICARE,
  PERIOADA_MAXIMA_ZILE,
  RANDURI_PREVIZUALIZARE,
  extensieExtras,
  verificaFisierExtras,
} from "@/domain/fleet/carduri/limite";
import {
  detecteazaSeparatorZecimal,
  parseazaNumar,
  rotunjeste,
  type SeparatorZecimal,
} from "@/domain/fleet/carduri/numere";
import {
  potrivesteTranzactii,
  type RezultatPotrivire,
  type StarePotrivire,
  type TranzactieDePotrivit,
} from "@/domain/fleet/carduri/potrivire";
import { normalizeazaNrAuto, normalizeazaText } from "@/domain/fleet/carduri/text";
import { createAction } from "@/lib/actions/create-action";
import { businessRule, invalidInput } from "@/lib/actions/errors";
import type { ActionContext } from "@/lib/actions/types";
import {
  BUCKET_DOCUMENTE,
  caleInPrefix,
  caleLotCard,
  caleSursaExtras,
  prefixExtrasCard,
} from "@/lib/documents/cale";
import { citesteCsv, decodeazaText, detecteazaDelimitator } from "@/lib/import/csv";
import { citesteExcelDinBuffer, type FoaieCitita, type RandBrut } from "@/lib/import/excel";
import {
  consumaIncarcarea,
  incarcareAnalizata,
  inregistreazaIncarcarea,
} from "@/lib/import/incarcare";
import {
  cardurilePentruPotrivire,
  cheiDejaImportate,
  citesteImport,
  contextPotrivire,
  importuriCuAcelasiFisier,
  profilImport,
} from "@/lib/queries/fleet-carduri";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  analizeazaExtrasSchema,
  anuleazaImportSchema,
  aplicaExtrasSchema,
  lotExtrasSchema,
  pregatesteExtrasSchema,
  profilExtrasSchema,
  salveazaProfilSchema,
  type LotExtras,
  type ProfilExtras,
  type RandLot,
} from "@/schemas/fleet-carduri";

import { traduEroareCarduri } from "../erori";

const CAI = ["/flota/carduri", "/flota/carduri/tranzactii"] as const;
const RANDURI_ESANTION = 5;

// ── 1. Pregătirea încărcării ───────────────────────────────────────────────

export const pregatesteIncarcareaExtrasului = createAction({
  name: "fleet.card_import.prepare",
  feature: "fleet",
  permission: "vehicles:create",
  minScope: "all",
  input: pregatesteExtrasSchema,
  audit: {
    action: "import",
    entityType: "fuel_card_imports",
    allow: ["numeFisier", "dimensiune"],
  },
  handler: async (
    ctx,
    input,
  ): Promise<Readonly<{ batchId: string; cale: string; urlSemnat: string }>> => {
    const problema = verificaFisierExtras(input.numeFisier, input.dimensiune);
    if (problema !== null) throw invalidInput(problema, { fisier: [problema] });
    const batchId = crypto.randomUUID();
    const cale = caleSursaExtras(ctx.tenant.organizationId, batchId, input.numeFisier);
    // Lotul se înregistrează ÎNAINTEA URL-ului semnat: nu există încărcare fără chitanță.
    if (!(await inregistreazaIncarcarea(ctx, "vehicles", batchId, cale))) {
      throw businessRule(
        "Nu am putut pregăti încărcarea fișierului. Încercați din nou în câteva secunde.",
      );
    }
    const { data, error } = await ctx.supabase.storage
      .from(BUCKET_DOCUMENTE)
      .createSignedUploadUrl(cale);
    if (error !== null || data === null) {
      throw businessRule(
        "Nu am putut pregăti încărcarea fișierului. Încercați din nou în câteva secunde.",
      );
    }
    return { batchId, cale, urlSemnat: data.signedUrl };
  },
});

// ── 2. Analiza ─────────────────────────────────────────────────────────────

/** Ce se întoarce când coloanele sau formatele nu se pot stabili singure. */
export type CerereMapare = Readonly<{
  cereMapare: true;
  motiv: string;
  numeFoaie: string;
  antet: readonly string[];
  /** Primele rânduri brute, cu orice secvență de ≥ 12 cifre MASCATĂ. */
  esantion: readonly (readonly string[])[];
  mapare: Readonly<Partial<Record<CampExtras, string>>>;
  ambigue: readonly Readonly<{
    camp: CampExtras;
    coloane: readonly string[];
  }>[];
  lipsa: readonly string[];
  profil: ProfilExtras;
}>;

export type RandPrevizualizare = Readonly<{
  rand: number;
  card: string | null;
  nrInmatriculare: string | null;
  efectuatLa: string;
  areOra: boolean;
  produs: string;
  cantitate: number | null;
  valoareBruta: number;
  moneda: string;
  statie: string | null;
  stare: StarePotrivire;
  motiv: string | null;
  duplicat: boolean;
}>;

export type Previzualizare = Readonly<{
  cereMapare: false;
  batchId: string;
  numeFoaie: string;
  perioadaDeLa: string;
  perioadaPanaLa: string;
  randuriFisier: number;
  deImportat: number;
  duplicate: number;
  respinse: readonly Readonly<{ rand: number; mesaj: string }>[];
  numarRespinse: number;
  peStare: Readonly<Partial<Record<StarePotrivire, number>>>;
  randuri: readonly RandPrevizualizare[];
  importatDejaLa: readonly string[];
  profil: ProfilExtras;
  mapare: Readonly<Partial<Record<CampExtras, string>>>;
  /** Pentru „Schimbă maparea”: antetul și eșantionul, mascate ca la cererea de mapare. */
  antet: readonly string[];
  esantion: readonly (readonly string[])[];
}>;

const PROFIL_IMPLICIT: ProfilExtras = profilExtrasSchema.parse({ mapare: {} });

function delimitatorDin(profil: ProfilExtras, text: string): ";" | "," | "\t" {
  if (profil.delimitator === "tab") return "\t";
  if (profil.delimitator === ";" || profil.delimitator === ",") return profil.delimitator;
  return detecteazaDelimitator(text);
}

function sha256(octeti: Uint8Array): string {
  return createHash("sha256").update(octeti).digest("hex");
}

function celula(rand: RandBrut, mapare: Partial<Record<CampExtras, string>>, camp: CampExtras) {
  const coloana = mapare[camp];
  if (coloana === undefined) return "";
  return (rand.celule.get(coloana) ?? "").trim();
}

function textSauNull(valoare: string, maxim: number): string | null {
  const t = normalizeazaText(valoare);
  return t.length === 0 ? null : t.slice(0, maxim);
}

/** `RON`, `LEI` → `RON`; trei litere altfel; necunoscut → `RON` (extras românesc). */
function moneda(valoare: string): string {
  const t = valoare.trim().toUpperCase();
  if (t === "" || t === "LEI" || t === "RON" || t === "L") return "RON";
  return /^[A-Z]{3}$/u.test(t) ? t : "RON";
}

/** Doar codul de două litere; o denumire sau un cod de trei litere nu se ghicește. */
function tara(valoare: string): string | null {
  const t = valoare.trim().toUpperCase();
  return /^[A-Z]{2}$/u.test(t) ? t : null;
}

/** Plajele coloanelor din 0214 (tipul lor SQL), ca o celulă străină să nu ajungă la INSERT. */
const LIMITA_VALOARE = 1e12; // numeric(14,2): |x| < 10^12
const LIMITA_PRET = 1e8; // numeric(12,4): |x| < 10^8
const LIMITA_KM = 2_147_483_647; // integer

function inPlaja(valoare: number, limita: number): boolean {
  return Number.isFinite(valoare) && Math.abs(valoare) < limita;
}

type Citire = Readonly<{
  randuri: RandLot[];
  respinse: { rand: number; mesaj: string }[];
}>;

/**
 * Parsarea rândurilor brute în rânduri de lot. Un rând fără dată validă, fără
 * produs sau fără valoare (totaluri, subtotaluri pe card) se RESPINGE cu motiv,
 * nu se importă.
 */
async function parseazaRanduri(
  foaie: FoaieCitita,
  mapare: Partial<Record<CampExtras, string>>,
  emitent: string,
  separator: SeparatorZecimal,
  format: FormatData,
): Promise<Citire> {
  const { amprentaSensibila } = await import("@/lib/crypto/aes-gcm");
  const randuri: Omit<RandLot, "cheie">[] = [];
  const respinse: { rand: number; mesaj: string }[] = [];
  const numar = (rand: RandBrut, camp: CampExtras) => {
    const t = celula(rand, mapare, camp);
    return t === "" ? null : parseazaNumar(t, separator);
  };

  for (const rand of foaie.randuri) {
    const dataText = celula(rand, mapare, "data_ora") || celula(rand, mapare, "data");
    const oraText = celula(rand, mapare, "ora");
    const moment = parseazaMoment(dataText, oraText === "" ? null : oraText, format);
    if (moment === null) {
      respinse.push({
        rand: rand.rand,
        mesaj: "Data lipsește sau nu e validă (rând de total?).",
      });
      continue;
    }
    const produs = textSauNull(celula(rand, mapare, "produs"), 120);
    if (produs === null) {
      respinse.push({ rand: rand.rand, mesaj: "Produsul lipsește." });
      continue;
    }
    const valoareNeta = numar(rand, "valoare_neta");
    const tva = numar(rand, "tva");
    const valoareBrutaCitita = numar(rand, "valoare_bruta");
    const valoareBruta =
      valoareBrutaCitita ?? (valoareNeta !== null ? rotunjeste(valoareNeta + (tva ?? 0), 2) : null);
    if (valoareBruta === null) {
      respinse.push({
        rand: rand.rand,
        mesaj: "Valoarea lipsește sau nu e un număr.",
      });
      continue;
    }
    // `valoare_* numeric(14,2)`: peste plajă, INSERT-ul feliei ar cădea întreg
    // pe 22003, după o previzualizare curată. Rândul se respinge aici, cu motiv.
    if ([valoareBruta, valoareNeta, tva].some((v) => v !== null && !inPlaja(v, LIMITA_VALOARE))) {
      respinse.push({
        rand: rand.rand,
        mesaj: "Valoarea nu e plauzibilă (coloana greșită în mapare?).",
      });
      continue;
    }
    const cantitate = numar(rand, "cantitate");
    if (cantitate !== null && Math.abs(cantitate) > 5000) {
      respinse.push({
        rand: rand.rand,
        mesaj: "Cantitatea depășește 5000 de litri.",
      });
      continue;
    }
    const cifre = cifreFinaleCard(celula(rand, mapare, "numar_card"));
    const nrBrut = normalizeazaNrAuto(celula(rand, mapare, "nr_inmatriculare"));
    const nrInmatriculare = nrBrut.length >= 3 && nrBrut.length <= 20 ? nrBrut : null;
    if (cifre === null && nrInmatriculare === null) {
      respinse.push({
        rand: rand.rand,
        mesaj: "Nici numărul cardului, nici numărul de înmatriculare nu se pot citi.",
      });
      continue;
    }
    // Km-ul și prețul doar informează: peste coloana lor (`integer`,
    // `numeric(12,4)`) rămân goale, nu blochează rândul.
    const km = numar(rand, "km");
    const pretUnitar = numar(rand, "pret_unitar");
    const { categorie, tipCombustibil } = categorieProdus(produs);
    randuri.push({
      rand: rand.rand,
      idTranzactie: textSauNull(celula(rand, mapare, "id_tranzactie"), 100),
      cifreCard: cifre?.finale ?? null,
      // Doar amprenta pleacă mai departe; numărul întreg rămâne în memoria acestei funcții.
      amprentaCard:
        cifre === null || cifre.intreg === null
          ? null
          : amprentaSensibila(`card:${emitent}:${cifre.intreg}`),
      nrInmatriculare,
      efectuatLa: moment.moment,
      dataRo: moment.dataRo,
      areOra: moment.areOra,
      produs,
      categorie,
      tipCombustibil,
      cantitate: cantitate === null ? null : rotunjeste(cantitate, 2),
      pretUnitar: pretUnitar === null || !inPlaja(pretUnitar, LIMITA_PRET) ? null : pretUnitar,
      valoareBruta: rotunjeste(valoareBruta, 2),
      valoareNeta: valoareNeta === null ? null : rotunjeste(valoareNeta, 2),
      tva: tva === null ? null : rotunjeste(tva, 2),
      moneda: moneda(celula(rand, mapare, "moneda")),
      statie: textSauNull(celula(rand, mapare, "statie"), 200),
      localitate: textSauNull(celula(rand, mapare, "localitate"), 120),
      tara: tara(celula(rand, mapare, "tara")),
      kmDeclarat: km === null || km < 0 || Math.round(km) > LIMITA_KM ? null : Math.round(km),
      numarBon: textSauNull(celula(rand, mapare, "numar_bon"), 60),
    });
  }

  const chei = atribuieOrdinale(
    randuri.map((r) =>
      bazaCheii(
        {
          idTranzactie: r.idTranzactie,
          cifreCard: r.cifreCard,
          nrInmatriculare: r.nrInmatriculare,
          moment: r.efectuatLa,
          cantitate: r.cantitate,
          valoare: r.valoareBruta,
          produs: r.produs,
          statie: r.statie,
        },
        emitent,
      ),
    ),
  );
  return {
    randuri: randuri.map((r, i) => ({ ...r, cheie: chei[i] ?? "" })),
    respinse,
  };
}

function deDePotrivit(r: RandLot, emitent: string): TranzactieDePotrivit {
  return {
    emitent,
    cifreCard: r.cifreCard,
    amprentaCard: r.amprentaCard,
    nrInmatriculare: r.nrInmatriculare,
    efectuatLa: r.efectuatLa,
    dataRo: r.dataRo,
    areOra: r.areOra,
    categorie: r.categorie,
    tipCombustibil: r.tipCombustibil,
    cantitate: r.cantitate,
    valoareBruta: r.valoareBruta,
    moneda: r.moneda,
    kmDeclarat: r.kmDeclarat,
    numarBon: r.numarBon,
  };
}

/** Potrivirea unui set de rânduri pe contextul proaspăt din bază. */
async function potriveste(
  ctx: ActionContext,
  emitent: string,
  randuri: readonly RandLot[],
): Promise<RezultatPotrivire[]> {
  if (randuri.length === 0) return [];
  const zile = randuri.map((r) => r.dataRo).sort();
  const [carduri, context] = await Promise.all([
    cardurilePentruPotrivire(ctx.tenant.organizationId),
    contextPotrivire(ctx.tenant.organizationId, zile[0] ?? "", zile.at(-1) ?? ""),
  ]);
  return potrivesteTranzactii(
    randuri.map((r) => deDePotrivit(r, emitent)),
    {
      carduri,
      vehicule: context.vehicule,
      alocari: context.alocari,
      foi: context.foi,
      alimentari: context.alimentari,
      alimentariDejaLegate: new Set(context.legaturi.keys()),
    },
  );
}

function zileIntre(deLa: string, panaLa: string): number {
  return Math.round(
    (Date.parse(`${panaLa}T12:00:00Z`) - Date.parse(`${deLa}T12:00:00Z`)) / 86_400_000,
  );
}

export const analizeazaExtras = createAction({
  name: "fleet.card_import.analyze",
  feature: "fleet",
  permission: "vehicles:create",
  minScope: "all",
  input: analizeazaExtrasSchema,
  audit: {
    action: "import",
    entityType: "fuel_card_imports",
    allow: ["batchId", "emitent"],
  },
  handler: async (ctx, input): Promise<CerereMapare | Previzualizare> => {
    const org = ctx.tenant.organizationId;
    // Prefixul se CONSTRUIEȘTE cu aceeași funcție ca la încărcare, nu se scrie de mână.
    if (!caleInPrefix(input.cale, prefixExtrasCard(org, input.batchId))) {
      const mesaj = "Calea fișierului nu corespunde acestui import.";
      throw invalidInput(mesaj, { cale: [mesaj] });
    }
    const extensie = extensieExtras(input.cale);
    if (extensie === null) throw invalidInput("Acceptăm extrase .csv sau .xlsx.", {});

    const descarcare = await ctx.supabase.storage.from(BUCKET_DOCUMENTE).download(input.cale);
    if (descarcare.error !== null || descarcare.data === null) {
      throw businessRule("Fișierul încărcat nu mai este disponibil. Reluați încărcarea.");
    }
    const octeti = new Uint8Array(await descarcare.data.arrayBuffer());

    // X2: lotul emis de server se consumă ÎNAINTEA ștergerii. Prefixul de mai sus
    // nu ajunge: `batchId` vine din client și putea fi id-ul unui vehicul.
    if (!(await consumaIncarcarea(ctx, "vehicles", input.batchId, input.cale))) {
      throw businessRule(
        "Încărcarea nu mai este valabilă: fișierul a fost deja analizat sau nu a fost pregătit de dumneavoastră. Reluați încărcarea.",
      );
    }

    /*
     * Sursa pleacă din Storage imediat ce e în memorie: are numerele ÎNTREGI ale
     * cardurilor, pe care produsul nu le păstrează nicăieri. `storage.objects` n-are
     * politică DELETE (nici `org_admin` n-o poate scoate), deci ștergerea cere
     * `service_role` — DE ACEEA clientul admin, și doar pe calea ÎNREGISTRATĂ de
     * server pentru lotul apelantului și consumată chiar acum (`import_uploads`),
     * niciodată crezută pe cuvânt. Eșecul ștergerii nu oprește analiza, dar se
     * vede în jurnal.
     */
    const sterge = await createAdminSupabase().storage.from(BUCKET_DOCUMENTE).remove([input.cale]);
    if (sterge.error !== null) {
      console.warn("[fleet.card_import.analyze] sursa extrasului n-a putut fi ștearsă", {
        requestId: ctx.requestId,
        batchId: input.batchId,
        eroare: sterge.error.message,
      });
    }

    const salvat = input.profil === null ? await profilImport(org, input.emitent) : null;
    const profil: ProfilExtras =
      input.profil ??
      (salvat === null
        ? PROFIL_IMPLICIT
        : profilExtrasSchema.parse({
            mapare: salvat.mapare,
            format_data: salvat.format_data,
            separator_zecimal: salvat.separator_zecimal,
            delimitator: salvat.delimitator,
            codificare: salvat.codificare,
            rand_antet: salvat.rand_antet,
          }));

    let foaie: FoaieCitita;
    if (extensie === ".csv") {
      const text = decodeazaText(octeti, profil.codificare);
      const citire = citesteCsv(text, {
        delimitator: delimitatorDin(profil, text),
        randAntet: profil.rand_antet,
      });
      if (!citire.ok) throw invalidInput(citire.mesaj, {});
      foaie = citire.foaie;
    } else {
      const citire = await citesteExcelDinBuffer(octeti.slice().buffer, {
        pastreazaOra: true,
        randAntet: profil.rand_antet,
      });
      if (!citire.ok) throw invalidInput(citire.mesaj, {});
      foaie = citire.foaie;
    }
    // Fără trunchiere tăcută: peste plafon, refuz (F12b, Decizia 10).
    if (foaie.trunchiat) {
      throw invalidInput(
        "Extrasul are peste 1000 de rânduri. Împărțiți-l pe perioade mai scurte și importați fiecare parte.",
        {},
      );
    }

    const detectat = detecteazaMapare(
      foaie.antet,
      input.emitent,
      Object.keys(profil.mapare).length > 0 ? { mapare: profil.mapare } : null,
    );
    const esantion = foaie.randuri
      .slice(0, RANDURI_ESANTION)
      .map((r) => foaie.antet.map((col) => mascheazaSecvente(r.celule.get(col) ?? "")));
    const cere = (motiv: string): CerereMapare => ({
      cereMapare: true,
      motiv,
      numeFoaie: foaie.numeFoaie,
      antet: foaie.antet.map(mascheazaSecvente),
      esantion,
      mapare: detectat.mapare,
      ambigue: detectat.ambigue,
      lipsa: detectat.lipsa,
      profil,
    });
    // Lipsă sau ambiguu ⇒ omul alege. Lotul NU se urcă: sursa e deja ștearsă,
    // iar re-analiza cu maparea aleasă reia ciclul de la urcare.
    if (detectat.lipsa.length > 0) {
      return cere(`Nu am găsit coloanele: ${detectat.lipsa.join("; ")}.`);
    }
    if (detectat.ambigue.length > 0) {
      const lista = detectat.ambigue.map((a) => ETICHETE_CAMP_EXTRAS[a.camp]).join(", ");
      return cere(`Mai multe coloane se potrivesc pentru: ${lista}. Alegeți-o pe cea corectă.`);
    }

    const valori = (campuri: readonly CampExtras[]) =>
      foaie.randuri.flatMap((r) => campuri.map((c) => celula(r, detectat.mapare, c)));
    const separator =
      profil.separator_zecimal === "auto"
        ? detecteazaSeparatorZecimal(
            valori(["cantitate", "pret_unitar", "valoare_bruta", "valoare_neta", "tva"]),
          )
        : profil.separator_zecimal;
    if (separator === null) {
      return cere(
        "Nu se poate stabili singur separatorul zecimal (de exemplu „1,234”). Alegeți-l mai jos.",
      );
    }
    const format =
      profil.format_data === "auto"
        ? detecteazaFormatData(valori(["data_ora", "data"]))
        : profil.format_data;
    if (format === null) {
      return cere(
        "Datele cu bară oblică sunt ambigue (zi/lună sau lună/zi). Alegeți formatul mai jos.",
      );
    }

    const { randuri, respinse } = await parseazaRanduri(
      foaie,
      detectat.mapare,
      input.emitent,
      separator,
      format,
    );
    if (randuri.length === 0) {
      throw invalidInput(
        "Niciun rând din extras nu are dată, produs și valoare citibile. Verificați maparea coloanelor.",
        {},
      );
    }
    const zile = randuri.map((r) => r.dataRo).sort();
    const perioadaDeLa = zile[0] ?? "";
    const perioadaPanaLa = zile.at(-1) ?? "";
    const durata = zileIntre(perioadaDeLa, perioadaPanaLa);
    if (durata > PERIOADA_MAXIMA_ZILE) {
      throw invalidInput(
        `Extrasul acoperă ${String(durata + 1)} zile, peste ${String(PERIOADA_MAXIMA_ZILE)}. Împărțiți-l pe luni și importați fiecare parte.`,
        {},
      );
    }

    const dejaImportate = await cheiDejaImportate(
      org,
      input.emitent,
      randuri.map((r) => r.cheie),
    );
    const noi = randuri.filter((r) => !dejaImportate.has(r.cheie));
    const rezultate = await potriveste(ctx, input.emitent, noi);
    const stareDupaCheie = new Map(noi.map((r, i) => [r.cheie, rezultate[i]]));

    const lot: LotExtras = {
      versiune: 1,
      emitent: input.emitent,
      fisierNume:
        input.cale
          .split("/")
          .pop()
          ?.replace(/^[0-9a-f-]{36}-/u, "") ?? "extras",
      fisierSha256: sha256(octeti),
      perioadaDeLa,
      perioadaPanaLa,
      randuriFisier: foaie.randuri.length,
      respinse: respinse.length,
      randuri,
    };
    const salvare = await ctx.supabase.storage
      .from(BUCKET_DOCUMENTE)
      .upload(
        caleLotCard(org, input.batchId),
        new Blob([JSON.stringify(lot)], { type: "application/json" }),
        {
          contentType: "application/json",
        },
      );
    if (salvare.error !== null) {
      throw businessRule("Nu am putut salva previzualizarea importului. Încercați din nou.");
    }

    const peStare: Partial<Record<StarePotrivire, number>> = {};
    for (const r of rezultate) peStare[r.stare] = (peStare[r.stare] ?? 0) + 1;
    const dejaLa = await importuriCuAcelasiFisier(org, lot.fisierSha256);

    return {
      cereMapare: false,
      batchId: input.batchId,
      numeFoaie: foaie.numeFoaie,
      perioadaDeLa,
      perioadaPanaLa,
      randuriFisier: foaie.randuri.length,
      deImportat: noi.length,
      duplicate: randuri.length - noi.length,
      respinse: respinse.slice(0, RANDURI_PREVIZUALIZARE),
      numarRespinse: respinse.length,
      peStare,
      randuri: randuri.slice(0, RANDURI_PREVIZUALIZARE).map((r) => {
        const p = stareDupaCheie.get(r.cheie);
        return {
          rand: r.rand,
          card: r.cifreCard,
          nrInmatriculare: r.nrInmatriculare,
          efectuatLa: r.efectuatLa,
          areOra: r.areOra,
          produs: r.produs,
          cantitate: r.cantitate,
          valoareBruta: r.valoareBruta,
          moneda: r.moneda,
          statie: r.statie,
          stare: p?.stare ?? "ignorata",
          motiv: p === undefined ? "Importată deja." : p.motiv,
          duplicat: p === undefined,
        };
      }),
      importatDejaLa: dejaLa.map((i) => i.created_at),
      profil,
      mapare: detectat.mapare,
      antet: foaie.antet.map(mascheazaSecvente),
      esantion,
    };
  },
});

// ── 3. Profilul de import ──────────────────────────────────────────────────

export const salveazaProfilImport = createAction({
  name: "fleet.card_import.save_profile",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "all",
  input: salveazaProfilSchema,
  audit: {
    action: "update",
    entityType: "fuel_card_import_profiles",
    allow: [
      "emitent",
      "profil.format_data",
      "profil.separator_zecimal",
      "profil.delimitator",
      "profil.codificare",
      "profil.rand_antet",
    ],
  },
  revalidate: ["/flota/carduri/import"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const org = ctx.tenant.organizationId;
    const campuri = {
      mapare: input.profil.mapare,
      format_data: input.profil.format_data,
      separator_zecimal: input.profil.separator_zecimal,
      delimitator: input.profil.delimitator,
      codificare: input.profil.codificare,
      rand_antet: input.profil.rand_antet,
      updated_by: ctx.user.id,
    };
    // Citire, apoi UPDATE sau INSERT: `.upsert()` pe un index unic PARȚIAL
    // cade cu 42P10 (capcana 7).
    const existent = await profilImport(org, input.emitent);
    if (existent !== null) {
      const { data, error } = await ctx.supabase
        .from("fuel_card_import_profiles")
        .update(campuri)
        .eq("id", existent.id)
        .eq("organization_id", org)
        .is("deleted_at", null)
        .select("id")
        .maybeSingle();
      if (error !== null) traduEroareCarduri(error);
      if (data === null) {
        throw businessRule("Maparea s-a schimbat între timp. Reîncărcați pagina și reîncercați.");
      }
      return { id: data.id };
    }
    const { data, error } = await ctx.supabase
      .from("fuel_card_import_profiles")
      .insert({
        organization_id: org,
        emitent: input.emitent,
        ...campuri,
        created_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error !== null) traduEroareCarduri(error);
    return { id: data.id };
  },
});

// ── 4. Aplicarea ───────────────────────────────────────────────────────────

type RandDeScris = Readonly<{
  organization_id: string;
  import_id: string;
  emitent: string;
  cheie_dedup: string;
  id_tranzactie_emitent: string | null;
  rand_fisier: number;
  card_id: string | null;
  card_ultimele_cifre: string | null;
  efectuat_la: string;
  are_ora: boolean;
  produs: string;
  categorie: RandLot["categorie"];
  tip_combustibil: RandLot["tipCombustibil"];
  cantitate: number | null;
  pret_unitar: number | null;
  valoare_bruta: number;
  valoare_neta: number | null;
  tva: number | null;
  moneda: string;
  statie: string | null;
  localitate: string | null;
  tara: string | null;
  nr_inmatriculare_extras: string | null;
  km_declarat: number | null;
  numar_bon: string | null;
  vehicle_id: string | null;
  trip_sheet_id: string | null;
  fuel_entry_id: string | null;
  stare_potrivire: StarePotrivire;
  motiv: string | null;
  created_by: string;
  updated_by: string;
}>;

function randDeScris(
  ctx: ActionContext,
  lot: LotExtras,
  importId: string,
  r: RandLot,
  p: RezultatPotrivire,
): RandDeScris {
  return {
    organization_id: ctx.tenant.organizationId,
    import_id: importId,
    emitent: lot.emitent,
    cheie_dedup: r.cheie,
    id_tranzactie_emitent: r.idTranzactie,
    rand_fisier: r.rand,
    card_id: p.cardId,
    card_ultimele_cifre: r.cifreCard,
    efectuat_la: r.efectuatLa,
    are_ora: r.areOra,
    produs: r.produs,
    categorie: p.categorie,
    tip_combustibil: r.tipCombustibil,
    cantitate: r.cantitate,
    pret_unitar: r.pretUnitar,
    valoare_bruta: r.valoareBruta,
    valoare_neta: r.valoareNeta,
    tva: r.tva,
    moneda: r.moneda,
    statie: r.statie,
    localitate: r.localitate,
    tara: r.tara,
    nr_inmatriculare_extras: r.nrInmatriculare,
    km_declarat: r.kmDeclarat,
    numar_bon: r.numarBon,
    vehicle_id: p.vehicleId,
    trip_sheet_id: p.tripSheetId,
    fuel_entry_id: p.fuelEntryId,
    stare_potrivire: p.stare,
    motiv: p.motiv,
    created_by: ctx.user.id,
    updated_by: ctx.user.id,
  };
}

/** Lotul din Storage, revalidat la graniță: conținutul e tratat ca date externe. */
async function citesteLot(ctx: ActionContext, batchId: string): Promise<LotExtras> {
  const descarcare = await ctx.supabase.storage
    .from(BUCKET_DOCUMENTE)
    .download(caleLotCard(ctx.tenant.organizationId, batchId));
  if (descarcare.error !== null || descarcare.data === null) {
    throw businessRule("Previzualizarea a expirat. Reluați importul de la încărcarea fișierului.");
  }
  let brut: unknown;
  try {
    brut = JSON.parse(await descarcare.data.text());
  } catch {
    throw businessRule("Lotul salvat nu mai poate fi citit. Reluați importul.");
  }
  const lot = lotExtrasSchema.safeParse(brut);
  if (!lot.success) throw businessRule("Lotul salvat nu mai poate fi citit. Reluați importul.");
  return lot.data;
}

/**
 * Lotul în `fuel_card_imports`, cu `id = batchId`. Un 23505 e reluare DOAR dacă
 * rândul existent, recitit sub RLS, e al aceleiași firme și al aceluiași fișier:
 * `id`-ul vine din client, deci nu se crede pe cuvânt.
 */
async function asiguraImportul(ctx: ActionContext, batchId: string, lot: LotExtras): Promise<void> {
  const org = ctx.tenant.organizationId;
  const existent = await citesteImport(org, batchId);
  if (existent !== null) {
    if (existent.deleted_at !== null || existent.fisier_sha256 !== lot.fisierSha256) {
      throw businessRule("Importul acesta a fost anulat sau e al altui fișier. Reluați importul.");
    }
    return;
  }
  const { error } = await ctx.supabase.from("fuel_card_imports").insert({
    id: batchId,
    organization_id: org,
    emitent: lot.emitent,
    fisier_nume: lot.fisierNume.slice(0, 255),
    fisier_sha256: lot.fisierSha256,
    perioada_de_la: lot.perioadaDeLa,
    perioada_pana_la: lot.perioadaPanaLa,
    randuri_fisier: lot.randuriFisier,
    respinse: lot.respinse,
    created_by: ctx.user.id,
    updated_by: ctx.user.id,
  });
  if (error === null) return;
  if (error.code === "23505") {
    const recitit = await citesteImport(org, batchId);
    if (
      recitit !== null &&
      recitit.deleted_at === null &&
      recitit.fisier_sha256 === lot.fisierSha256
    ) {
      return;
    }
    throw businessRule(
      "Identificatorul importului e deja folosit. Reluați importul de la încărcare.",
    );
  }
  traduEroareCarduri(error);
}

const MOTIV_ALIMENTARE_LUATA =
  "Alimentarea potrivită a fost legată între timp de altă tranzacție. Repotriviți luna.";

/** Ce index unic a refuzat rândul: doar dedup-ul înseamnă „importat deja”. */
function indexRefuzat(error: Readonly<{ code: string; message: string }>) {
  if (error.code !== "23505") return null;
  if (error.message.includes("fctx_dedup_uq")) return "dedup" as const;
  if (error.message.includes("fctx_alimentare_uq")) return "alimentare" as const;
  return null;
}

/**
 * Bloc, iar la 23505 rând cu rând: concurența sau un ID repetat în fișier.
 * Doar `fctx_dedup_uq` e un duplicat. `fctx_alimentare_uq` înseamnă că
 * alimentarea potrivită a fost legată de alt rând după citirea contextului
 * (legare manuală, repotrivire, alt import): tranzacția NU e importată deja, deci
 * se scrie fără legătură, „fără alimentare”, nu se numără tăcut ca duplicat.
 */
async function scrieFelia(
  ctx: ActionContext,
  randuri: readonly RandDeScris[],
): Promise<Readonly<{ scrise: number; duplicate: number }>> {
  if (randuri.length === 0) return { scrise: 0, duplicate: 0 };
  const bloc = await ctx.supabase
    .from("fuel_card_transactions")
    .insert([...randuri])
    .select("id");
  if (bloc.error === null) return { scrise: bloc.data.length, duplicate: 0 };
  if (bloc.error.code !== "23505") traduEroareCarduri(bloc.error);
  let scrise = 0;
  let duplicate = 0;
  for (const rand of randuri) {
    let unu = await ctx.supabase.from("fuel_card_transactions").insert(rand).select("id");
    if (
      unu.error !== null &&
      rand.fuel_entry_id !== null &&
      indexRefuzat(unu.error) === "alimentare"
    ) {
      unu = await ctx.supabase
        .from("fuel_card_transactions")
        .insert({
          ...rand,
          fuel_entry_id: null,
          stare_potrivire: "fara_alimentare",
          motiv: MOTIV_ALIMENTARE_LUATA,
        })
        .select("id");
    }
    if (unu.error === null) scrise += unu.data.length;
    else if (indexRefuzat(unu.error) === "dedup") duplicate += 1;
    else traduEroareCarduri(unu.error);
  }
  return { scrise, duplicate };
}

export const aplicaImportExtras = createAction({
  name: "fleet.card_import.apply",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "all",
  input: aplicaExtrasSchema,
  audit: {
    action: "import",
    entityType: "fuel_card_imports",
    entityId: (input) => input.batchId,
    allow: ["batchId", "offset"],
  },
  revalidate: CAI,
  handler: async (
    ctx,
    input,
  ): Promise<
    Readonly<{
      procesate: number;
      importate: number;
      duplicate: number;
      urmator: number;
      total: number;
      gata: boolean;
    }>
  > => {
    const org = ctx.tenant.organizationId;
    // X2: doar un lot emis de server pentru apelant și deja analizat se aplică
    // (și doar pe el se șterge, la final, lotul din Storage cu clientul admin).
    if (!(await incarcareAnalizata(ctx, "vehicles", input.batchId))) {
      throw businessRule(
        "Previzualizarea a expirat. Reluați importul de la încărcarea fișierului.",
      );
    }
    const lot = await citesteLot(ctx, input.batchId);
    await asiguraImportul(ctx, input.batchId, lot);

    const felie = lot.randuri.slice(input.offset, input.offset + FELIE_APLICARE);
    // Cheile scrise deja (de o felie reluată, de alt import) nu se mai scriu.
    const existente = await cheiDejaImportate(
      org,
      lot.emitent,
      felie.map((r) => r.cheie),
    );
    const noi = felie.filter((r) => !existente.has(r.cheie));
    // Potrivirea se RECALCULEAZĂ: între analiză și aplicare au putut apărea foi
    // sau alimentări, iar felia anterioară a legat deja alimentări.
    const rezultate = await potriveste(ctx, lot.emitent, noi);
    const deScris = noi.flatMap((r, i) => {
      const p = rezultate[i];
      return p === undefined ? [] : [randDeScris(ctx, lot, input.batchId, r, p)];
    });
    const { scrise, duplicate } = await scrieFelia(ctx, deScris);

    const urmator = input.offset + felie.length;
    const gata = urmator >= lot.randuri.length;

    // Contoarele din bază, nu adunate orb: reluarea unei felii nu le dublează.
    const numarare = await ctx.supabase
      .from("fuel_card_transactions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org)
      .eq("import_id", input.batchId)
      .is("deleted_at", null);
    if (numarare.error !== null) throw numarare.error;
    const importate = numarare.count ?? 0;
    const actualizare = await ctx.supabase
      .from("fuel_card_imports")
      .update({
        importate,
        ...(gata
          ? {
              duplicate: Math.max(0, lot.randuri.length - importate),
              finalizat_la: ctx.now.toISOString(),
            }
          : {}),
        updated_by: ctx.user.id,
      })
      .eq("id", input.batchId)
      .eq("organization_id", org)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (actualizare.error !== null) traduEroareCarduri(actualizare.error);
    if (actualizare.data === null) {
      throw businessRule("Importul a fost anulat între timp. Reîncărcați pagina.");
    }

    if (gata) {
      // Lotul (stații, ore, numere de înmatriculare) nu mai are ce căuta în
      // Storage după aplicare. Fără politică DELETE pe `storage.objects`, doar
      // `service_role` îl poate scoate — pe calea construită aici, din tenant.
      const sterge = await createAdminSupabase()
        .storage.from(BUCKET_DOCUMENTE)
        .remove([caleLotCard(org, input.batchId)]);
      if (sterge.error !== null) {
        console.warn("[fleet.card_import.apply] lotul n-a putut fi șters", {
          requestId: ctx.requestId,
          batchId: input.batchId,
          eroare: sterge.error.message,
        });
      }
    }

    return {
      procesate: felie.length,
      importate: scrise,
      duplicate: duplicate + (felie.length - noi.length),
      urmator,
      total: lot.randuri.length,
      gata,
    };
  },
});

// ── 5. Anularea unui import ────────────────────────────────────────────────

export const anuleazaImport = createAction({
  name: "fleet.card_import.cancel",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "all",
  input: anuleazaImportSchema,
  audit: {
    action: "delete",
    entityType: "fuel_card_imports",
    entityId: (input) => input.id,
    allow: ["id"],
  },
  revalidate: CAI,
  handler: async (ctx, input): Promise<Readonly<{ id: string; tranzactii: number }>> => {
    const org = ctx.tenant.organizationId;
    const acum = ctx.now.toISOString();
    // ÎNTÂI tranzacțiile, apoi lotul: indexul de dedup e parțial pe
    // `deleted_at is null`, deci reimportul corectat trece abia după asta.
    const tranzactii = await ctx.supabase
      .from("fuel_card_transactions")
      .update({ deleted_at: acum, updated_by: ctx.user.id })
      .eq("organization_id", org)
      .eq("import_id", input.id)
      .is("deleted_at", null)
      .select("id");
    if (tranzactii.error !== null) traduEroareCarduri(tranzactii.error);
    const lot = await ctx.supabase
      .from("fuel_card_imports")
      .update({ deleted_at: acum, updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", org)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (lot.error !== null) traduEroareCarduri(lot.error);
    if (lot.data === null) {
      throw businessRule("Importul a fost deja anulat sau nu aveți dreptul să-l anulați.");
    }
    return { id: lot.data.id, tranzactii: tranzactii.data.length };
  },
});
