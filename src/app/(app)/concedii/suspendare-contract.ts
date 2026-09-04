// src/app/(app)/concedii/suspendare-contract.ts
// Concediul aprobat care SUSPENDĂ contractul devine o suspendare declarată:
// un rând în `contract_suspendari` și cele două evenimente REGES care îl
// însoțesc — plecarea și întoarcerea.
//
// Extras din `decideCerere` din același motiv pentru care a plecat acolo și
// `sincronizeazaConcediulAprobat`: aprobarea are DOI apelanți (lanțul normal de
// aprobare și aprobarea pe loc a patronului), iar o a doua copie ar fi însemnat
// două locuri în care se poate uita declarația către Inspecția Muncii.
//
// ┌ De ce clientul ADMIN și nu al utilizatorului ─────────────────────────────
// │ `contract_suspendari_insert` cere `app.can(org, 'employees', 'update',
// │ 'all')`. Aprobatorul are `leave:approve` la scope `team` — un manager n-are
// │ `employees:update` deloc. Cu clientul lui, INSERT-ul ar cădea cu 42501 pe
// │ fiecare aprobare de concediu fără plată dată de un manager.
// │ Ocolirea e legală aici (`actions.ts` și fișierele lui, lista ESLint) și e
// │ îngustă: filtru explicit pe `organization_id` la fiecare interogare, iar
// │ organizația vine din `ctx.tenant`, niciodată de la client.
// └───────────────────────────────────────────────────────────────────────────
//
// ┌ De ce se generează AMÂNDOUĂ evenimentele acum ────────────────────────────
// │ Suspendarea are termen „cel târziu în ziua anterioară începerii"; reluarea
// │ are exact același termen, raportat la ziua întoarcerii. Cererea de concediu
// │ cunoaște de pe acum ambele date, deci amânarea celui de-al doilea eveniment
// │ n-ar aduce nicio informație în plus — ar muta doar responsabilitatea pe
// │ cineva care trebuie să-și amintească peste două luni. Un concediu scurtat
// │ sau anulat ulterior lasă un eveniment de reluare cu dată greșită, care se
// │ corectează prin `corectie`; un eveniment LIPSĂ nu se corectează, e amendă.
// └───────────────────────────────────────────────────────────────────────────
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { adaugaZileCalendaristice } from "@/domain/reges/evenimente";
import { genereazaEvenimenteReges } from "@/lib/reges/genereaza-evenimente";
import type { Database } from "@/types/database";

type AdminSupabase = SupabaseClient<Database>;

/**
 * Ce s-a întâmplat cu declarația de suspendare, pentru cel care a aprobat.
 *
 * `ceruta = false` e cazul obișnuit: majoritatea concediilor nu suspendă
 * contractul, deci nu e nimic de declarat și nimic de arătat pe ecran.
 */
export interface RezultatSuspendare {
  /** Tipul de concediu are `suspenda_contract` pornit. */
  readonly ceruta: boolean;
  /** Rândul de suspendare și evenimentele REGES au fost create. */
  readonly declarata: boolean;
  /** Termenul celui mai apropiat eveniment, ca `AAAA-LL-ZZ`. */
  readonly termen: string | null;
  /** De ce NU s-a declarat, în cuvintele omului care trebuie să repare. */
  readonly motiv: string | null;
}

const NIMIC_DE_DECLARAT: RezultatSuspendare = {
  ceruta: false,
  declarata: false,
  termen: null,
  motiv: null,
};

interface CerereDeSuspendat {
  readonly employee_id: string;
  readonly data_inceput: string;
  readonly data_sfarsit: string;
  readonly tip: {
    readonly denumire: string;
    readonly suspenda_contract: boolean;
    readonly temei_legal: string | null;
  } | null;
}

/**
 * Declară suspendarea contractului produsă de un concediu tocmai aprobat.
 *
 * NU aruncă niciodată. Aprobarea e deja dată când se ajunge aici, iar o
 * declarație eșuată nu e un motiv să o desfaci — motivul iese prin
 * `RezultatSuspendare.motiv` și ajunge pe ecranul aprobatorului, singurul om
 * care se uită și care poate repara. Aceeași alegere ca la generarea
 * evenimentului de angajare din `angajati/actions.ts`.
 */
