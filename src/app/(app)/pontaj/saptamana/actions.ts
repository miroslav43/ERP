// src/app/(app)/pontaj/saptamana/actions.ts
"use server";

import { createAction } from "@/lib/actions/create-action";
import { businessRule, notFound } from "@/lib/actions/errors";
import { oreleZilei } from "@/domain/attendance/calcul-ore";
import { esteWeekend } from "@/domain/attendance/limite-legale";
import { setariPontaj } from "@/lib/queries/attendance";
import { decideSaptamanaPontajSchema, trimiteSaptamanaPontajSchema } from "@/schemas/attendance";
import { refuzaCandAprobareaEStinsa } from "../aprobarea-firmei";
import { avertismenteDupaSaptamana, type RezultatCuAvertismente } from "../avertismente";
import { traduEroare } from "../erori";

const CAI_REVALIDARE = [
  "/pontaj/saptamana",
  "/pontaj/aprobare",
  "/portal",
  "/portal/pontajul-meu",
  "/portal/pontajul-meu/saptamana",
] as const;

/**
 * Singurul drum de scriere pentru angajat: apelează `trimite_saptamana_pontaj`
 * (security definer, 0040_pontaj_saptamanal.sql) — validează, apoi upsert +
 * regenerare completă a zilelor. Editabil oricând planul nu e încă aprobat
 * (reapelarea suprascrie zilele anterioare).
 */
export const trimiteSaptamanaPontaj = createAction<
  typeof trimiteSaptamanaPontajSchema,
  RezultatCuAvertismente
