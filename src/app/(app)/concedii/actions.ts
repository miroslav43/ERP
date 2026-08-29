// src/app/(app)/concedii/actions.ts
"use server";

import { z } from "zod";

import { createAction } from "@/lib/actions/create-action";
import { businessRule, invalidInput, notFound } from "@/lib/actions/errors";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { ActionContext } from "@/lib/actions/types";
import { numaraZileCerere, type PortiuneZi } from "@/domain/leave/zile-cerere";
import {
  verificaPlafonAnual,
  verificaSold,
  verificaSuprapunere,
  type IntervalConcediu,
} from "@/domain/leave/verificari";
import { formatAmount } from "@/lib/format/money";
import { zileNelucratoare } from "@/lib/queries/leave";
import {
  anuleazaCerereSchema,
  creeazaCerereSchema,
  decideCerereSchema,
  linkDocumentConcediuSchema,
  pregatesteIncarcareDocumentSchema,
  type StatusCerere,
} from "@/schemas/leave";
import {
  BUCKET_DOCUMENTE,
  construiesteCaleDocument,
  prefixCaleDocument,
} from "@/lib/documents/cale";
import {
  sincronizeazaZileleDeConcediu,
  type TipZiPontaj,
} from "@/app/(app)/pontaj/sincronizare-concediu";
import { traduEroare } from "./erori";

/**
 * Rutele de portal atinse de orice mișcare pe o cerere de concediu.
 *
 * Fără ele, angajatul depune cererea, se întoarce pe „Concediile mele" și nu o
 * vede. Nu e o eroare — e cache-ul de Router al lui Next, iar tăcerea lui e
 * exact felul în care defectul trece de review: pe server totul e corect.
 * `/portal` intră fiindcă pagina de start arată soldul și cererile în așteptare.
 */
const CAI_PORTAL_CONCEDII: readonly string[] = ["/portal", "/portal/concediile-mele"];

/**
 * Fișa pe care lucrează acțiunea: cea cerută explicit, sau a celui autentificat.
 *
 * Clientul ADMIN, nu cel al utilizatorului: rolul `employee` are
 * `employees:read = none`, deci nu-și poate citi nici propria fișă
 * (`employees_select`, 0005_hr_rls.sql). Filtrul pe organizație ȘI pe
 * utilizator e explicit — singurul lucru care ține locul lui RLS aici.
 */
async function fisaTinta(ctx: ActionContext, cerut: string | null): Promise<string> {
  if (ctx.scope !== "all" && cerut !== null) {
    throw businessRule("Nu aveți dreptul să lucrați pe cererea de concediu a altui angajat.");
  }
  if (cerut !== null) return cerut;

  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("employees")
    .select("id")
    .eq("organization_id", ctx.tenant.organizationId)
    .eq("user_id", ctx.user.id)
    .eq("is_primary", true)
    .is("deleted_at", null)
    .maybeSingle<{ id: string }>();
  if (error !== null) throw error;
  if (data === null) {
    throw businessRule(
      "Contul dvs. nu este legat de o fișă de angajat activă în această organizație. Contactați administratorul.",
    );
  }
  return data.id;
}

/**
 * Calea primită de la client NU se crede pe cuvânt.
 *
 * Poarta de Storage (`storage_objects_insert`) păzește SCRIEREA fișierului, nu
 * referința scrisă în rând: fără verificarea asta, o cerere fabricată ar putea
 * lega de concediul propriu un obiect urcat sub folderul altcuiva — și l-ar
 * face citibil prin ecranul cererii. Același tipar ca în `salveazaDovada`.
 */
function verificaCaleaDocumentului(
  organizationId: string,
  employeeId: string,
  cale: string | null,
): void {
  if (cale === null || cale.trim().length === 0) return;
  const prefix = prefixCaleDocument(organizationId, "leave", employeeId);
  if (!cale.startsWith(prefix)) {
    throw invalidInput("Documentul atașat nu aparține acestei cereri.", {
      atasament_path: ["Cale invalidă."],
    });
  }
}

function laDataUTC(valoare: string): Date {
  const parti = valoare.split("-");
  const an = Number(parti[0]);
  const luna = Number(parti[1]);
  const zi = Number(parti[2]);
  return new Date(Date.UTC(an, luna - 1, zi));
}

/** Ce trebuie știut despre o cerere ca să se poată decide dacă poate pleca. */
interface CerereDeVerificat {
  readonly employeeId: string;
  readonly tip: Readonly<{
    id: string;
    denumire: string;
    scade_din_sold: boolean;
    zile_implicite: number;
  }>;
  /** Plafonul legal EFECTIV — al variantei invocate, dacă există, altfel al tipului. */
  readonly plafonEfectiv: number | null;
  readonly denumirePlafon: string;
  readonly dataInceput: string;
  readonly dataSfarsit: string;
  readonly portiuneInceput: PortiuneZi;
  readonly portiuneSfarsit: PortiuneZi;
}

/**
 * Sold, plafon legal anual și suprapunere — verificările care se fac DOAR când
 * cererea chiar pleacă spre aprobare.
 *
 * Stau într-o funcție proprie fiindcă au acum DOI apelanți: crearea cu
 * `trimite: true` și `trimiteCerere`, care ridică o ciornă existentă. Scrise o
 * singură dată, în corpul creării, trimiterea unei ciorne ar fi fost un UPDATE
 * fără ele: baza ar fi respins suprapunerea abia pe constrângerea EXCLUDE
 * (23P01, mesaj de constrângere), iar depășirea de plafon n-ar fi fost prinsă
 * DELOC — plafonul se verifică în aplicație, nu în bază.
 *
 * O ciornă nu trece pe aici la salvare, deliberat: `leave_request_days` preia
 * statusul cererii, iar predicatul lui `recalc_sold` numără explicit doar
 * `trimisa` și `in_aprobare`. A bloca un draft ar fi o regulă inventată.
 */