export async function declaraSuspendareaContractului(
  admin: AdminSupabase,
  organizationId: string,
  cerereId: string,
  userId: string,
  requestId: string,
): Promise<RezultatSuspendare> {
  try {
    // (1) Tipul decide dacă există ceva de declarat. Embed-ul poate veni NULL
    // dacă tipul a fost șters logic între trimitere și aprobare — atunci nu
    // inventăm o obligație pe care n-o putem justifica.
    const { data: cerere, error: eroareCerere } = await admin
      .from("leave_requests")
      .select(
        "employee_id, data_inceput, data_sfarsit, " +
          "tip:leave_types!leave_requests_leave_type_id_fkey(denumire, suspenda_contract, temei_legal)",
      )
      .eq("id", cerereId)
      .eq("organization_id", organizationId)
      .single<CerereDeSuspendat>();
    if (eroareCerere !== null) throw eroareCerere;

    if (cerere.tip === null || !cerere.tip.suspenda_contract) return NIMIC_DE_DECLARAT;

    // (2) Contractul activ. Fără el nu există ce suspenda, iar REGES n-ar avea
    // ce identificator de contract să trimită. Nu e o eroare de sistem: e o
    // fișă incompletă, și se spune ca atare.
    const { data: contract, error: eroareContract } = await admin
      .from("employment_contracts")
      .select("id, data_contract")
      .eq("organization_id", organizationId)
      .eq("employee_id", cerere.employee_id)
      .eq("status", "activ")
      .is("deleted_at", null)
      .order("valabil_de_la", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (eroareContract !== null) throw eroareContract;
    if (contract === null) {
      return {
        ceruta: true,
        declarata: false,
        termen: null,
        motiv:
          `„${cerere.tip.denumire}" suspendă contractul de muncă și trebuie declarat în REGES, ` +
          "dar angajatul nu are niciun contract activ în aplicație. Completați contractul, apoi " +
          "înregistrați suspendarea din modulul REGES.",
      };
    }

    // (3) Rândul de suspendare. `reges_actiune_id` rămâne null — politica de
    // INSERT o cere explicit, iar identificatorul de acțiune REGES se
    // completează abia la transmitere, de reconciliere.
    const temeiLegal = cerere.tip.temei_legal ?? cerere.tip.denumire;
    const { error: eroareSuspendare } = await admin.from("contract_suspendari").insert({
      organization_id: organizationId,
      contract_id: contract.id,
      employee_id: cerere.employee_id,
      data_inceput: cerere.data_inceput,
      data_sfarsit: cerere.data_sfarsit,
      // Coloana acceptă cel mult 120 de caractere.
      temei_legal: temeiLegal.slice(0, 120),
      explicatie: `Generată automat din cererea de concediu „${cerere.tip.denumire}".`.slice(
        0,
        500,
      ),
      stare: "activa",
      sursa: "concediu",
      created_by: userId,
      updated_by: userId,
    });
    if (eroareSuspendare !== null) {
      // 23P01 = `contract_suspendari_fara_suprapunere`. Există deja o
      // suspendare activă peste perioada asta, deci obligația e cel mai
      // probabil acoperită — dar nu de noi, și nu putem afirma că e.
      if (eroareSuspendare.code === "23P01") {
        return {
          ceruta: true,
          declarata: false,
          termen: null,
          motiv:
            "Contractul are deja o suspendare activă care se suprapune peste perioada cererii. " +
            "Verificați în modulul REGES că perioada declarată acolo o acoperă pe aceasta.",
        };
      }
      throw eroareSuspendare;
    }

    // (4) Cele două evenimente. Reluarea cade în ziua de DUPĂ ultima zi de
    // concediu: `data_sfarsit` e ultima zi în care omul lipsește, nu prima în
    // care se întoarce.
    const ziReluarii = adaugaZileCalendaristice(cerere.data_sfarsit, 1);
    const rezultat = await genereazaEvenimenteReges({
      supabase: admin,
      organizationId,
      userId,
      evenimente: [
        {
          employeeId: cerere.employee_id,
          contractId: contract.id,
          tip: "suspendare",
          dataEvenimentului: cerere.data_inceput,
          valabilDeLa: cerere.data_inceput,
          dataContract: contract.data_contract,
          payload: { temei_legal: temeiLegal, tip_concediu: cerere.tip.denumire },
        },
        {
          employeeId: cerere.employee_id,
          contractId: contract.id,
          tip: "reluare_activitate",
          dataEvenimentului: ziReluarii,
          valabilDeLa: ziReluarii,
          dataContract: contract.data_contract,
          payload: { temei_legal: temeiLegal, tip_concediu: cerere.tip.denumire },
        },
      ],
    });

    // Un eveniment respins nu e o excepție: `calculeazaTermen` refuză când nu
    // găsește un termen configurat pentru tipul lui la data aceea. Rândul de
    // suspendare rămâne — el e adevărul intern; ce lipsește e declarația.
    if (rezultat.respinse.length > 0) {
      return {
        ceruta: true,
        declarata: false,
        termen: null,
        motiv:
          "Suspendarea a fost înregistrată, dar evenimentul REGES nu a putut fi pregătit: " +
          `${rezultat.respinse.map((r) => r.motiv).join(" ")}`,
      };
    }

    return {
      ceruta: true,
      declarata: true,
      // Termenul suspendării e cel mai apropiat dintre cele două, întotdeauna.
      termen: adaugaZileCalendaristice(cerere.data_inceput, -1),
      motiv: null,
    };
  } catch (eroare) {
    console.error("[concedii] declararea suspendării de contract a eșuat", {
      requestId,
      cerereId,
      eroare,
    });
    return {
      ceruta: true,
      declarata: false,
      termen: null,
      motiv:
        "Concediul suspendă contractul de muncă, dar declararea suspendării a eșuat. " +
        "Înregistrați-o manual din modulul REGES — termenul legal este ziua anterioară începerii.",
    };
  }
}