>({
  name: "attendance.week.submit",
  feature: "attendance",
  permission: "attendance:create",
  minScope: "own",
  input: trimiteSaptamanaPontajSchema,
  audit: {
    action: "create",
    entityType: "attendance_week_submission",
    entityId: (_input, data) => data.id,
    allow: ["saptamana_start", "status"],
  },
  revalidate: [...CAI_REVALIDARE],
  handler: async (ctx, input) => {
    // ── Orele se DERIVĂ din interval, aici, nu se cred de la client ─────────
    //
    // Formularul arată orele ca text needitabil. Dacă serverul ar scrie pur și
    // simplu ce primește, „needitabil" ar fi o decorație de ecran: o cerere
    // fabricată ar declara 12 ore planificate pe un interval de 4. Aceeași
    // regulă ca la ziua individuală (`salveazaZiPontaj`), și același
    // `oreleZilei` — o singură aritmetică a pauzei de masă în tot produsul.
    //
    // Setările se citesc o dată pe săptămână, nu o dată pe zi: sunt versionate
    // pe `valabil_de_la`, iar o săptămână nu traversează o schimbare de
    // parametri decât în cazuri patologice. `saptamana_start` e data de
    // referință.
    const setari = await setariPontaj(ctx.tenant.organizationId, input.saptamana_start);
    const config = {
      orePeZi: setari?.ore_pe_zi ?? 8,
      noapteStart: setari?.noapte_start.slice(0, 5) ?? "22:00",
      noapteSfarsit: setari?.noapte_sfarsit.slice(0, 5) ?? "06:00",
      pauzaMinute: setari?.pauza_masa_minute ?? 0,
      pauzaInclusaInProgram: setari?.pauza_masa_inclusa_in_program ?? true,
      pauzaObligatoriePesteOre: setari?.pauza_obligatorie_peste_ore ?? 0,
    };

    /** Ce se trimite spre RPC, plus cifrele pe care le verifică limitele legale. */
    const derivatePeZi = input.zile.map((zi) => {
      // Fără interval = zi nelucrată (weekend debifat, sărbătoare): zero ore,
      // nu norma presupusă. Vechiul implicit `8` din RPC e exact ce umplea
      // sâmbăta și duminica în portal.
      if (zi.ora_inceput === null || zi.ora_sfarsit === null) {
        return { zi: { ...zi, ora_inceput: null, ora_sfarsit: null, ore_planificate: 0 } };
      }
      const derivate = oreleZilei(zi.ora_inceput, zi.ora_sfarsit, config);
      if (derivate === null) {
        throw businessRule(
          `Pe ${zi.data}, ora de ieșire trebuie să fie după ora de intrare, în aceeași zi.`,
        );
      }
      return { zi: { ...zi, ore_planificate: derivate.lucrate }, derivate };
    });
    const zile = derivatePeZi.map((d) => d.zi);

    const { data, error } = await ctx.supabase.rpc("trimite_saptamana_pontaj", {
      p_organization_id: ctx.tenant.organizationId,
      p_saptamana_start: input.saptamana_start,
      p_status: input.status,
      p_zile: zile,
      /*
       * DIN SETĂRI **SAU** DIN CE S-A COMPLETAT CHIAR ACUM.
       *
       * Steagul se salvează pe submisie și e ce vede aprobatorul ca CONTEXT:
       * „la firma asta se lucrează în weekend". De aceea nu se crede de la
       * client: o cerere fabricată ar declara asta la o firmă de birou, iar
       * sâmbăta lucrată ar apărea drept program obișnuit.
       *
       * Dar numai din setări nu se poate: aceeași coloană decide, la
       * REÎNCĂRCARE, dacă se mai desenează coloanele de weekend
       * (`lucreazaWeekendInitial`, în ambele pagini de săptămână). O firmă cu
       * `lucreaza_weekend = false` în care cineva chiar a lucrat sâmbăta
       * salva ziua corect, primea caseta debifată înapoi, iar următoarea
       * trimitere — o corectură pe luni — o trimitea goală. RPC-ul face
       * `delete` + reinserare (0084), deci orele dispăreau din bază fără
       * nicio eroare.
       *
       * `esteWeekend` pe DATĂ, nu pe indice: schema acceptă `.min(1).max(7)`
       * zile, deci poziția 5 nu e garantat sâmbăta. Ce se declară rămâne
       * astfel un fapt observat — „săptămâna asta chiar are weekend lucrat" —
       * nu o afirmație a clientului.
       */
      p_lucreaza_weekend:
        (setari?.lucreaza_weekend ?? false) ||
        derivatePeZi.some(({ zi }) => zi.ora_inceput !== null && esteWeekend(zi.data)),
      // Cine are `attendance:create = all` completează și pentru altcineva
      // (0084). `null` înseamnă propria fișă. Autorizarea rămâne în bază, în
      // `app.poate_scrie_pontaj` — aici nu se decide nimic, doar se transmite.
      p_employee_id: input.employee_id,
    });
    if (error !== null) traduEroare(error);

    return {
      id: data,
      // Planul e scris; abia acum se spune ce e în neregulă cu el. Sursa sunt
      // zilele TRIMISE, nu `attendance_entries`: săptămâna planificată e în
      // viitor, unde nu există încă niciun pontaj de citit.
      avertismente: await avertismenteDupaSaptamana({
        organizationId: ctx.tenant.organizationId,
        saptamanaStart: input.saptamana_start,
        setari,
        zile: derivatePeZi.map(({ zi, derivate }) => ({
          data: zi.data,
          oraInceput: zi.ora_inceput,
          oraSfarsit: zi.ora_sfarsit,
          oreLucrate: zi.ore_planificate,
          oreSuplimentare: derivate?.suplimentare ?? 0,
          oreNoapte: derivate?.noapte ?? 0,
        })),
      }),
    };
  },
});

/**
 * Aprobare/respingere individuală, pe toată săptămâna dintr-o singură
 * decizie — tipar identic cu `decideCerere` (concedii/actions.ts). Cu un
 * singur pas de aprobare (managerul direct ∪ patronul, la aceeași `ordine`),
 * orice decizie anulează automat sarcinile surori
 * (`trg_approval_tasks_anuleaza_surori`, deja generic) — nu mai e nevoie să
 * numărăm sarcini rămase, ca la concediu (mai multe trepte posibile acolo).
 */