async function verificaInainteDeTrimitere(
  ctx: ActionContext,
  cerere: CerereDeVerificat,
): Promise<void> {
  const an = Number(cerere.dataInceput.slice(0, 4));
  const { nationale, organizatie } = await zileNelucratoare(ctx.tenant.organizationId, an, an);
  const sarbatoriRo = nationale.map((z) => z.data);
  const liberSuplimentar = organizatie
    .filter((z) => z.tip === "liber_suplimentar")
    .map((z) => z.data);
  const zileRecuperare = organizatie.filter((z) => z.tip === "zi_recuperare").map((z) => z.data);

  const { zileLucratoare } = numaraZileCerere(
    cerere.dataInceput,
    cerere.dataSfarsit,
    cerere.portiuneInceput,
    cerere.portiuneSfarsit,
    sarbatoriRo,
    liberSuplimentar,
    zileRecuperare,
  );

  if (cerere.tip.scade_din_sold) {
    const { data: sold, error: eroareSold } = await ctx.supabase
      .from("leave_balances")
      .select("ramase")
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("employee_id", cerere.employeeId)
      .eq("leave_type_id", cerere.tip.id)
      .eq("an", an)
      .is("deleted_at", null)
      .maybeSingle();
    if (eroareSold !== null) throw eroareSold;
    // Fără rând de sold ⇒ dreptul e încă neatins anul acesta: disponibil = zile_implicite.
    const zileDisponibile = sold?.ramase ?? cerere.tip.zile_implicite;
    const verificare = verificaSold(zileLucratoare, zileDisponibile);
    if (!verificare.areSoldSuficient) {
      throw businessRule(
        `Soldul de „${cerere.tip.denumire}” pe anul ${String(an)} nu acoperă zilele solicitate: lipsesc ${formatAmount(verificare.zileLipsa)} zile. Reduceți perioada sau cereți ajustarea dreptului anual.`,
      );
    }
  }

  // Plafonul anual legal — verificat INDEPENDENT de sold (0064). Cele două
  // nu sunt același lucru: soldul e dreptul acumulat și reportabil (doar
  // odihna îl are), plafonul e maximul pe care legea îl acordă într-un an
  // (paternal 10 zile, îngrijitor 5, căsătorie 5…). Până la 0064, nouă
  // tipuri din zece nu aveau nicio limită.
  if (cerere.plafonEfectiv !== null) {
    const { data: cereriAnul, error: eroareCereriAnul } = await ctx.supabase
      .from("leave_requests")
      .select("zile_lucratoare")
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("employee_id", cerere.employeeId)
      .eq("leave_type_id", cerere.tip.id)
      .in("status", ["trimisa", "in_aprobare", "aprobata"])
      .gte("data_inceput", `${String(an)}-01-01`)
      .lte("data_inceput", `${String(an)}-12-31`)
      .is("deleted_at", null);
    if (eroareCereriAnul !== null) throw eroareCereriAnul;

    const zileConsumate = (cereriAnul ?? []).reduce((s, c) => s + c.zile_lucratoare, 0);
    const plafon = verificaPlafonAnual(zileLucratoare, zileConsumate, cerere.plafonEfectiv);
    if (!plafon.seIncadreaza) {
      throw businessRule(
        `„${cerere.denumirePlafon}” are un plafon legal de ${formatAmount(cerere.plafonEfectiv)} zile pe an, din care ${formatAmount(zileConsumate)} sunt deja folosite în ${String(an)}. Cererea îl depășește cu ${formatAmount(plafon.zileDepasire)} zile.`,
      );
    }
  }

  const { data: existente, error: eroareExistente } = await ctx.supabase
    .from("leave_requests")
    .select("data_inceput, data_sfarsit")
    .eq("organization_id", ctx.tenant.organizationId)
    .eq("employee_id", cerere.employeeId)
    .in("status", ["trimisa", "in_aprobare", "aprobata"])
    .is("deleted_at", null);
  if (eroareExistente !== null) throw eroareExistente;

  const cerereNoua: IntervalConcediu = {
    dataInceput: laDataUTC(cerere.dataInceput),
    dataSfarsit: laDataUTC(cerere.dataSfarsit),
  };
  const intervale: readonly IntervalConcediu[] = (existente ?? []).map((r) => ({
    dataInceput: laDataUTC(r.data_inceput),
    dataSfarsit: laDataUTC(r.data_sfarsit),
  }));
  if (verificaSuprapunere(cerereNoua, intervale)) {
    throw businessRule(
      "Aveți deja o cerere de concediu care acoperă o parte din perioada aleasă. Anulați-o sau alegeți alte date.",
    );
  }
}

