// src/app/(app)/pontaj/saptamana/actions.ts
"use server";

import { createAction } from "@/lib/actions/create-action";
import { businessRule, notFound } from "@/lib/actions/errors";
import { oreleZilei } from "@/domain/attendance/calcul-ore";
import { esteWeekend } from "@/domain/attendance/limite-legale";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { zileNelucratoare } from "@/lib/queries/leave";
import { tipZiAutomat } from "../etichete";
import { setariPontaj } from "@/lib/queries/attendance";
import { configZiDin } from "@/domain/attendance/calcul-ore";
import { scriePontajulSaptamanii } from "./scrie-pontajul";
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

    /*
     * Din 0133 funcția întoarce `{ submission_id, zile_sarite }`, nu doar
     * identificatorul: zilele cu concediu APROBAT se sar, iar cine a planificat
     * trebuie să afle care — altfel crede că a planificat cinci zile și în plan
     * sunt trei.
     *
     * Citire defensivă: RPC-ul e tipat `Json`, iar o formă neașteptată nu are
     * voie să arunce peste un plan care S-A SALVAT deja.
     */
    const rezultat = (data ?? {}) as { submission_id?: unknown; zile_sarite?: unknown };
    const idSubmisie = typeof rezultat.submission_id === "string" ? rezultat.submission_id : "";
    const zileSarite = Array.isArray(rezultat.zile_sarite)
      ? rezultat.zile_sarite.filter((z): z is string => typeof z === "string")
      : [];

    return {
      id: idSubmisie,
      zileSarite,
      // Planul săptămânal e în VIITOR: nu poate intra în conflict cu o
      // suspendare pentru absențe, care se constată din pontajul realizat.
      conflictSuspendare: null,
      avertismentReluare: null,
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

    /*
     * ── SĂPTĂMÂNA APROBATĂ DEVINE PONTAJ ───────────────────────────────────
     *
     * Până la 0138, aprobarea nu producea nimic: calendarul rămânea gol, iar
     * salarizarea — care citește `attendance_entries` — număra zero ore pentru
     * o săptămână întreagă declarată ȘI aprobată.
     *
     * Doar pe ramura de APROBARE. O săptămână respinsă nu lasă ore în pontaj,
     * ceea ce e chiar rostul respingerii: se corectează și se retrimite.
     *
     * Best-effort, ca sincronizarea concediilor din `decideCerere`: aprobarea e
     * deja înregistrată, iar o scriere căzută n-are voie s-o desfacă. Numerele
     * ies din acțiune și ajung la aprobator — singurul care se uită la ecran.
     */
    let pontaj = { scrise: 0, pastrate: 0 };
    if (input.decizie === "aprobata") {
      /*
       * Clientul de serviciu: aprobatorul are `attendance:approve`, nu
       * `attendance:create` pe fișa altcuiva. Filtrul pe `organization_id` e
       * explicit pe fiecare interogare de mai jos și în `scriePontajulSaptamanii`.
       */
      const admin = createAdminSupabase();

      // Săptămâna se citește ÎNTÂI: din ea vin și angajatul, și data de la care
      // se iau setările. Intrarea acțiunii poartă doar `taskId`.
      const { data: saptamana, error: eroareSaptamana } = await admin
        .from("attendance_week_submissions")
        .select("employee_id, saptamana_start")
        .eq("id", sarcina.entity_id)
        .eq("organization_id", ctx.tenant.organizationId)
        .maybeSingle();
      if (eroareSaptamana !== null) throw eroareSaptamana;

      if (saptamana !== null) {
        // Setările de la data SĂPTĂMÂNII, nu de azi: `attendance_settings` are
        // istoric (`valabil_de_la`), iar o normă schimbată între timp n-are
        // voie să rescrie orele unei săptămâni trecute.
        const an = Number(saptamana.saptamana_start.slice(0, 4));
        const [setari, nelucratoare] = await Promise.all([
          setariPontaj(ctx.tenant.organizationId, saptamana.saptamana_start),
          // Calendarul firmei, pentru tipul fiecărei zile. Aceeași sursă ca la
          // ziua individuală — altfel o sâmbătă lucrată ar intra ca zi
          // obișnuită și n-ar mai primi sporul de repaus.
          zileNelucratoare(ctx.tenant.organizationId, an, an),
        ]);
        const sarbatori = new Set(nelucratoare.nationale.map((z) => z.data));
        const recuperare = new Set(
          nelucratoare.organizatie.filter((z) => z.tip === "zi_recuperare").map((z) => z.data),
        );
        const liber = new Set(
          nelucratoare.organizatie.filter((z) => z.tip === "liber_suplimentar").map((z) => z.data),
        );

        pontaj = await scriePontajulSaptamanii(
          admin,
          ctx.tenant.organizationId,
          sarcina.entity_id,
          saptamana.employee_id,
          configZiDin(setari),
          (data) => tipZiAutomat(data, sarbatori, recuperare, liber),
          ctx.requestId,
        );
      }
    }

    return { id: sarcina.entity_id, ...pontaj };
  },
});
