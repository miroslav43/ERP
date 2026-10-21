// src/app/(app)/flota/bon/actions.ts
"use server";

/**
 * Citirea bonului de combustibil de pe poză (F12a, 0213) și urcarea pozei
 * ÎNAINTE ca alimentarea să existe.
 *
 * Fluxul, din formularul „Adaugă o alimentare”:
 *   1. `pregatesteBonNou` semnează calea `{org}/trip_sheets/{foaie}/…` pe
 *      clientul UTILIZATORULUI (politica `flota_objects_insert`, 0202: doar
 *      cine scrie foaia, doar pe ciornă); browserul urcă JPEG-ul re-encodat;
 *   2. `citesteBonul` trimite poza la modelul de viziune și întoarce
 *      propunerea, plus un jeton semnat. NU scrie nimic în bază (doar auditul);
 *   3. omul vede câmpurile completate, corectează și apasă „Adaugă
 *      alimentarea”: `adaugaAlimentare` leagă poza și, cu jetonul valid, lasă
 *      serverul să scrie propunerea (`flota/actions.ts`).
 *
 * Nimic nu se salvează automat: clicul pe „Citește bonul” e consimțământul
 * omului pentru trimiterea pozei la terț, iar salvarea rămâne a lui.
 *
 * „use server”: se exportă DOAR funcții async (capcana 39). Tipul rezultatului
 * stă în `@/domain/fleet/bon-ocr`, ca să-l poată importa și clientul.
 */

import { createAction } from "@/lib/actions/create-action";
import {
  businessRule,
  forbidden,
  invalidInput,
  limitExceeded,
  notFound,
} from "@/lib/actions/errors";
import { serverEnv } from "@/config/env";
import { citesteImagineStructurat } from "@/lib/asistent/viziune";
import { semneazaPropunere } from "@/lib/fleet/jeton-bon";
import { momentDinOraRomaniei, oraRomanieiPentruCamp } from "@/lib/format/date";
import { idFisaProprie } from "@/lib/queries/employees";
import { masoaraObiectul } from "@/lib/storage/masoara-obiectul";
import { createServerSupabase } from "@/lib/supabase/server";
import { consumeRateLimit } from "@/lib/utils/rate-limit";
import {
  BonNecitibil,
  esteJpeg,
  faraMetadateJpeg,
  INSTRUCTIUNE_BON,
  interpreteazaBon,
  LIMITA_OCTETI_OCR,
  NUME_SCHEMA_BON,
  plafoneazaAvertismente,
  PROMPT_BON,
  raspunsBonSchema,
  SCHEMA_JSON_BON,
  type RezultatCitireBon,
} from "@/domain/fleet/bon-ocr";
import {
  BUCKET_FLOTA,
  caleFlotaValida,
  construiesteCaleFlota,
  verificaFisierFlota,
} from "@/domain/fleet/fisiere";
import { citesteBonulSchema, pregatesteBonNouSchema } from "@/schemas/fleet";

/** Limitele proprii (F12a D14), ÎNAINTEA apelului extern: acolo abuzul costă bani. */
const LIMITE_OCR = [
  { cheie: (u: string, _o: string) => `ocr-bon:utilizator:${u}`, limita: 20, fereastra: 3600 },
  { cheie: (_u: string, o: string) => `ocr-bon:organizatie:${o}`, limita: 300, fereastra: 86400 },
  { cheie: () => "ocr-bon:global", limita: 30, fereastra: 60 },
] as const;

type FoaieCitita = Readonly<{
  id: string;
  status: string;
  employee_id: string | null;
  plecare_la: string;
  sosire_la: string | null;
  data: string | null;
}>;