export const creeazaCerereConcediu = createAction({
  name: "leave.request.create",
  feature: "leave",
  permission: "leave:create",
  minScope: "own",
  input: creeazaCerereSchema,
  audit: {
    action: "create",
    entityType: "leave_request",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    // „motiv”, seria și numărul certificatului NU intră aici (0017/I5): sunt
    // date de sănătate (art. 9 GDPR) și nu se scriu în jurnalul de audit.
    allow: [
      "employee_id",
      "leave_type_id",
      "data_inceput",
      "data_sfarsit",
      "portiune_inceput",
      "portiune_sfarsit",
      "trimite",
      "leave_variant_id",
      // `medical_code_id` NU intră aici, deliberat. Codul de indemnizație
      // clasifică boala („09 Neoplazii, SIDA”, „10 Tuberculoză”) — e dată
      // privind sănătatea, categorie specială art. 9 GDPR. Tabela însăși e
      // proiectată să n-o conțină („FĂRĂ diagnostic”, 0009:362), iar jurnalul de
      // audit e citibil de oricine are `audit:read`. Nu-l adăuga.
    ],
  },
  revalidate: ["/concedii", "/concedii/sold", ...CAI_PORTAL_CONCEDII],
  handler: async (ctx, input): Promise<Readonly<{ id: string; zileLucratoare: number }>> => {
    // ── (1) Angajatul țintă ────────────────────────────────────────────────
    // Rolul `employee` are `leave:create = own`: nu poate crea decât pentru
    // sine, chiar dacă a trimis explicit un `employee_id` străin. Cu scope
    // „all” (org_admin/hr), un `employee_id` explicit e permis — RLS și
    // triggerul BEFORE validează oricum apartenența la organizație.
    if (ctx.scope !== "all" && input.employee_id !== null) {
      throw businessRule("Nu aveți dreptul să creați o cerere de concediu pentru alt angajat.");
    }

    let employeeId = input.employee_id;
    if (employeeId === null) {
      // Fișa proprie via clientul admin: rolul `employee` are
      // `employees:read = none`, deci clientul autentificat al utilizatorului
      // NU poate citi nici măcar propria fișă (0005_hr_rls.sql,
      // `employees_select`). Filtru explicit pe organizație + utilizator.
      const admin = createAdminSupabase();
      const { data: fisa, error: eroareFisa } = await admin
        .from("employees")
        .select("id")
        .eq("organization_id", ctx.tenant.organizationId)
        .eq("user_id", ctx.user.id)
        .eq("is_primary", true)
        .is("deleted_at", null)
        .maybeSingle();
      if (eroareFisa !== null) throw eroareFisa;
      if (fisa === null) {
        throw businessRule(
          "Contul dvs. nu este legat de o fișă de angajat activă în această organizație. Contactați administratorul.",
        );
      }
      employeeId = fisa.id;
    }

    // Documentul urcat înaintea cererii trebuie să stea în dosarul ACESTUI
    // angajat. Poarta de Storage a păzit scrierea fișierului, nu referința.
    verificaCaleaDocumentului(ctx.tenant.organizationId, employeeId, input.atasament_path);

    // ── (2) Tipul de concediu ───────────────────────────────────────────────
    const { data: tip, error: eroareTip } = await ctx.supabase
      .from("leave_types")
      .select("id, key, denumire, scade_din_sold, zile_implicite, plafon_anual_zile")
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("id", input.leave_type_id)
      .eq("activ", true)
      .is("deleted_at", null)
      .maybeSingle();
    if (eroareTip !== null) throw eroareTip;
    if (tip === null) {
      throw businessRule("Tipul de concediu selectat nu există sau a fost dezactivat.");
    }

    // Varianta legală invocată (0070). Ea îi schimbă PLAFONUL: „paternal, cu
    // atestat de puericultură" are 15 zile, nu 10. Verificarea că varianta
    // aparține tipului ales nu e formalitate — altfel s-ar putea invoca
    // varianta de 1095 de zile a creșterii copilului pentru un concediu de
    // căsătorie.
    let plafonEfectiv = tip.plafon_anual_zile;
    let denumirePlafon = tip.denumire;
    if (input.leave_variant_id !== null) {
      const { data: varianta, error: eroareVarianta } = await ctx.supabase
        .from("leave_type_variants")
        .select("id, leave_type_key, denumire, zile")
        .eq("id", input.leave_variant_id)
        .eq("activ", true)
        .is("deleted_at", null)
        .maybeSingle<{ id: string; leave_type_key: string; denumire: string; zile: number }>();
      if (eroareVarianta !== null) throw eroareVarianta;
      if (varianta === null) {
        throw businessRule("Varianta de concediu selectată nu există sau a fost dezactivată.");
      }
      if (varianta.leave_type_key !== tip.key) {
        throw businessRule(`Varianta „${varianta.denumire}" nu aparține tipului de concediu ales.`);
      }
      plafonEfectiv = varianta.zile;
      denumirePlafon = varianta.denumire;
    }

    // Certificatul e obligatoriu DOAR pentru concediul medical, iar schema Zod
    // nu poate ști asta: ea vede un `leave_type_id`, nu cheia lui. Verificarea
    // stă aici, singurul loc care a citit deja `leave_types.key`.
    //
    // Fără cod de indemnizație, `certificateMedicaleLuna` (queries/payroll.ts:988)
    // nu vede cererea, iar `indemnizatie_cm_angajator` rămâne 0 — angajatul ar
    // avea concediu medical aprobat și zero lei indemnizație, fără nicio eroare.
    if (tip.key === "medical" && input.medical_code_id === null) {
      throw businessRule(
        "Concediul medical are nevoie de codul de indemnizație de pe certificat — fără el indemnizația nu se poate calcula.",
      );
    }
    if (tip.key !== "medical" && input.medical_code_id !== null) {
      throw businessRule("Certificatul medical se atașează doar unei cereri de concediu medical.");
    }

    // ── (3)-(5) Pre-verificarea sold + suprapunere ──────────────────────────
    // DOAR la trimitere reală (`trimite = true`): un „ciorna” nu intră în
    // `in_asteptare` (leave_request_days ia statusul cererii) și nu e supus
    // nici constrângerii EXCLUDE, nici verificării de sold din `recalc_sold`
    // — predicatul ei filtrează explicit `status in ('trimisa','in_aprobare')`.
    // Blocarea unui simplu draft ar fi o regulă inventată, nu una din bază.
    if (input.trimite) {
      await verificaInainteDeTrimitere(ctx, {
        employeeId,
        tip,
        plafonEfectiv,
        denumirePlafon,
        dataInceput: input.data_inceput,
        dataSfarsit: input.data_sfarsit,
        portiuneInceput: input.portiune_inceput,
        portiuneSfarsit: input.portiune_sfarsit,
      });
    }

    // ── (6)-(7) Inserarea ────────────────────────────────────────────────────
    // NU se trimit zile_lucratoare/zile_calendaristice/intrerupe_alte_concedii/
    // trimisa_la/decis_la — `internal.leave_requests_pregateste` (BEFORE) le
    // rescrie. `created_by` e obligatoriu explicit: leave_requests NU are
    // trigger `set_actor`, iar politica INSERT cere `created_by = auth.uid()`.
    const { data, error } = await ctx.supabase
      .from("leave_requests")
      .insert({
        organization_id: ctx.tenant.organizationId,
        employee_id: employeeId,
        leave_type_id: input.leave_type_id,
        data_inceput: input.data_inceput,
        data_sfarsit: input.data_sfarsit,
        portiune_inceput: input.portiune_inceput,
        portiune_sfarsit: input.portiune_sfarsit,
        motiv: input.motiv,
        atasament_path: input.atasament_path,
        leave_variant_id: input.leave_variant_id,
        medical_code_id: input.medical_code_id,
        serie_certificat: input.serie_certificat,
        numar_certificat: input.numar_certificat,
        status: input.trimite ? "trimisa" : "ciorna",
        created_by: ctx.user.id,
      })
      .select("id, zile_lucratoare")
      .single();
    if (error !== null) throw traduEroare(error);

    return { id: data.id, zileLucratoare: data.zile_lucratoare };
  },
});

