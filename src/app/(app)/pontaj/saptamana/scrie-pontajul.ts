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
// │
// │ EXCEPȚIA, varianta săptămânală (0165): acolo foaia săptămânii e SINGURA
// │ cale prin care omul se pontează, deci retrimiterea trebuie să corecteze.
// │ Cu `rescrie`, rândurile `sursa = 'saptamana'` ale săptămânii se șterg logic
// │ și se scriu din nou; rândurile din ALTE surse (concediu, corectura
// │ responsabilului) rămân neatinse, ca înainte.
// └──────────────────────────────────────────────────────────────────────────
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { oreleZilei, type ConfigZi } from "@/domain/attendance/calcul-ore";
import { configZiDin } from "@/domain/attendance/calcul-ore";
import { adaugaZile } from "@/domain/attendance/saptamana";
import { setariPontaj } from "@/lib/queries/attendance";
import { zileNelucratoare } from "@/lib/queries/leave";

import { tipZiAutomat } from "../etichete";
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
  optiuni: OptiuniScriere,
): Promise<RezultatScriere> {
  const { aprobare, rescrie, requestId } = optiuni;
  try {
    return await scrie(admin, organizationId, submissionId, employeeId, config, tipZiPentru, {
      aprobare,
      rescrie,
    });
  } catch (eroare) {
    console.error("[pontaj] săptămâna nu a putut fi scrisă în pontaj", {
      requestId,
      submissionId,
      employeeId,
      eroare,
    });
    return { scrise: 0, pastrate: 0 };
  }
}

export interface OptiuniScriere {
  /**
   * Cine a aprobat săptămâna și când — zilele sosesc APROBATE, cu el ca autor.
   * `null` când săptămâna s-a închis fără aprobator: firma nu cere aprobare,
   * sau nu exista niciun aprobator (`pas_fara_destinatar`, 0118).
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
  readonly aprobare: { readonly de: string; readonly la: string } | null;
  /** Varianta săptămânală (0165): rândurile `saptamana` ale săptămânii se rescriu. */
  readonly rescrie: boolean;
  readonly requestId: string;
}

