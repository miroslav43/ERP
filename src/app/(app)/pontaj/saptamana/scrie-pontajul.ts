// src/app/(app)/pontaj/saptamana/scrie-pontajul.ts
// Săptămâna aprobată devine pontaj: zilele din submisie ajung în
// `attendance_entries`, de unde le citesc calendarul, foaia colectivă și
// salarizarea.
//
// ┌ De ce e nevoie ──────────────────────────────────────────────────────────
// │ `attendance_week_submissions` (0041) a fost gândit ca PLAN. Pentru firma
// │ care îl folosește însă, formularul acela E fișa de pontaj a săptămânii:
// │ ecranul stă sub „Pontaj", butonul spune „Trimite spre aprobare", aprobarea
// │ vine — și nu se întâmpla nimic. Calendarul rămânea gol, iar salarizarea,
// │ care citește `attendance_entries`, număra zero ore pentru o săptămână
// │ întreagă declarată ȘI aprobată.
// └──────────────────────────────────────────────────────────────────────────
//
// ┌ Ce NU calcă peste ───────────────────────────────────────────────────────
// │ Nicio zi care are deja un rând scris de altcineva sau altfel. Regula e
// │ simetrică celei din `sincronizeazaZileleDeConcediu`, care sare peste zilele
// │ pontate manual: aici sărim peste ORICE rând existent, oricare ar fi sursa
// │ lui. Un pontaj făcut de om în timpul săptămânii e mai aproape de adevăr
// │ decât o declarație aprobată la sfârșit, iar concediul aprobat (`0133`) nici
// │ n-ar fi trebuit să ajungă în plan.
// │
// │ Consecința: reaprobarea unei săptămâni NU rescrie zilele deja scrise. E
// │ deliberat — corectura unei zile se face din ziua aceea, nu prin retrimiterea
// │ săptămânii, altfel două ecrane s-ar contrazice pe același rând.
// └──────────────────────────────────────────────────────────────────────────
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { oreleZilei, type ConfigZi } from "@/domain/attendance/calcul-ore";
import type { Database } from "@/types/database";

type AdminSupabase = SupabaseClient<Database>;

/** `"08:30:00"` din Postgres → `"08:30"`, forma cerută de `minuteDinOra`. */
function ora(valoare: string | null): string {
  return (valoare ?? "").slice(0, 5);
}

export interface RezultatScriere {
  /** Zile scrise efectiv în pontaj. */
  readonly scrise: number;
  /** Zile sărite fiindcă aveau deja un rând — concediu, pontare proprie, import. */
  readonly pastrate: number;
}

interface ZiDeScris {
  readonly data: string;
  readonly ora_inceput: string | null;
  readonly ora_sfarsit: string | null;
  readonly tip_prezenta: Database["public"]["Enums"]["attendance_presence_kind"];
  readonly observatii: string | null;
}

/**
 * Scrie în pontaj zilele unei săptămâni tocmai aprobate.
 *
 * NU aruncă. Aprobarea e deja înregistrată când se ajunge aici, iar o scriere
 * căzută nu are voie s-o desfacă — la fel ca sincronizarea concediilor din
 * `decideCerere`. Ce n-a mers iese prin numere și se poate relua din ziua
 * respectivă.
 *
 * Clientul e cel ADMIN: aprobatorul are `attendance:approve`, nu
 * `attendance:create` pentru fișa altcuiva. Filtrul pe `organization_id` e
 * explicit pe fiecare interogare — ține locul lui RLS cât timp clientul e cel
 * de serviciu.
 */