export const anuleazaCerere = createAction({
  name: "leave.request.cancel",
  feature: "leave",
  permission: "leave:update",
  minScope: "own",
  input: anuleazaCerereSchema,
  audit: {
    action: "update",
    entityType: "leave_request",
    entityId: (input) => input.id,
    allow: ["id"],
  },
  // `/concedii/aprobari` și `/pontaj`: de la 0079 încoace anularea poate porni
  // dintr-un concediu APROBAT, deci scoate cererea din lista de aprobări și
  // retrage zilele deja scrise în pontaj (triggerul
  // `trg_zleave_requests_retrage_pontajul`). Fără ele, ambele ecrane arată
  // starea de dinainte până la următoarea navigare completă — tăcut, ca la
  // rutele de portal de mai sus. `/concedii/calendar` și `/concedii/echipa` din
  // același motiv: zilele dispar din grilă.
  revalidate: (input) => [
    "/concedii",
    "/concedii/sold",
    "/concedii/aprobari",
    "/concedii/calendar",
    "/concedii/echipa",
    "/pontaj",
    ...CAI_PORTAL_CONCEDII,
    `/portal/concediile-mele/${input.id}`,
  ],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    // Politica `leave_requests_update` (0009) acceptă rândul și prin
    // `app.is_manager_of(organization_id, employee_id)`, INDEPENDENT de scope.
    // De când managerul are `leave:update = own` (0064), RLS singură l-ar lăsa
    // să anuleze cererea unui subaltern — adică să ocolească respingerea, care
    // cere motiv obligatoriu și lasă urmă în lanțul de aprobare. Cine nu are
    // scope „all” anulează DOAR pe fișa proprie.
    //
    // Fișa proprie se rezolvă ACUM ÎNTOTDEAUNA, nu doar sub scope restrâns: de
    // la 0073 încoace ea decide și dacă un concediu APROBAT poate pleca (vezi
    // mai jos). Cu scope „all” lipsa ei nu e o eroare — un `super_admin` sau un
    // `org_admin` fără fișă de angajat rămâne cu drepturile de dinainte.
    //
    // Via clientul admin, din același motiv ca la creare: rolul `employee` are
    // `employees:read = own` și oricum nu vede fișa altcuiva, dar citirea prin
    // RLS ar depinde de un scope pe care nu-l putem presupune. Filtru explicit
    // pe organizație + utilizator.
    const admin = createAdminSupabase();
    const { data: fisa, error: eroareFisa } = await admin
      .from("employees")
      .select("id")
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("user_id", ctx.user.id)
      .eq("is_primary", true)
      .is("deleted_at", null)
      .maybeSingle();
    if (eroareFisa !== null) throw eroareFisa;
    if (fisa === null && ctx.scope !== "all") {
      throw businessRule(
        "Contul dvs. nu este legat de o fișă de angajat activă în această organizație. Contactați administratorul.",
      );
    }
    const fisaProprie: string | null = fisa?.id ?? null;
    const doarFisaMea: string | null = ctx.scope === "all" ? null : fisaProprie;

    // Cererea, citită PRIN RLS: dacă nu o vede, nu o poate anula. Serveşte o
    // singură decizie — dacă e a lui sau a altcuiva — fiindcă de ea depinde
    // lista de statusuri permise mai jos. Regulile propriu-zise rămân în bază.
    const { data: cerereTinta, error: eroareTinta } = await ctx.supabase
      .from("leave_requests")
      .select("employee_id, status")
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .maybeSingle<{ readonly employee_id: string; readonly status: StatusCerere }>();
    if (eroareTinta !== null) throw traduEroare(eroareTinta);
    if (cerereTinta === null) throw notFound("Cererea de concediu nu a fost găsită.");

    const esteAMea = fisaProprie !== null && cerereTinta.employee_id === fisaProprie;

    // Retragerea unui concediu APROBAT e dreptul angajatului asupra propriului
    // concediu, nu o unealtă administrativă. `hr` și `org_admin` au
    // `leave:update = all`, deci fără distincția asta ar fi primit tăcut, pe
    // aceeași acțiune, puterea de a anula concediul aprobat al oricui — cu
    // zilele întoarse în sold și pontajul retras, peste capul aprobatorului și
    // fără motiv scris nicăieri. Pe cererea PROPRIE o au ca oricine altcineva.
    const statusuriPermise: readonly StatusCerere[] = esteAMea
      ? ["ciorna", "trimisa", "aprobata"]
      : ["ciorna", "trimisa"];

    if (cerereTinta.status === "aprobata" && !esteAMea) {
      throw businessRule(
        "Un concediu deja aprobat poate fi retras doar de angajatul căruia îi aparține. Pentru o corecție administrativă, ajustați cererea din fișa angajatului.",
      );
    }

    // `.select("id")` stă în ACELAȘI lanț cu `.update()`, înaintea filtrului
    // condiționat: e o tranziție de status, iar capcana 17 cere ca rezultatul
    // gol să se poată deosebi de succes. Filtrele se pot aplica și după
    // `.select()` — ordinea lor nu contează pentru PostgREST.
    //
    // `aprobata` intră în listă doar pentru cererea proprie. FEREASTRA — „numai
    // înainte de prima zi” — NU se verifică aici: o ține
    // `internal.leave_requests_anulare_de_autor` (0079), care compară cu
    // `old.data_inceput` și răspunde cu P0001 și cu data în clar. Dublată în
    // TypeScript ar fi a doua sursă de adevăr pentru „azi”: aici e fusul
    // procesului Node, acolo `Europe/Bucharest` — iar cele două se despart
    // exact în noaptea în care contează.
    let interogare = ctx.supabase
      .from("leave_requests")
      .update({ status: "anulata" })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .in("status", statusuriPermise)
      .select("id");
    if (doarFisaMea !== null) interogare = interogare.eq("employee_id", doarFisaMea);

    const { data, error } = await interogare.maybeSingle();
    if (error !== null) throw traduEroare(error);
    if (data === null) {
      throw businessRule(
        "Cererea nu poate fi anulată: fie nu a fost găsită, fie nu vă aparține, fie a fost deja respinsă, anulată sau întreruptă.",
      );
    }
    return { id: data.id };
  },
});

