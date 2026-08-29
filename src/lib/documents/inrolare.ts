// src/lib/documents/inrolare.ts
// Cele cinci documente ale înrolării, dintr-un singur apel.
//
// Înlocuiește `contract-munca.ts` și `fisa-postului.ts`, care făceau fiecare
// aceleași două citiri (organizația, CNP-ul decriptat) și își construiau harta
// de valori pe cont propriu. Cu cinci documente, asta ar fi însemnat cinci
// citiri ale aceleiași organizații și cinci decriptări ale aceluiași CNP.
//
// ── FIECARE DOCUMENT EȘUEAZĂ SINGUR ───────────────────────────────────────
// `genereazaDocument` aruncă dacă o variabilă n-are valoare sau dacă șablonul
// nu e configurat pentru organizație. Un eșec nu are voie să oprească
// înrolarea, care a reușit deja, și nici celelalte patru documente. De aceea
// fiecare stă în propriul `try/catch` și adaugă un avertisment — același tipar
// pe care `nou/actions.ts` îl folosește pentru inventar și SSM.
import { decrypt, dinBytea } from "@/lib/crypto/aes-gcm";
import { notFound } from "@/lib/actions/errors";
import type { ServerSupabase } from "@/lib/supabase/server";

import { genereazaDocument } from "./generator";
import {
  valoriActAditionalTelemunca,
  valoriAnexaPi,
  valoriContractMunca,
  valoriFisaPostului,
  valoriNda,
  type ContextDocumente,
  type DateAngajat,
  type DateContract,
} from "./valori-inrolare";

/**
 * Cât ține confidențialitatea după încetarea contractului.
 *
 * ⚠️ NU e o valoare legală: art. 26 din Codul muncii dă clauza de
 * confidențialitate, dar nu-i fixează durata — se negociază. Doi ani e uzanța
 * cea mai frecventă. De confirmat de jurist, ca tot restul textelor din 0100.
 */
const DURATA_CONFIDENTIALITATE = "doi ani";

/** Modurile de lucru care cer act adițional de telemuncă. */
const CERE_ACT_TELEMUNCA: readonly string[] = ["telemunca", "domiciliu", "mixt"];

export type DocumentEmis = Readonly<{
  cod: string;
  denumire: string;
  id: string;
  numarAfisat: string;
}>;

export type ParametriDocumenteInrolare = Readonly<{
  organizationId: string;
  employeeId: string;
  contractId: string;
  emisDe: string;
  azi: string;
  /** Fără `cnpComplet`: se decriptează aici, o singură dată pentru toate cinci. */
  angajat: Omit<DateAngajat, "cnpComplet">;
  contract: DateContract;
  /** Codul brut al modului de lucru (`work_mode`), nu eticheta lui. */
  codModLucru: string;
  /** Fișa postului: dacă lipsește, documentul nu se generează. */
  fisaPostului: Readonly<{
    subordonare: string | null;
    atributii: readonly string[];
    competente: readonly string[];
  }> | null;
  /**
   * Restrânge emiterea la codurile date.
   *
   * Există pentru RE-emitere: la înrolare se generează tot, dar dacă unul
   * singur a eșuat, a doua încercare nu are voie să le producă pe celelalte a
   * doua oară — fiecare emitere consumă un număr din registrul seriei, iar două
   * contracte de muncă pentru același om nu se pot „anula" din interfață.
   */
  doarCodurile?: readonly string[];
}>;

export type RezultatDocumente = Readonly<{
  documente: readonly DocumentEmis[];
  avertismente: readonly string[];
}>;

/**
 * CNP-ul complet, decriptat.
 *
 * Un contract real cere CNP-ul întreg — cerință legală, nu preferință. Se
 * decriptează prin `hr_read_sensitive`, RPC-ul deja folosit de
 * `dezvaluieDateSensibile`, care scrie și rândul de audit al consultării.
 */