export async function scriePontajulSaptamanii(
  admin: AdminSupabase,
  organizationId: string,
  submissionId: string,
  employeeId: string,
  config: ConfigZi,
  /**
   * Tipul fiecărei zile — `lucratoare`, `weekend`, `sarbatoare`.
   *
   * Se derivă de APELANT, cu `tipZiAutomat` și calendarul firmei, exact ca la
   * ziua individuală. Triggerul BEFORE îl completează doar când vine `null`,
   * iar tipul generat nu permite `null` pe coloană — deci a-l lăsa pe seama
   * bazei nu e o opțiune, ci o scăpare care ar fi scris totul ca `lucratoare`.
   */
  tipZiPentru: (data: string) => Database["public"]["Enums"]["attendance_day_type"],
  /**
   * Cine a aprobat săptămâna. Zilele sosesc APROBATE, cu el ca autor.
   *
   * ── DE CE, ȘI DE CE E ESENȚIAL ─────────────────────────────────────────
   * Firma folosește fișa săptămânală ca metodă de pontaj: angajatul o
   * completează, managerul o aprobă, iar orele trebuie să apară peste tot.
   * Scrise NEaprobate, ele reapăreau în „Aprobă în bloc" ca linii de aprobat —
   * exact ce tocmai fusese aprobat, cerut a doua oară, de același om.
   *
   * Ecranul de aprobare ajungea atunci să se contrazică singur: sus o
   * săptămână de aprobat, jos „Nimic de aprobat".
   *
   * Aprobarea NU se inventează: momentul e chiar acum, iar autorul e cel care
   * tocmai a apăsat — `decideSaptamanaPontaj` verifică `attendance:approve`
   * înainte să ajungă aici.
   */
  aprobatDe: string,
  aprobatLa: string,
  requestId: string,
): Promise<RezultatScriere> {
  try {
    const { data: zile, error: eroareZile } = await admin
      .from("attendance_week_submission_days")
      .select("data, ora_inceput, ora_sfarsit, tip_prezenta, observatii")
      .eq("organization_id", organizationId)
      .eq("submission_id", submissionId)
      .order("data")
      .returns<ZiDeScris[]>();
    if (eroareZile !== null) throw eroareZile;
    if (zile === null || zile.length === 0) return { scrise: 0, pastrate: 0 };

    /*
     * Doar zilele cu interval COMPLET.
     *
     * O zi lăsată goală înseamnă „n-am lucrat", iar absența unui rând spune
     * exact asta. Un rând cu zero ore ar apărea în foaia colectivă ca zi
     * pontată la zero — altă afirmație decât „nepontată".
     */
    const deScris = zile.filter(
      (z) =>
        z.ora_inceput !== null &&
        z.ora_sfarsit !== null &&
        z.ora_inceput.length > 0 &&
        z.ora_sfarsit.length > 0,
    );
    if (deScris.length === 0) return { scrise: 0, pastrate: 0 };

    // Ce există deja NU se atinge. O singură citire pentru toate zilele, nu una
    // per zi: săptămâna are cel mult șapte, dar drumul spre PostgREST e același.
    const { data: existente, error: eroareExistente } = await admin
      .from("attendance_entries")
      .select("data")
      .eq("organization_id", organizationId)
      .eq("employee_id", employeeId)
      .in(
        "data",
        deScris.map((z) => z.data),
      )
      .is("deleted_at", null);
    if (eroareExistente !== null) throw eroareExistente;
    const dejaScrise = new Set((existente ?? []).map((e) => e.data));

    const randuri = deScris
      .filter((z) => !dejaScrise.has(z.data))
      /*
       * Orele se DERIVĂ din interval, cu setările firmei — nu se iau din
       * `ore_planificate`, care e o cifră scrisă de client și rescrisă oricum
       * pe server la trimitere. O singură aritmetică a pauzei în tot produsul.
       *
       * `ora()` NU e cosmetic. Postgres întoarce `time` ca `08:30:00`, iar
       * `minuteDinOra` cere EXACT `HH:MM` — cu secunde, expresia nu se
       * potrivește, `oreleZilei` întoarce `null`, iar un `?? 0` ar scrie zero
       * ore TĂCUT. Exact asta s-a întâmplat la prima rulare pe date reale:
       * cinci zile intrate în pontaj, toate cu interval corect și zero ore.
       * Restul codului taie la fel (`oraFormular` din `plan-si-fapt.ts`).
       */
      .map((z) => ({
        z,
        derivate: oreleZilei(ora(z.ora_inceput), ora(z.ora_sfarsit), config),
      }))
      /*
       * Un interval necitibil NU produce rând.
       *
       * `oreleZilei` întoarce `null` pentru un interval invalid sau inversat
       * (sfârșit înaintea începutului). Scris cu zero ore, ar fi arătat în
       * calendar ca zi pontată la zero — o afirmație falsă. O zi LIPSĂ se vede
       * și se poate corecta; una la zero pare deja rezolvată.
       */
      .filter(
        (r): r is { z: (typeof deScris)[number]; derivate: NonNullable<typeof r.derivate> } =>
          r.derivate !== null,
      )
      .map(({ z, derivate }) => {
        return {
          organization_id: organizationId,
          employee_id: employeeId,
          data: z.data,
          ora_inceput: z.ora_inceput,
          ora_sfarsit: z.ora_sfarsit,
          ore_lucrate: derivate.lucrate,
          ore_suplimentare: derivate.suplimentare,
          ore_noapte: derivate.noapte,
          tip_prezenta: z.tip_prezenta,
          observatii: z.observatii,
          tip_zi: tipZiPentru(z.data),
          sursa: "saptamana" as const,
          /*
           * `attendance_entries_aprobare_zi_incheiata_ck` (0096) cere ca o zi
           * aprobată cu oră de început să aibă și oră de sfârșit. Filtrul de
           * mai sus lasă să treacă doar zilele cu interval COMPLET, deci
           * constrângerea e satisfăcută prin construcție.
           */
          approved_at: aprobatLa,
          approved_by: aprobatDe,
          /*
           * `period_id` e un identificator INERT: triggerul BEFORE
           * `internal.pontaj_intrare_pregateste` îl suprascrie necondiționat,
           * deschizând și luna dacă lipsește. Coloana e `not null` fără
           * default, deci tipul generat îl cere oricum — același tipar ca la
           * `salveazaZiPontaj`.
           */
          period_id: "00000000-0000-0000-0000-000000000000",
        };
      });

    if (randuri.length === 0) return { scrise: 0, pastrate: deScris.length };

    const { error: eroareInserare } = await admin.from("attendance_entries").insert(randuri);
    if (eroareInserare !== null) throw eroareInserare;

    return { scrise: randuri.length, pastrate: deScris.length - randuri.length };
  } catch (eroare) {
    console.error("[pontaj] săptămâna aprobată nu a putut fi scrisă în pontaj", {
      requestId,
      submissionId,
      employeeId,
      eroare,
    });
    return { scrise: 0, pastrate: 0 };
  }
}