/**
 * Schema stă AICI, nelocală lui `src/schemas/leave.ts`, dintr-un motiv mecanic:
 * un fișier `"use server"` poate exporta doar funcții async — o constantă
 * exportată face Next să refuze build-ul, iar `tsc` tace. Neexportată, e legală.
 */
const trimiteCerereSchema = z.object({
  id: z.uuid("Cererea selectată nu este validă."),
});

/**
 * Ridică o CIORNĂ existentă la „trimisă”.
 *
 * ── DE CE EXISTĂ ──────────────────────────────────────────────────────────
 * Formularul de cerere avea de la început două butoane — „Salvează ca ciornă”
 * și „Trimite spre aprobare” — dar modulul avea exact trei acțiuni
 * (`creeazaCerereConcediu`, `anuleazaCerere`, `decideCerere`) și niciuna nu
 * trimitea o ciornă deja salvată. Cine apăsa primul buton ajungea pe fișa
 * cererii, unde singurul buton oferit era „Anulează cererea”: o funcție
 * întreagă a produsului se putea începe și nu se putea termina niciodată.
 * Ieșirea era să anulezi și să reintroduci totul de la zero.
 *
 * ── BAZA O PERMITEA DEJA ──────────────────────────────────────────────────
 * Nu e nevoie de nicio migrare. `leave_requests_update` (0016:384) are ramura
 * autorului cu `status in ('ciorna','trimisa')` în `USING` și
 * `status in ('ciorna','trimisa','anulata')` în `WITH CHECK`, iar
 * `internal.leave_requests_sincronizeaza` (0009:713) generează lanțul de
 * aprobare pe condiția `new.status = 'trimisa' and old.status is distinct from
 * 'trimisa'` — scrisă din capul locului pentru UPDATE, nu doar pentru INSERT.
 * Ce lipsea era exclusiv drumul dinspre ecran.
 */
