// src/app/(app)/concedii/actions.ts
"use server";

import { createAction } from "@/lib/actions/create-action";
import { businessRule, notFound } from "@/lib/actions/errors";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { numaraZileCerere } from "@/domain/leave/zile-cerere";
import {
  verificaSold,
  verificaSuprapunere,
  type IntervalConcediu,
} from "@/domain/leave/verificari";
import { formatAmount } from "@/lib/format/money";
import { zileNelucratoare } from "@/lib/queries/leave";
import { anuleazaCerereSchema, creeazaCerereSchema, decideCerereSchema } from "@/schemas/leave";
import { sincronizeazaZileleDeConcediu } from "@/app/(app)/pontaj/sincronizare-concediu";
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

function laDataUTC(valoare: string): Date {
  const parti = valoare.split("-");
  const an = Number(parti[0]);
  const luna = Number(parti[1]);
  const zi = Number(parti[2]);
  return new Date(Date.UTC(an, luna - 1, zi));
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

    // ── (2) Tipul de concediu ───────────────────────────────────────────────
    const { data: tip, error: eroareTip } = await ctx.supabase
      .from("leave_types")
      .select("id, denumire, scade_din_sold, zile_implicite")
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("id", input.leave_type_id)
      .eq("activ", true)
      .is("deleted_at", null)
      .maybeSingle();
    if (eroareTip !== null) throw eroareTip;
    if (tip === null) {
      throw businessRule("Tipul de concediu selectat nu există sau a fost dezactivat.");
    }

    // ── (3)-(5) Pre-verificarea sold + suprapunere ──────────────────────────
    // DOAR la trimitere reală (`trimite = true`): un „ciorna” nu intră în
    // `in_asteptare` (leave_request_days ia statusul cererii) și nu e supus
    // nici constrângerii EXCLUDE, nici verificării de sold din `recalc_sold`
    // — predicatul ei filtrează explicit `status in ('trimisa','in_aprobare')`.
    // Blocarea unui simplu draft ar fi o regulă inventată, nu una din bază.
    if (input.trimite) {
      const an = Number(input.data_inceput.slice(0, 4));
      const { nationale, organizatie } = await zileNelucratoare(ctx.tenant.organizationId, an, an);
      const sarbatoriRo = nationale.map((z) => z.data);
      const liberSuplimentar = organizatie
        .filter((z) => z.tip === "liber_suplimentar")
        .map((z) => z.data);
      const zileRecuperare = organizatie
        .filter((z) => z.tip === "zi_recuperare")
        .map((z) => z.data);

      const { zileLucratoare } = numaraZileCerere(
        input.data_inceput,
        input.data_sfarsit,
        input.portiune_inceput,
        input.portiune_sfarsit,
        sarbatoriRo,
        liberSuplimentar,
        zileRecuperare,
      );

      if (tip.scade_din_sold) {
        const { data: sold, error: eroareSold } = await ctx.supabase
          .from("leave_balances")
          .select("ramase")
          .eq("organization_id", ctx.tenant.organizationId)
          .eq("employee_id", employeeId)
          .eq("leave_type_id", tip.id)
          .eq("an", an)
          .is("deleted_at", null)
          .maybeSingle();
        if (eroareSold !== null) throw eroareSold;
        // Fără rând de sold ⇒ dreptul e încă neatins anul acesta: disponibil = zile_implicite.
        const zileDisponibile = sold?.ramase ?? tip.zile_implicite;
        const verificare = verificaSold(zileLucratoare, zileDisponibile);
        if (!verificare.areSoldSuficient) {
          throw businessRule(
            `Soldul de „${tip.denumire}” pe anul ${String(an)} nu acoperă zilele solicitate: lipsesc ${formatAmount(verificare.zileLipsa)} zile. Reduceți perioada sau cereți ajustarea dreptului anual.`,
          );
        }
      }

      const { data: existente, error: eroareExistente } = await ctx.supabase
        .from("leave_requests")
        .select("data_inceput, data_sfarsit")
        .eq("organization_id", ctx.tenant.organizationId)
        .eq("employee_id", employeeId)
        .in("status", ["trimisa", "in_aprobare", "aprobata"])
        .is("deleted_at", null);
      if (eroareExistente !== null) throw eroareExistente;

      const cerereNoua: IntervalConcediu = {
        dataInceput: laDataUTC(input.data_inceput),
        dataSfarsit: laDataUTC(input.data_sfarsit),
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
  revalidate: (input) => [
    "/concedii",
    "/concedii/sold",
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
    let doarFisaMea: string | null = null;
    if (ctx.scope !== "all") {
      // Fișa proprie via clientul admin, din același motiv ca la creare: rolul
      // `employee` are `employees:read = none` și nu-și poate citi nici propria
      // fișă. Filtru explicit pe organizație + utilizator.
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
      doarFisaMea = fisa.id;
    }

    // `.select("id")` stă în ACELAȘI lanț cu `.update()`, înaintea filtrului
    // condiționat: e o tranziție de status, iar capcana 17 cere ca rezultatul
    // gol să se poată deosebi de succes. Filtrele se pot aplica și după
    // `.select()` — ordinea lor nu contează pentru PostgREST.
    let interogare = ctx.supabase
      .from("leave_requests")
      .update({ status: "anulata" })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .in("status", ["ciorna", "trimisa"])
      .select("id");
    if (doarFisaMea !== null) interogare = interogare.eq("employee_id", doarFisaMea);

    const { data, error } = await interogare.maybeSingle();
    if (error !== null) throw traduEroare(error);
    if (data === null) {
      throw businessRule(
        "Cererea nu poate fi anulată: fie nu a fost găsită, fie nu vă aparține, fie decizia asupra ei a început deja. O cerere se poate anula doar cât timp este „ciornă” sau „trimisă”.",
      );
    }
    return { id: data.id };
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
  revalidate: (_input, data: Readonly<{ id: string }>) => [
    "/concedii",
    "/concedii/aprobari",
    "/concedii/sold",
    ...CAI_PORTAL_CONCEDII,
    `/portal/concediile-mele/${data.id}`,
    // Decizia sincronizează zilele în pontaj (v. handler): fără calea asta,
    // angajatul vede concediul aprobat și pontajul nemodificat.
    "/portal/pontajul-meu",
  ],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
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
        const { data: cerere, error: eroareCerere } = await admin
          .from("leave_requests")
          .select("employee_id")
          .eq("id", sarcina.entity_id)
          .eq("organization_id", ctx.tenant.organizationId)
          .single();
        if (eroareCerere !== null) throw eroareCerere;

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
        }));
        await sincronizeazaZileleDeConcediu(admin, ctx.tenant.organizationId, zile);
      } catch (eroare) {
        console.error("[pontaj] sincronizarea automată cu concediul aprobat a eșuat", {
          leaveRequestId: sarcina.entity_id,
          requestId: ctx.requestId,
          eroare,
        });
      }
    }

    return { id: sarcina.entity_id };
  },
});
