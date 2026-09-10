import "server-only";

// src/lib/registru/document-generat.ts
//
// Al doilea drum către registru, pentru documentele care se produc LA CERERE și
// n-au rând în bază: statul de plată, fluturașul, declarația 112, nota contabilă,
// ordinul bancar, foaia colectivă de prezență, afișul de punct de lucru și
// listarea de audit. Nu există INSERT pe care să pui trigger, deci ruta cheamă
// singură.
//
// ── DE CE EȘECUL ÎNREGISTRĂRII OPREȘTE EXPORTUL ─────────────────────────────
// Tentația e să înregistrezi „pe lângă", ca o eroare de registru să nu strice
// descărcarea contabilului. Consecința ar fi un document oficial ieșit din firmă
// fără număr — exact ce interzice Ordinul 217/1996 art. 8, și exact defectul de
// la care a pornit livrarea asta.
//
// Deci: fără număr, fără document. Dacă înregistrarea cade, cade și exportul, cu
// mesajul bazei. Un contabil care vede „Registrul pe anul 2025 este închis" știe
// ce să facă; unul care primește un PDF fără număr nu află niciodată.
//
// ── DE CE POARTA NU E `registru:*` ──────────────────────────────────────────
// Cine exportă un stat de plată n-are de ce să aibă cheia registrului. Funcția
// din bază verifică permisiunea MODULULUI, dedusă din tipul documentului printr-un
// `case` explicit — un tip necunoscut ridică P0001, nu alocă tăcut.

import type { ServerSupabase } from "@/lib/supabase/server";

/**
 * Tipurile pe care `public.inregistreaza_document_generat` le acceptă.
 *
 * `afis_punct_lucru` și `listare_audit` au fost SCOASE de 0142: afișul cu codul QR
 * de pontare e o unealtă a aplicației, nu unul dintre afișajele obligatorii, iar
 * jurnalul de audit e un log tehnic — OMFP 2634/2015 pct. 56 cere listarea
 * documentelor FINANCIAR-CONTABILE la cererea organelor de control, nu a lui.
 *
 * Un tip scos de aici e scos și din `case`-ul funcției: o rută care l-ar mai cere
 * primește P0001, nu un număr alocat tăcut.
 */
export type TipDocumentGenerat =
  | "fluturas"
  | "stat_plata"
  | "d112"
  | "nota_contabila"
  | "ordin_bancar"
  | "foaie_colectiva_prezenta";

export type CerereInregistrare = Readonly<{
  organizationId: string;
  tip: TipDocumentGenerat;
  /** Art. 9 — „conţinutul documentului în rezumat”. */
  rezumat: string;
  /** Tabela sau conceptul din care provine documentul, pentru idempotență. */
  entitateTip: string;
  /**
   * Entitatea concretă. Cu ea, regenerarea aceluiași document NU arde un număr:
   * un stat de plată descărcat de zece ori are un singur număr de înregistrare.
   * Fără ea, fiecare apel produce un rând nou.
   */
  entitateId?: string | null;
  punctLucruId?: string | null;
}>;

export type RezultatInregistrare =
  Readonly<{ ok: true; numarAfisat: string }> | Readonly<{ ok: false; mesaj: string }>;

/**
 * Înregistrează un document generat și întoarce numărul lui.
 *
 * Nu aruncă: rutele de export răspund cu text simplu și cod HTTP, nu cu excepții.
 * Apelantul decide statusul, dar NU are voie să continue pe ramura de eșec.
 */
export async function inregistreazaDocumentGenerat(
  db: ServerSupabase,
  cerere: CerereInregistrare,
): Promise<RezultatInregistrare> {
  const { data, error } = await db.rpc("inregistreaza_document_generat", {
    p_organization_id: cerere.organizationId,
    p_tip_document: cerere.tip,
    p_continut_rezumat: cerere.rezumat.slice(0, 500),
    p_entitate_tip: cerere.entitateTip,
    p_entitate_id: cerere.entitateId ?? null,
    p_punct_lucru_id: cerere.punctLucruId ?? null,
  });

  if (error !== null) {
    // Mesajele funcției sunt scrise pentru utilizatorul final și au date în ele.
    // Se propagă ca atare; un „a apărut o eroare" n-ar spune ce să corectezi.
    return { ok: false, mesaj: error.message.slice(0, 300) };
  }
  if (typeof data !== "string" || data.length === 0) {
    return { ok: false, mesaj: "Registrul nu a întors un număr de înregistrare." };
  }
  return { ok: true, numarAfisat: data };
}

/**
 * Numărul de înregistrare, curățat pentru un nume de fișier: „437/02.09.2026”
 * devine „437-02.09.2026”. Bara e separator de cale pe orice sistem de fișiere.
 */
export const numarPentruFisier = (numarAfisat: string): string =>
  numarAfisat.replace(/[^\p{L}\p{N}._-]+/gu, "-");