export const trimiteCerere = createAction({
  name: "leave.request.submit",
  feature: "leave",
  permission: "leave:update",
  minScope: "own",
  input: trimiteCerereSchema,
  audit: {
    action: "update",
    entityType: "leave_request",
    entityId: (input) => input.id,
    allow: ["id"],
  },
  revalidate: (input) => [
    "/concedii",
    "/concedii/sold",
    "/concedii/aprobari",
    ...CAI_PORTAL_CONCEDII,
    `/portal/concediile-mele/${input.id}`,
  ],
  handler: async (ctx, input): Promise<Readonly<{ id: string; zileLucratoare: number }>> => {
    const { data: cerere, error: eroareCerere } = await ctx.supabase
      .from("leave_requests")
      .select(
        "id, employee_id, leave_type_id, leave_variant_id, data_inceput, data_sfarsit, portiune_inceput, portiune_sfarsit, status",
      )
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (eroareCerere !== null) throw eroareCerere;
    if (cerere === null) {
      throw notFound("Cererea de concediu nu a fost găsită.");
    }
    if (cerere.status !== "ciorna") {
      throw businessRule(
        "Doar o ciornă se poate trimite spre aprobare; cererea aceasta a plecat deja. Reîncărcați pagina ca să vedeți starea curentă.",
      );
    }

    const { data: tip, error: eroareTip } = await ctx.supabase
      .from("leave_types")
      .select("id, denumire, scade_din_sold, zile_implicite, plafon_anual_zile")
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("id", cerere.leave_type_id)
      .eq("activ", true)
      .is("deleted_at", null)
      .maybeSingle();
    if (eroareTip !== null) throw eroareTip;
    if (tip === null) {
      throw businessRule(
        "Tipul de concediu al acestei ciorne a fost între timp dezactivat. Anulați ciorna și depuneți o cerere nouă.",
      );
    }

    // Varianta legală schimbă PLAFONUL, nu tipul: „paternal, cu atestat de
    // puericultură” are 15 zile, nu 10. Ciorna o poartă de la creare, deci se
    // recitește aici — altfel trimiterea ar verifica alt plafon decât cel ales.
    //
    // O variantă dezactivată între timp NU blochează trimiterea, ci face cererea
    // să cadă pe plafonul de bază al tipului. Direcția contează: plafonul de
    // bază e cel mai mic dintre cele două (10 față de 15 la paternal), deci
    // căderea STRÂNGE verificarea. A refuza trimiterea ar fi construit exact
    // fundătura pe care acțiunea asta o închide.
    let plafonEfectiv: number | null = tip.plafon_anual_zile;
    let denumirePlafon = tip.denumire;
    if (cerere.leave_variant_id !== null) {
      const { data: varianta, error: eroareVarianta } = await ctx.supabase
        .from("leave_type_variants")
        .select("denumire, zile")
        .eq("id", cerere.leave_variant_id)
        .eq("activ", true)
        .is("deleted_at", null)
        .maybeSingle<{ denumire: string; zile: number }>();
      if (eroareVarianta !== null) throw eroareVarianta;
      if (varianta !== null) {
        plafonEfectiv = varianta.zile;
        denumirePlafon = varianta.denumire;
      }
    }

    await verificaInainteDeTrimitere(ctx, {
      employeeId: cerere.employee_id,
      tip,
      plafonEfectiv,
      denumirePlafon,
      dataInceput: cerere.data_inceput,
      dataSfarsit: cerere.data_sfarsit,
      portiuneInceput: cerere.portiune_inceput,
      portiuneSfarsit: cerere.portiune_sfarsit,
    });

    // `.eq("status", "ciorna")` NU e redundant cu verificarea de mai sus: între
    // citire și scriere încape o a doua filă de browser. Iar `.select()` e
    // obligatoriu — un UPDATE respins de `USING` afectează ZERO rânduri FĂRĂ
    // eroare (capcana 17), deci fără el ecranul ar anunța o trimitere care nu
    // s-a produs, iar cererea ar rămâne ciornă la nesfârșit.
    const { data, error } = await ctx.supabase
      .from("leave_requests")
      .update({ status: "trimisa" })
      .eq("id", cerere.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("status", "ciorna")
      .select("id, zile_lucratoare")
      .maybeSingle();
    if (error !== null) throw traduEroare(error);
    if (data === null) {
      throw businessRule(
        "Cererea nu a putut fi trimisă spre aprobare: fie și-a schimbat starea între timp, fie nu aveți dreptul să o modificați. Reîncărcați pagina.",
      );
    }

    return { id: data.id, zileLucratoare: data.zile_lucratoare };
  },
});

export const decideCerere = createAction({
  name: "leave.request.decide",
  feature: "leave",
  permission: "leave:approve",
  minScope: "team",
  input: decideCerereSchema,
  audit: {
    action: "update",
    entityType: "leave_request",
    entityId: (input) => input.taskId,
    allow: ["taskId", "decizie", "comentariu", "motivRespingere"],
  },
  // Al doilea argument, nu primul: intrarea poartă `taskId` (sarcina de
  // aprobare), iar calea de portal are nevoie de identificatorul CERERII, pe
  // care handlerul îl întoarce.
  // Tipul se scrie explicit: `revalidate` e declarat ÎNAINTEA lui `handler` în
  // obiectul literal, deci TypeScript n-are încă de unde infera forma datelor.
  revalidate: (_input, data: Readonly<{ id: string; zilePastrate: number }>) => [
    "/concedii",
    "/concedii/aprobari",
    "/concedii/sold",
    ...CAI_PORTAL_CONCEDII,
    `/portal/concediile-mele/${data.id}`,
    // Decizia sincronizează zilele în pontaj (v. handler): fără calea asta,
    // angajatul vede concediul aprobat și pontajul nemodificat.
    "/portal/pontajul-meu",
  ],
  handler: async (ctx, input): Promise<Readonly<{ id: string; zilePastrate: number }>> => {
    // (1) Sarcina, cu clientul utilizatorului: `approval_tasks_select` arată
    // doar sarcinile proprii (sau `leave:approve = all`), deci un aprobator
    // nu poate decide o sarcină care nu e a lui — RLS o ascunde, nu o refuză.
    const { data: sarcina, error: eroareSarcina } = await ctx.supabase
      .from("approval_tasks")
      .select("id, entity_id")
      .eq("id", input.taskId)
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("entity_type", "leave_request")
      .eq("status", "in_asteptare")
      .is("deleted_at", null)
      .maybeSingle();
    if (eroareSarcina !== null) throw eroareSarcina;
    if (sarcina === null) {
      throw notFound("Sarcina de aprobare nu a fost găsită sau a fost deja rezolvată.");
    }

    // (2) `leave_requests_update` compară, pe toate ramurile WITH CHECK, cu
    // `app.current_employee_id(organization_id)`. Fără fișă principală de
    // angajat, funcția întoarce NULL, toate ramurile pică și update-ul cade
    // cu 42501 — un defect de schemă (merită migrare 0021, în afara sarcinii
    // agenților). Pre-verificăm cu clientul admin, cu filtru explicit pe
    // organizație, ca să dăm un mesaj clar în loc de „interzis” opac.
    const admin = createAdminSupabase();
    const { data: fisaAprobator, error: eroareFisa } = await admin
      .from("employees")
      .select("id")
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("user_id", ctx.user.id)
      .eq("is_primary", true)
      .is("deleted_at", null)
      .maybeSingle();
    if (eroareFisa !== null) throw eroareFisa;
    if (fisaAprobator === null) {
      throw businessRule(
        "Contul dvs. nu este legat de o fișă de angajat principală în această organizație, așa că baza de date nu vă poate identifica drept aprobator. Contactați administratorul.",
      );
    }

    // (3) `internal.approval_tasks_imutabile` permite EXACT status/comentariu/
    // decis_la/deleted_at/updated_at — nimic altceva se trimite aici.
    // `trg_approval_tasks_anuleaza_surori` anulează singur, în bază, sarcinile
    // de la ACEEAȘI ordine (aprobatori în paralel pe același pas).
    const acum = ctx.now.toISOString();
    // `.select()` obligatoriu pe tranziție: politica `approval_tasks_update`
    // cere ca aprobatorul să fie chiar destinatarul sarcinii. Respinsă de
    // `USING`, operația afectează ZERO rânduri FĂRĂ eroare (capcana 17) —
    // aprobatorul ar vedea „decizie înregistrată", iar cererea ar rămâne în
    // așteptare la nesfârșit.
    const { data: sarcinaDecisa, error: eroareUpdateSarcina } = await ctx.supabase
      .from("approval_tasks")
      .update({ status: input.decizie, comentariu: input.comentariu, decis_la: acum })
      .eq("id", sarcina.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (eroareUpdateSarcina !== null) throw traduEroare(eroareUpdateSarcina);
    if (sarcinaDecisa === null) {
      throw businessRule("Sarcina de aprobare nu v-a putut fi atribuită. Reîncărcați lista.");
    }

    // Câte zile pontate de angajat s-au suprapus peste concediu și au fost
    // PĂSTRATE ca zile lucrate. Declarată la nivelul handlerului fiindcă
    // rezultatul trebuie să ajungă la aprobator și când sincronizarea (care e
    // best-effort, într-un `try`) cade pe drum.
    let zilePastrate = 0;

    // (4) Un manager cu `leave:approve = team` nu vede, prin RLS, sarcinile
    // colegilor din pașii următori — numărătoarea se face cu clientul admin,
    // filtrată explicit pe organizație + entitate.
    const { count, error: eroareNumarare } = await admin
      .from("approval_tasks")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("entity_type", "leave_request")
      .eq("entity_id", sarcina.entity_id)
      .eq("status", "in_asteptare")
      .is("deleted_at", null);
    if (eroareNumarare !== null) throw eroareNumarare;

    // (5) Respins ⇒ cererea trece pe „respinsă” și sarcinile rămase se anulează.
    // Aprobat + 0 rămase ⇒ cererea trece pe „aprobată”. Aprobat + rămase > 0 ⇒
    // cererea NU se atinge: rămâne „trimisă”, angajatul păstrează dreptul de
    // anulare, iar `recalc_sold` numără la fel `trimisa` și `in_aprobare`.
    if (input.decizie === "respinsa") {
      const { data: cerereRespinsa, error: eroareRespingere } = await ctx.supabase
        .from("leave_requests")
        .update({
          status: "respinsa",
          motiv_respingere: input.motivRespingere,
          decis_de: ctx.user.id,
        })
        .eq("id", sarcina.entity_id)
        .eq("organization_id", ctx.tenant.organizationId)
        .select("id")
        .maybeSingle();
      if (eroareRespingere !== null) throw traduEroare(eroareRespingere);
      if (cerereRespinsa === null) {
        throw businessRule(
          "Sarcina a fost decisă, dar cererea de concediu nu a trecut pe „respinsă”.",
        );
      }

      // Măturarea rămâne tăcută intenționat: rulează cu clientul admin, deci
      // RLS n-o poate refuza, iar zero rânduri e cazul NORMAL — sarcinile
      // surori de la aceeași ordine au fost deja anulate de
      // `trg_approval_tasks_anuleaza_surori`, iar pașii următori pot lipsi cu
      // totul. Aici tăcerea înseamnă „nu mai era nimic de anulat”, nu „refuzat”.
      const { error: eroareAnulare } = await admin
        .from("approval_tasks")
        .update({ status: "anulata", decis_la: acum })
        .eq("organization_id", ctx.tenant.organizationId)
        .eq("entity_type", "leave_request")
        .eq("entity_id", sarcina.entity_id)
        .eq("status", "in_asteptare")
        .is("deleted_at", null);
      if (eroareAnulare !== null) throw eroareAnulare;
    } else if ((count ?? 0) === 0) {
      // Cea mai scumpă dintre cele trei: fără verificare, cererea rămâne
      // „trimisă", soldul nu se scade, sincronizarea cu pontajul de mai jos
      // rulează pentru un concediu neaprobat, iar angajatul pleacă.
      const { data: cerereAprobata, error: eroareAprobare } = await ctx.supabase
        .from("leave_requests")
        .update({ status: "aprobata", decis_de: ctx.user.id })
        .eq("id", sarcina.entity_id)
        .eq("organization_id", ctx.tenant.organizationId)
        .select("id")
        .maybeSingle();
      if (eroareAprobare !== null) throw traduEroare(eroareAprobare);
      if (cerereAprobata === null) {
        throw businessRule(
          "Sarcina a fost decisă, dar cererea de concediu nu a trecut pe „aprobată”.",
        );
      }

      // (6) Pontajul reflectă concediul de îndată ce cererea e aprobată — nu
      // mai așteaptă butonul manual „Sincronizează” din /pontaj/aprobare.
      // Best-effort, cu clientul admin (aprobatorul nu are neapărat
      // `attendance:create`): un eșec aici (ex. luna nu are încă o perioadă
      // de pontaj deschisă) nu trebuie să anuleze aprobarea concediului.
      try {
        // `tip_zi_pontaj` decide dacă zilele astea se plătesc sau nu (0064).
        // Embed-ul poate veni NULL dacă tipul a fost șters logic între timp —
        // atunci cade pe „concediu", comportamentul de dinainte de 0064.
        const { data: cerere, error: eroareCerere } = await admin
          .from("leave_requests")
          .select("employee_id, tip:leave_types!leave_requests_leave_type_id_fkey(tip_zi_pontaj)")
          .eq("id", sarcina.entity_id)
          .eq("organization_id", ctx.tenant.organizationId)
          .single<{
            readonly employee_id: string;
            readonly tip: { readonly tip_zi_pontaj: TipZiPontaj } | null;
          }>();
        if (eroareCerere !== null) throw eroareCerere;
        const tipZi: TipZiPontaj = cerere.tip?.tip_zi_pontaj ?? "concediu";

        // Contul angajatului, pentru notificare. Poate lipsi: o fișă există și
        // fără cont (`invitations.email` e obligatoriu, deci angajatul fără
        // adresă de e-mail n-a putut fi invitat încă). Atunci se sare peste
        // notificare — numărul ajunge oricum la aprobator.
        const { data: angajat, error: eroareAngajat } = await admin
          .from("employees")
          .select("user_id")
          .eq("id", cerere.employee_id)
          .eq("organization_id", ctx.tenant.organizationId)
          .maybeSingle();
        if (eroareAngajat !== null) throw eroareAngajat;
        const userAngajat = angajat?.user_id ?? null;

        const { data: zileCerere, error: eroareZile } = await admin
          .from("leave_request_days")
          .select("data, leave_request_id")
          .eq("organization_id", ctx.tenant.organizationId)
          .eq("leave_request_id", sarcina.entity_id)
          .eq("este_lucratoare", true);
        if (eroareZile !== null) throw eroareZile;

        const zile = (zileCerere ?? []).map((z) => ({
          employee_id: cerere.employee_id,
          data: z.data,
          leave_request_id: z.leave_request_id,
          tip_zi: tipZi,
        }));
        const sincronizare = await sincronizeazaZileleDeConcediu(
          admin,
          ctx.tenant.organizationId,
          zile,
        );

        /*
         * DUBLA PLATĂ, SCOASĂ LA SUPRAFAȚĂ.
         *
         * `sincronizeazaZileleDeConcediu` sare peste orice zi a cărei `sursa` NU
         * e `sincronizare_concedii` — adică peste zilele pe care angajatul le-a
         * pontat el însuși — și le numără în `pastrate`. Numărul ăla era
         * ARUNCAT aici, iar consecința era tăcută în ambele capete: ziua rămâne
         * „lucrătoare, 8 ore" ȘI se scade o zi din soldul de concediu.
         * Salarizarea agregă `ore_lucrate` fără să se plângă, deci ziua se
         * plătește de două ori.
         *
         * Era rar cât timp angajații pontau greu. Pontarea dintr-o atingere
         * (0096) face cazul frecvent — de aceea reparația vine în ACEEAȘI
         * livrare cu butonul, nu după.
         *
         * NU se suprascrie ziua pontată: dacă omul chiar a muncit atunci,
         * ștergerea declarației lui ar distruge singura dovadă. Se raportează
         * aprobatorului și se anunță angajatul; decizia rămâne a oamenilor.
         */
        zilePastrate = sincronizare.pastrate;
        if (sincronizare.pastrate > 0 && userAngajat !== null) {
          const { error: eroareNotificare } = await admin.from("notifications").insert({
            organization_id: ctx.tenant.organizationId,
            user_id: userAngajat,
            kind: "warning" as const,
            title: "Zile pontate care se suprapun cu concediul",
            body: `Aveți ${String(sincronizare.pastrate)} ${sincronizare.pastrate === 1 ? "zi pontată care se suprapune" : "zile pontate care se suprapun"} cu concediul aprobat. Au rămas înregistrate ca zile lucrate — verificați-le cu responsabilul de pontaj.`,
            link: "/portal/pontajul-meu",
            entity_type: "leave_request",
            entity_id: sarcina.entity_id,
          });
          if (eroareNotificare !== null) {
            // Notificarea e un plus, nu poarta: dacă ea cade, aprobarea NU se
            // dă înapoi. Numărul ajunge oricum la aprobator prin rezultat.
            console.error("[concedii] notificarea de zile suprapuse a eșuat", {
              leaveRequestId: sarcina.entity_id,
              requestId: ctx.requestId,
              eroare: eroareNotificare,
            });
          }
        }
      } catch (eroare) {
        console.error("[pontaj] sincronizarea automată cu concediul aprobat a eșuat", {
          leaveRequestId: sarcina.entity_id,
          requestId: ctx.requestId,
          eroare,
        });
      }
    }

    // `zilePastrate` NU e un detaliu tehnic: e numărul de zile care se vor plăti
    // și ca lucrate, și ca zile de concediu, dacă nimeni nu se uită la ele.
    return { id: sarcina.entity_id, zilePastrate };
  },
});

// ── Documentul justificativ ─────────────────────────────────────────────────

/**
 * Pregătește încărcarea documentului justificativ și întoarce o adresă semnată.
 *
 * Fișierul urcă DIRECT din browser în Storage, nu prin Server Action: un PDF de
 * 20 MB trecut prin `FormData` către o acțiune ar traversa serverul degeaba și
 * ar lovi limita de corp a cererii. Serverul dă doar calea și jetonul.
 *
 * Calea are segmentul 2 `leave` — nume de resursă REAL din `role_permissions`.
 * `app.can_path` îl dă direct lui `app.has_permission`, iar un cuvânt
 * inexistent acolo întoarce `none`, adică refuz TĂCUT la fiecare încărcare
 * (0073_cale_storage_resurse.sql documentează exact accidentul ăsta).
 * Segmentul 3 e fișa de angajat, pe care ramura `own` din `can_path` o
 * acceptă de la 0073 încoace — altfel angajatul n-ar putea urca în propriul
 * dosar.
 */
export const pregatesteIncarcareDocumentConcediu = createAction({
  name: "leave.document.pregateste",
  feature: "leave",
  permission: "leave:create",
  minScope: "own",
  input: pregatesteIncarcareDocumentSchema,
  audit: {
    action: "import",
    entityType: "leave_request",
    entityId: () => null,
    allow: ["employee_id", "nume_fisier"],
  },
  revalidate: [],
  handler: async (
    ctx: ActionContext,
    input,
  ): Promise<Readonly<{ cale: string; token: string }>> => {
    const employeeId = await fisaTinta(ctx, input.employee_id);
    const cale = construiesteCaleDocument({
      organizationId: ctx.tenant.organizationId,
      entitate: "leave",
      entitateId: employeeId,
      numeFisier: input.nume_fisier,
    });

    const { data, error } = await ctx.supabase.storage
      .from(BUCKET_DOCUMENTE)
      .createSignedUploadUrl(cale);
    if (error !== null || data === null) {
      throw businessRule("Nu am putut pregăti încărcarea documentului.");
    }
    return { cale, token: data.token };
  },
});

/**
 * Adresa temporară de descărcare a documentului unei cereri.
 *
 * Se citește întâi RÂNDUL, prin clientul utilizatorului: RLS decide dacă
 * persoana are voie să vadă cererea (`own` pentru autor, `team` pentru
 * manager, `all` pentru resurse umane). Abia calea din rândul întors se
 * semnează — nicio cale nu vine de la client.
 */
export const linkDocumentConcediu = createAction({
  name: "leave.document.link",
  feature: "leave",
  permission: "leave:read",
  minScope: "own",
  input: linkDocumentConcediuSchema,
  audit: {
    action: "export",
    entityType: "leave_request",
    entityId: (input) => input.id,
    allow: ["id"],
  },
  revalidate: [],
  handler: async (ctx: ActionContext, input): Promise<Readonly<{ url: string }>> => {
    const { data, error } = await ctx.supabase
      .from("leave_requests")
      .select("atasament_path")
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .maybeSingle<{ atasament_path: string | null }>();
    if (error !== null) traduEroare(error);
    // Zero rânduri sub o politică SELECT nu se deosebește de „nu există”, iar
    // ecranul n-are voie să spună care dintre ele e.
    if (data === null || data.atasament_path === null) {
      throw notFound("Cererea nu are un document atașat.");
    }

    const semnat = await ctx.supabase.storage
      .from(BUCKET_DOCUMENTE)
      .createSignedUrl(data.atasament_path, 60);
    if (semnat.error !== null || semnat.data === null) {
      throw businessRule("Documentul nu a putut fi deschis.");
    }
    return { url: semnat.data.signedUrl };
  },
});