export const decideSaptamanaPontaj = createAction<
  typeof decideSaptamanaPontajSchema,
  Readonly<{ id: string }>
>({
  name: "attendance.week.decide",
  feature: "attendance",
  permission: "attendance:approve",
  minScope: "team",
  input: decideSaptamanaPontajSchema,
  audit: {
    action: "update",
    entityType: "attendance_week_submission",
    entityId: (input) => input.taskId,
    allow: ["taskId", "decizie", "comentariu", "motivRespingere"],
  },
  revalidate: [...CAI_REVALIDARE],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    await refuzaCandAprobareaEStinsa(ctx.tenant.organizationId);

    const { data: sarcina, error: eroareSarcina } = await ctx.supabase
      .from("approval_tasks")
      .select("id, entity_id")
      .eq("id", input.taskId)
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("entity_type", "attendance_week_submission")
      .eq("status", "in_asteptare")
      .is("deleted_at", null)
      .maybeSingle();
    if (eroareSarcina !== null) throw eroareSarcina;
    if (sarcina === null) {
      throw notFound("Sarcina de aprobare nu a fost găsită sau a fost deja rezolvată.");
    }

    const acum = ctx.now.toISOString();
    // `.select()` aici e APĂRARE ÎN ADÂNCIME, nu reparația unei căi observate —
    // și distincția contează, fiindcă motivarea greșită învață următorul
    // cititor o regulă de RLS care nu există.
    //
    // `approval_tasks_select` (0009_leave.sql:957) și `approval_tasks_update`
    // (:975) au ACELAȘI predicat: destinatarul, delegatul, sau
    // `leave:approve = "all"` — permisiunea de CONCEDII, nu cea de pontaj. Cine
    // e respins de `USING`-ul de UPDATE e respins deja și de SELECT, deci
    // citirea de mai sus întoarce `null` și fluxul se oprește la `notFound()`,
    // cu alt mesaj. Ramura de mai jos NU poate fi atinsă pe calea obișnuită.
    //
    // Se poate atinge doar dacă apartenența sau delegarea se schimbă ÎNTRE
    // citire și scriere. Rar, dar nu imposibil, iar costul e o linie.
    const { data: sarcinaDecisa, error: eroareUpdateSarcina } = await ctx.supabase
      .from("approval_tasks")
      .update({ status: input.decizie, comentariu: input.comentariu, decis_la: acum })
      .eq("id", sarcina.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (eroareUpdateSarcina !== null) traduEroare(eroareUpdateSarcina);
    if (sarcinaDecisa === null) {
      throw businessRule(
        "Sarcina de aprobare nu vă este atribuită sau a fost decisă de altcineva între timp, deci decizia nu a fost înregistrată. Reîncărcați lista de aprobări.",
      );
    }

    // Tot tranziție: `attendance_week_submissions_update` (0041) cere
    // `status = 'trimisa'` și manager direct sau `attendance:approve = all`. O
    // retrimitere a angajatului sau decizia altui aprobator, între citire și
    // scriere, scoate rândul din `USING` — zero rânduri, fără eroare.
    const { data: saptamanaDecisa, error: eroareDecizie } = await ctx.supabase
      .from("attendance_week_submissions")
      .update({
        status: input.decizie,
        decis_de: ctx.user.id,
        decis_la: acum,
        motiv_respingere: input.decizie === "respinsa" ? input.motivRespingere : null,
      })
      .eq("id", sarcina.entity_id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (eroareDecizie !== null) traduEroare(eroareDecizie);
    if (saptamanaDecisa === null) {
      throw businessRule(
        "Sarcina a fost marcată ca decisă, dar săptămâna nu a mai putut fi actualizată: între timp a fost retrimisă de angajat sau decisă de alt aprobator. Reîncărcați pagina și verificați starea ei.",
      );
    }

    return { id: sarcina.entity_id };
  },
});