/** `%`, `_` și `\` se escapează: altfel „12_3” găsește și „1243”. */
function pentruLike(sir: string): string {
  return sir.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export const pregatesteBonNou = createAction({
  name: "fleet.fuel.receipt_prepare_new",
  feature: "fleet",
  permission: "trip_sheets:update",
  minScope: "own",
  input: pregatesteBonNouSchema,
  audit: {
    action: "import",
    entityType: "fuel_entry",
    allow: ["trip_sheet_id", "numeFisier", "dimensiune", "mime"],
  },
  handler: async (ctx, input): Promise<Readonly<{ cale: string; urlSemnat: string }>> => {
    const problema = verificaFisierFlota(input.mime, input.dimensiune);
    if (problema !== null) throw invalidInput(problema, {});

    const db = await createServerSupabase();
    const { data: foaie, error } = await db
      .from("trip_sheets")
      .select("id, status")
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("id", input.trip_sheet_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error !== null) throw error;
    if (foaie === null) throw notFound("Foaia de parcurs nu mai există. Reîncărcați pagina.");
    if (foaie.status !== "draft") {
      throw businessRule("Bonul se atașează doar cât foaia e ciornă.");
    }

    const cale = construiesteCaleFlota(
      ctx.tenant.organizationId,
      "trip_sheets",
      input.trip_sheet_id,
      input.numeFisier,
    );
    // Politica bucketului judecă dreptul de SCRIERE pe foaie și starea ei; cine
    // n-are voie nu primește URL.
    const { data, error: eroareSemnare } = await db.storage
      .from(BUCKET_FLOTA)
      .createSignedUploadUrl(cale);
    if (eroareSemnare !== null) {
      throw businessRule(
        "Nu am putut pregăti încărcarea bonului. Bonul se atașează doar cât foaia e ciornă, de cine o poate modifica.",
      );
    }
    return { cale, urlSemnat: data.signedUrl };
  },
});

export const citesteBonul = createAction({
  name: "fleet.fuel.receipt.read",
  feature: "fleet",
  permission: "trip_sheets:update",
  minScope: "own",
  input: citesteBonulSchema,
  // Datele ies către un terț: e un export în sensul jurnalului. Rândul de audit
  // e evidența prelucrării („cine a trimis ce bon, când”), fără conținutul lui.
  audit: { action: "export", entityType: "fuel_receipt_ocr", allow: ["trip_sheet_id", "cale"] },
  // FĂRĂ `revalidate`: nu scrie nimic.
  handler: async (ctx, input): Promise<RezultatCitireBon> => {
    const org = ctx.tenant.organizationId;

    // 1–2. Comutatorul: cheia OpenRouter și modulul `asistent` (decizia 2 a
    // lui Miro, 12 oct: același sub-împuternicit ca bula).
    if (serverEnv.OPENROUTER_API_KEY === "") {
      throw businessRule("Citirea automată a bonului nu este configurată.");
    }
    if (!ctx.features.has("asistent")) {
      throw businessRule("Citirea automată a bonului cere modulul Asistent AI activ pentru firmă.");
    }

    // 3. Limitele de rată.
    const limite = await Promise.all(
      LIMITE_OCR.map((l) =>
        consumeRateLimit({
          key: l.cheie(ctx.user.id, org),
          limit: l.limita,
          windowSeconds: l.fereastra,
        }),
      ),
    );
    if (limite.some((l) => !l.allowed)) {
      throw limitExceeded(
        "Prea multe citiri de bonuri. Încercați peste câteva minute sau completați manual.",
      );
    }

    // 4. Foaia, sub RLS-ul de CITIRE al omului.
    const db = await createServerSupabase();
    const { data: foaie, error } = await db
      .from("trip_sheets")
      .select("id, status, employee_id, plecare_la, sosire_la, data")
      .eq("organization_id", org)
      .eq("id", input.trip_sheet_id)
      .is("deleted_at", null)
      .maybeSingle<FoaieCitita>();
    if (error !== null) throw error;
    if (foaie === null) throw notFound("Foaia de parcurs nu mai există. Reîncărcați pagina.");
    // 0200 §D1: alimentările se adaugă doar pe ciornă.
    if (foaie.status !== "draft") {
      throw businessRule(
        "Foaia nu mai este ciornă: alimentările se adaugă doar cât foaia e în lucru.",
      );
    }
    // Garda de proprietar (F12a R6), ÎNAINTEA Storage-ului și a terțului: a
    // citi foaia nu înseamnă a avea voie s-o scrie. Managerul vede foile
    // echipei (`trip_sheets:read = team`), iar poarta bucketului îi dă și
    // poza; fără garda asta ar putea trimite la terț bonurile subordonaților.
    if (ctx.scope !== "all") {
      const proprie = await idFisaProprie(org, ctx.user.id);
      if (proprie === null || foaie.employee_id !== proprie) {
        throw forbidden("Puteți citi doar bonurile de pe foile dumneavoastră.");
      }
    }

    // 5. Calea: exact în folderul foii, fără `..` și fără subfoldere.
    if (!caleFlotaValida(input.cale, org, "trip_sheets", foaie.id)) {
      throw invalidInput("Calea fișierului nu corespunde foii.", {});
    }

    // 6. Obiectul, sub sesiunea omului: un `cale` străin dă null aici.
    const masura = await masoaraObiectul(db, BUCKET_FLOTA, input.cale);
    if (masura === null) {
      throw businessRule("Fotografia bonului nu a ajuns în Storage sau nu vă este accesibilă.");
    }
    if (masura.octeti > LIMITA_OCTETI_OCR) {
      throw businessRule(
        "Fotografia e prea mare pentru citire. Urcați din nou poza din formular sau completați manual.",
      );
    }
    const { data: fisier, error: eroareDescarcare } = await db.storage
      .from(BUCKET_FLOTA)
      .download(input.cale);
    if (eroareDescarcare !== null || fisier === null) {
      throw businessRule("Fotografia bonului nu a ajuns în Storage sau nu vă este accesibilă.");
    }
    const octeti = new Uint8Array(await fisier.arrayBuffer());

    // 7. Doar JPEG, fără metadate (GPS-ul șoferului nu pleacă la terț).
    if (!esteJpeg(octeti)) {
      throw businessRule(
        "Citirea automată merge doar pe fotografii JPEG. Urcați din nou poza din formular.",
      );
    }
    let curat: Uint8Array;
    try {
      curat = faraMetadateJpeg(octeti);
    } catch (eroare) {
      if (eroare instanceof BonNecitibil) {
        throw businessRule(
          "Fotografia bonului nu se poate citi. Urcați din nou poza din formular sau completați manual.",
        );
      }
      throw eroare;
    }

    // 8. Modelul de viziune.
    const rezultat = await citesteImagineStructurat({
      prompt: PROMPT_BON,
      instructiune: INSTRUCTIUNE_BON,
      jpegBase64: Buffer.from(curat).toString("base64"),
      schema: { name: NUME_SCHEMA_BON, schema: SCHEMA_JSON_BON },
    });
    if (!rezultat.ok) throw businessRule(rezultat.mesaj);
    let brut: unknown;
    try {
      brut = JSON.parse(rezultat.continut);
    } catch {
      throw businessRule("Bonul nu a putut fi citit. Completați manual.");
    }
    const raspuns = raspunsBonSchema.safeParse(brut);
    if (!raspuns.success) throw businessRule("Bonul nu a putut fi citit. Completați manual.");

    // 9. CUI-ul firmei, din coloana GENERATED (doar cifre), nu din `cui`.
    const { data: firma, error: eroareFirma } = await db
      .from("organizations")
      .select("cui_normalizat")
      .eq("id", org)
      .maybeSingle();
    if (eroareFirma !== null) throw eroareFirma;
    const cuiFirma = firma?.cui_normalizat ?? "";

    const interpretare = interpreteazaBon(raspuns.data, {
      plecareCamp: oraRomanieiPentruCamp(foaie.plecare_la),
      sosireCamp: foaie.sosire_la === null ? null : oraRomanieiPentruCamp(foaie.sosire_la),
      ziFoii: foaie.data,
      cuiFirma: cuiFirma === "" ? null : cuiFirma,
    });
    if (interpretare.propunere === null) {
      return {
        propunere: null,
        motivGol: interpretare.motivGol ?? "Bonul nu a putut fi citit. Completați manual.",
      };
    }
    const propunere = interpretare.propunere;
    const avertismente = [...interpretare.avertismente];

    // 10. Bonul dublat (F12a D18): avertisment, nu constrângere. Sub RLS-ul
    // omului — un `employee` nu vede foile colegilor, iar asta e acceptat.
    if (propunere.numar_bon !== null) {
      const tipar = pentruLike(propunere.numar_bon);
      const { data: peFoaie, error: eroarePeFoaie } = await db
        .from("fuel_entries")
        .select("id")
        .eq("organization_id", org)
        .eq("trip_sheet_id", foaie.id)
        .ilike("numar_bon", tipar)
        .is("deleted_at", null)
        .limit(1);
      if (eroarePeFoaie !== null) throw eroarePeFoaie;
      if ((peFoaie ?? []).length > 0) {
        avertismente.unshift("Bonul e deja înregistrat pe foaia asta; salvarea va fi refuzată.");
      } else if (propunere.cui_statie !== null && propunere.alimentat_la !== null) {
        const ziua = propunere.alimentat_la.slice(0, 10);
        const de = momentDinOraRomaniei(`${ziua}T00:00`);
        const urmatoarea = new Date(`${ziua}T00:00:00Z`);
        urmatoarea.setUTCDate(urmatoarea.getUTCDate() + 1);
        const pana = momentDinOraRomaniei(`${urmatoarea.toISOString().slice(0, 10)}T00:00`);
        if (de !== null && pana !== null) {
          const { data: altele, error: eroareAltele } = await db
            .from("fuel_entries")
            .select("id, trip_sheet_id")
            .eq("organization_id", org)
            .eq("cui_statie", propunere.cui_statie)
            .ilike("numar_bon", tipar)
            .is("deleted_at", null)
            .gte("alimentat_la", de)
            .lt("alimentat_la", pana)
            .neq("trip_sheet_id", foaie.id)
            .limit(1);
          if (eroareAltele !== null) throw eroareAltele;
          if ((altele ?? []).length > 0) {
            avertismente.unshift(
              "Un bon cu același număr, de la aceeași stație și din aceeași zi, e deja pe altă foaie. Verificați că nu e trecut de două ori.",
            );
          }
        }
      }
    }

    // 11. Propunerea + jetonul (doar transportul spre `adaugaAlimentare`).
    const finale = plafoneazaAvertismente(avertismente);
    const jeton = semneazaPropunere({
      org,
      user: ctx.user.id,
      foaie: foaie.id,
      cale: input.cale,
      propunere,
      model: rezultat.model,
      avertismente: finale,
    });
    return { propunere, avertismente: finale, jeton };
  },
});