async function scrie(
  admin: AdminSupabase,
  organizationId: string,
  submissionId: string,
  employeeId: string,
  config: ConfigZi,
  tipZiPentru: (data: string) => Database["public"]["Enums"]["attendance_day_type"],
  { aprobare, rescrie }: Pick<OptiuniScriere, "aprobare" | "rescrie">,
): Promise<RezultatScriere> {
  const { data: saptamana, error: eroareSaptamana } = await admin
    .from("attendance_week_submissions")
    .select("saptamana_start")
    .eq("organization_id", organizationId)
    .eq("id", submissionId)
    .maybeSingle();
  if (eroareSaptamana !== null) throw eroareSaptamana;
  if (saptamana === null) return { scrise: 0, pastrate: 0 };
  const zileleSaptamanii = Array.from({ length: 7 }, (_, i) =>
    adaugaZile(saptamana.saptamana_start, i),
  );

  /*
   * LUNA BLOCATĂ NU SE ATINGE.
   *
   * Triggerul care refuză luna blocată scutește contextul de serviciu
   * (`0132:146`), iar clientul de aici e cel admin — deci fără garda asta, o
   * retrimitere sau o aprobare întârziată ar fi rescris pontajul unei luni
   * deja închise pentru salarizare.
   */
  const luni = [...new Set(zileleSaptamanii.map((d) => d.slice(0, 7)))];
  const { data: perioade, error: eroarePerioade } = await admin
    .from("attendance_periods")
    .select("an, luna, status")
    .eq("organization_id", organizationId)
    .in(
      "an",
      luni.map((l) => Number(l.slice(0, 4))),
    )
    .is("deleted_at", null);
  if (eroarePerioade !== null) throw eroarePerioade;
  const blocate = new Set(
    (perioade ?? [])
      .filter((p) => p.status === "blocata")
      .map((p) => `${String(p.an)}-${String(p.luna).padStart(2, "0")}`),
  );
  const zileDeschise = zileleSaptamanii.filter((d) => !blocate.has(d.slice(0, 7)));
  if (zileDeschise.length === 0) return { scrise: 0, pastrate: 0 };

  /*
    Rândurile șterse logic pentru rescriere, ținute ca să poată fi PUSE LA LOC.

    Ștergerea și inserarea sunt două instrucțiuni, nu o tranzacție — clientul
    PostgREST nu le poate lega. Dacă inserarea cade după ștergere (o zi scrisă
    între timp din altă sesiune, un trigger care refuză), săptămâna ar rămâne
    fără pontaj, iar eroarea s-ar opri în jurnal. Inserarea unui tablou e ea
    însăși atomică — toate rândurile sau niciunul —, deci restaurarea de mai jos
    nu se poate ciocni cu o inserare pe jumătate.
  */
  let sterse: readonly string[] = [];
  if (rescrie) {
    const { data: atinse, error: eroareStergere } = await admin
      .from("attendance_entries")
      .update({ deleted_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .eq("employee_id", employeeId)
      .eq("sursa", "saptamana")
      .in("data", zileDeschise)
      .is("deleted_at", null)
      .select("id");
    if (eroareStergere !== null) throw eroareStergere;
    sterse = (atinse ?? []).map((r) => r.id);
  }

  const { data: zile, error: eroareZile } = await admin
    .from("attendance_week_submission_days")
    .select("data, ora_inceput, ora_sfarsit, tip_prezenta, observatii")
    .eq("organization_id", organizationId)
    .eq("submission_id", submissionId)
    .in("data", zileDeschise)
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
        approved_at: aprobare?.la ?? null,
        approved_by: aprobare?.de ?? null,
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
  if (eroareInserare !== null) {
    if (sterse.length > 0) {
      const { error: eroareRestaurare } = await admin
        .from("attendance_entries")
        .update({ deleted_at: null })
        .eq("organization_id", organizationId)
        .in("id", sterse);
      if (eroareRestaurare !== null) {
        console.error("[pontaj] rândurile săptămânii n-au putut fi puse la loc", {
          organizationId,
          employeeId,
          sterse,
          eroare: eroareRestaurare,
        });
      }
    }
    throw eroareInserare;
  }

  return { scrise: randuri.length, pastrate: deScris.length - randuri.length };
}

/**
 * Săptămâna dintr-o submisie devine pontaj — cu setările și calendarul ei.
 *
 * Doi apelanți: aprobarea (`decideSaptamanaPontaj`) și, în varianta
 * săptămânală fără aprobare, trimiterea (`trimiteSaptamanaPontaj`). Citirile
 * stau aici ca să nu fie scrise de două ori — o diferență între ele ar fi dat
 * altă normă sau alt tip de zi pentru aceeași săptămână, după drumul ales.
 *
 * NU aruncă, ca `scriePontajulSaptamanii`: decizia sau trimiterea e deja
 * înregistrată când se ajunge aici.
 */
export async function scrieSaptamanaInPontaj(
  admin: AdminSupabase,
  organizationId: string,
  submissionId: string,
  optiuni: OptiuniScriere,
): Promise<RezultatScriere> {
  try {
    const { data: saptamana, error } = await admin
      .from("attendance_week_submissions")
      .select("employee_id, saptamana_start")
      .eq("id", submissionId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (error !== null) throw error;
    if (saptamana === null) return { scrise: 0, pastrate: 0 };

    // Setările de la data SĂPTĂMÂNII, nu de azi: `attendance_settings` are
    // istoric (`valabil_de_la`), iar o normă schimbată între timp n-are voie
    // să rescrie orele unei săptămâni trecute.
    const an = Number(saptamana.saptamana_start.slice(0, 4));
    const [setari, nelucratoare] = await Promise.all([
      setariPontaj(organizationId, saptamana.saptamana_start),
      // Calendarul firmei, pentru tipul fiecărei zile — altfel o sâmbătă
      // lucrată ar intra ca zi obișnuită, fără sporul de repaus.
      zileNelucratoare(organizationId, an, an + 1),
    ]);
    const sarbatori = new Set(nelucratoare.nationale.map((z) => z.data));
    const recuperare = new Set(
      nelucratoare.organizatie.filter((z) => z.tip === "zi_recuperare").map((z) => z.data),
    );
    const liber = new Set(
      nelucratoare.organizatie.filter((z) => z.tip === "liber_suplimentar").map((z) => z.data),
    );

    return await scriePontajulSaptamanii(
      admin,
      organizationId,
      submissionId,
      saptamana.employee_id,
      configZiDin(setari),
      (data) => tipZiAutomat(data, sarbatori, recuperare, liber),
      optiuni,
    );
  } catch (eroare) {
    console.error("[pontaj] săptămâna nu a putut fi pregătită pentru pontaj", {
      requestId: optiuni.requestId,
      submissionId,
      eroare,
    });
    return { scrise: 0, pastrate: 0 };
  }
}