async function cnpComplet(supabase: ServerSupabase, employeeId: string): Promise<string> {
  const { data } = await supabase.rpc("hr_read_sensitive", { p_employee: employeeId });
  const rand = data?.[0];
  if (
    rand?.cnp_ciphertext === undefined ||
    rand.cnp_ciphertext === null ||
    rand.cnp_iv === null ||
    rand.cnp_tag === null ||
    rand.cnp_key_version === null
  ) {
    return "CNP nefurnizat la înrolare";
  }
  return decrypt({
    ciphertext: dinBytea(rand.cnp_ciphertext),
    iv: dinBytea(rand.cnp_iv),
    tag: dinBytea(rand.cnp_tag),
    keyVersion: String(rand.cnp_key_version),
  });
}

export async function genereazaDocumenteInrolare(
  supabase: ServerSupabase,
  parametri: ParametriDocumenteInrolare,
): Promise<RezultatDocumente> {
  const { data: organizatie } = await supabase
    .from("organizations")
    .select("name, legal_name, reprezentant_legal")
    .eq("id", parametri.organizationId)
    .maybeSingle();
  if (organizatie === null) throw notFound("Organizația nu a putut fi citită.");

  const context: ContextDocumente = {
    organizatie: {
      // Documentul e oficial: forma juridică completă dacă a fost completată,
      // altfel denumirea uzuală — niciodată nesetat.
      denumire: organizatie.legal_name ?? organizatie.name,
      reprezentantLegal: organizatie.reprezentant_legal,
    },
    angajat: {
      ...parametri.angajat,
      cnpComplet: await cnpComplet(supabase, parametri.employeeId),
    },
    contract: parametri.contract,
    azi: parametri.azi,
  };

  const deEmis: readonly {
    cod: string;
    denumire: string;
    valori: ReadonlyMap<string, string>;
    contractId?: string;
  }[] = [
    {
      cod: "contract_munca",
      denumire: "Contractul de muncă",
      valori: valoriContractMunca(context),
      contractId: parametri.contractId,
    },
    ...(parametri.fisaPostului === null
      ? []
      : [
          {
            cod: "fisa_postului",
            denumire: "Fișa postului",
            valori: valoriFisaPostului(context, parametri.fisaPostului),
          },
        ]),
    {
      cod: "nda",
      denumire: "Acordul de confidențialitate",
      valori: valoriNda(context, DURATA_CONFIDENTIALITATE),
    },
    {
      cod: "anexa_proprietate_intelectuala",
      denumire: "Anexa de proprietate intelectuală",
      valori: valoriAnexaPi(context),
      contractId: parametri.contractId,
    },
    ...(CERE_ACT_TELEMUNCA.includes(parametri.codModLucru)
      ? [
          {
            cod: "act_aditional_telemunca",
            denumire: "Actul adițional de telemuncă",
            valori: valoriActAditionalTelemunca(context),
            contractId: parametri.contractId,
          },
        ]
      : []),
  ];

  const documente: DocumentEmis[] = [];
  const avertismente: string[] = [];

  const cerute =
    parametri.doarCodurile === undefined
      ? deEmis
      : deEmis.filter((d) => parametri.doarCodurile?.includes(d.cod) === true);

  for (const document of cerute) {
    try {
      const emis = await genereazaDocument(supabase, {
        organizationId: parametri.organizationId,
        employeeId: parametri.employeeId,
        codSablon: document.cod,
        emisDe: parametri.emisDe,
        valori: document.valori,
        ...(document.contractId === undefined ? {} : { contractId: document.contractId }),
      });
      documente.push({
        cod: document.cod,
        denumire: document.denumire,
        id: emis.id,
        numarAfisat: emis.numarAfisat,
      });
    } catch (eroare) {
      // Numele documentului intră ÎN mesaj: `genereazaDocument` formulează
      // același text pentru orice variabilă lipsă, iar cu cinci documente
      // avertismentele ar fi fost indistincte.
      avertismente.push(
        `${document.denumire} nu a putut fi generat. Îl puteți emite din fișa angajatului, secțiunea Documente.`,
      );
      console.error("[documente] generare eșuată", {
        cod: document.cod,
        employeeId: parametri.employeeId,
        eroare,
      });
    }
  }

  return { documente, avertismente };
}
