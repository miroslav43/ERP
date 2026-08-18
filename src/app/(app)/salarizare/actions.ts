"use server";

import { createAction } from "@/lib/actions/create-action";
import { businessRule, notFound } from "@/lib/actions/errors";
import {
  angajatiActiviCuContract,
  citesteSetariPeId,
  pontajAgregatPerioada,
  zileLucratoareLuna,
} from "@/lib/queries/payroll";
import { calculatePayrollEntry, type PayrollSettingsSnapshot } from "@/domain/payroll/calc";
import {
  creeazaPerioadaSchema,
  idPerioadaSchema,
  primaSchema,
  retinereSchema,
  setariSalarizareSchema,
} from "@/schemas/payroll";
import type { Json } from "@/types/database";

const CAI_REVALIDARE = ["/salarizare", "/panou"] as const;

export const salveazaSetari = createAction({
  name: "payroll.settings.save",
  feature: "payroll",
  permission: "payroll:update",
  minScope: "all",
  input: setariSalarizareSchema,
  audit: { action: "update", entityType: "payroll_settings", allow: ["valabil_de_la"] },
  revalidate: ["/salarizare/setari"],
  handler: async (ctx, input) => {
    const { data: setari, error } = await ctx.supabase
      .from("payroll_settings")
      .insert({
        organization_id: ctx.tenant.organizationId,
        valabil_de_la: input.valabil_de_la,
        cota_cas: input.cota_cas,
        cota_cass: input.cota_cass,
        cota_impozit: input.cota_impozit,
        cota_cam_angajator: input.cota_cam_angajator,
        norma_zilnica_ore: input.norma_zilnica_ore,
        procent_spor_noapte: input.procent_spor_noapte,
        procent_spor_weekend: input.procent_spor_weekend,
        procent_ore_suplimentare: input.procent_ore_suplimentare,
        valoare_tichet_masa: input.valoare_tichet_masa,
        tichete_impozabile: input.tichete_impozabile,
        rotunjire_lei: input.rotunjire_lei,
      })
      .select("id")
      .single<{ id: string }>();
    if (error !== null) throw error;

    const { error: eroarePraguri } = await ctx.supabase
      .from("payroll_personal_deduction_brackets")
      .insert(
        input.praguri.map((prag, index) => ({
          organization_id: ctx.tenant.organizationId,
          settings_id: setari.id,
          nr_persoane_intretinere_min: prag.nr_persoane_intretinere_min,
          nr_persoane_intretinere_max: prag.nr_persoane_intretinere_max,
          venit_brut_max: prag.venit_brut_max,
          valoare: prag.valoare,
          ordine: index,
        })),
      );
    if (eroarePraguri !== null) throw eroarePraguri;

    return { id: setari.id };
  },
});

export const creeazaPerioada = createAction({
  name: "payroll.period.create",
  feature: "payroll",
  permission: "payroll:create",
  minScope: "all",
  input: creeazaPerioadaSchema,
  audit: { action: "create", entityType: "payroll_period", allow: ["an", "luna"] },
  revalidate: CAI_REVALIDARE,
  handler: async (ctx, input) => {
    const { data: perioadaPontaj, error: eroarePontaj } = await ctx.supabase
      .from("attendance_periods")
      .select("id")
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("an", input.an)
      .eq("luna", input.luna)
      .is("deleted_at", null)
      .maybeSingle<{ id: string }>();
    if (eroarePontaj !== null) throw eroarePontaj;
    if (perioadaPontaj === null) {
      throw businessRule(
        "Nu există o perioadă de pontaj pentru luna aleasă. Deschideți-o mai întâi din modulul Pontaj.",
      );
    }

    const ultimaZi = `${String(input.an)}-${String(input.luna).padStart(2, "0")}-01`;
    const { data: setari, error: eroareSetari } = await ctx.supabase
      .from("payroll_settings")
      .select("id")
      .eq("organization_id", ctx.tenant.organizationId)
      .lte("valabil_de_la", ultimaZi)
      .is("deleted_at", null)
      .order("valabil_de_la", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (eroareSetari !== null) throw eroareSetari;
    if (setari === null) {
      throw businessRule(
        "Nu există setări de salarizare valabile pentru luna aleasă. Configurați-le înainte de a crea perioada.",
      );
    }

    const { data, error } = await ctx.supabase
      .from("payroll_periods")
      .insert({
        organization_id: ctx.tenant.organizationId,
        an: input.an,
        luna: input.luna,
        attendance_period_id: perioadaPontaj.id,
        settings_id: setari.id,
      })
      .select("id")
      .single<{ id: string }>();
    if (error !== null) throw error;
    return { id: data.id };
  },
});

function laSetariSnapshot(
  setari: NonNullable<Awaited<ReturnType<typeof citesteSetariPeId>>>,
): PayrollSettingsSnapshot {
  return {
    valabilDeLa: setari.valabil_de_la,
    cotaCas: setari.cota_cas,
    cotaCass: setari.cota_cass,
    cotaImpozit: setari.cota_impozit,
    cotaCamAngajator: setari.cota_cam_angajator,
    normaZilnicaOre: setari.norma_zilnica_ore,
    procentSporNoapte: setari.procent_spor_noapte,
    procentSporWeekend: setari.procent_spor_weekend,
    procentOreSuplimentare: setari.procent_ore_suplimentare,
    valoareTichetMasa: setari.valoare_tichet_masa,
    ticheteImpozabile: setari.tichete_impozabile,
    deducerePersonala: setari.praguri.map((p) => ({
      nrPersoaneIntretinereMin: p.nr_persoane_intretinere_min,
      nrPersoaneIntretinereMax: p.nr_persoane_intretinere_max,
      venitBrutMax: p.venit_brut_max,
      valoare: p.valoare,
    })),
    rotunjireLei: setari.rotunjire_lei,
  };
}

export const calculeazaPerioada = createAction({
  name: "payroll.period.calculate",
  feature: "payroll",
  permission: "payroll:create",
  minScope: "all",
  input: idPerioadaSchema,
  audit: { action: "update", entityType: "payroll_period", allow: ["id"] },
  revalidate: CAI_REVALIDARE,
  handler: async (ctx, input) => {
    const { data: perioada, error: eroarePerioada } = await ctx.supabase
      .from("payroll_periods")
      .select("id, an, luna, attendance_period_id, settings_id, status")
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("id", input.id)
      .is("deleted_at", null)
      .maybeSingle<{
        id: string;
        an: number;
        luna: number;
        attendance_period_id: string;
        settings_id: string;
        status: string;
      }>();
    if (eroarePerioada !== null) throw eroarePerioada;
    if (perioada === null) throw notFound("Perioada de salarizare nu a fost găsită.");
    if (perioada.status !== "draft") {
      throw businessRule(
        "Perioada nu mai este în ciornă. Recalcularea unei perioade calculate se face din același ecran.",
      );
    }

    const setari = await citesteSetariPeId(ctx.tenant.organizationId, perioada.settings_id);
    if (setari === null) throw notFound("Setările de salarizare ale perioadei nu mai există.");
    const snapshot = laSetariSnapshot(setari);

    const [zileLuna, angajati, pontaj] = await Promise.all([
      zileLucratoareLuna(ctx.tenant.organizationId, perioada.an, perioada.luna),
      angajatiActiviCuContract(ctx.tenant.organizationId),
      pontajAgregatPerioada(ctx.tenant.organizationId, perioada.attendance_period_id),
    ]);
    if (angajati.length === 0) {
      throw businessRule("Nu există niciun angajat activ cu contract activ de calculat.");
    }

    interface ElementVariabil {
      readonly suma: number;
      readonly impozabil: boolean;
      readonly supus_contributii: boolean;
    }
    const { data: prime, error: eroarePrime } = await ctx.supabase
      .from("payroll_bonuses")
      .select("employee_id, suma, impozabil, supus_contributii")
      .eq("period_id", perioada.id)
      .is("deleted_at", null)
      .returns<(ElementVariabil & { employee_id: string })[]>();
    if (eroarePrime !== null) throw eroarePrime;

    const { data: retineri, error: eroareRetineri } = await ctx.supabase
      .from("payroll_deductions")
      .select("employee_id, suma, procent_maxim_din_net")
      .eq("period_id", perioada.id)
      .is("deleted_at", null)
      .returns<{ employee_id: string; suma: number; procent_maxim_din_net: number | null }[]>();
    if (eroareRetineri !== null) throw eroareRetineri;

    const primePeAngajat = new Map<string, ElementVariabil[]>();
    for (const p of prime ?? []) {
      const listaAnterioara = primePeAngajat.get(p.employee_id) ?? [];
      primePeAngajat.set(p.employee_id, [...listaAnterioara, p]);
    }
    const retineriPeAngajat = new Map<
      string,
      { suma: number; procentMaximDinNet: number | null }[]
    >();
    for (const r of retineri ?? []) {
      const listaAnterioara = retineriPeAngajat.get(r.employee_id) ?? [];
      retineriPeAngajat.set(r.employee_id, [
        ...listaAnterioara,
        { suma: r.suma, procentMaximDinNet: r.procent_maxim_din_net },
      ]);
    }

    const randuri = angajati.map((angajat) => {
      const pontajAngajat = pontaj.get(angajat.employee_id) ?? {
        zile_lucrate: 0,
        ore_lucrate: 0,
        ore_suplimentare: 0,
        ore_noapte: 0,
        zile_concediu_odihna: 0,
        zile_concediu_medical: 0,
        zile_absenta_nemotivata: 0,
      };
      const rezultat = calculatePayrollEntry({
        settings: snapshot,
        contract: {
          salariuBaza: angajat.salariu_baza,
          nrPersoaneIntretinere: angajat.nr_persoane_intretinere,
        },
        attendance: {
          zileLucratoareLuna: zileLuna,
          zileLucrate: pontajAngajat.zile_lucrate,
          oreLucrate: pontajAngajat.ore_lucrate,
          oreSuplimentare: pontajAngajat.ore_suplimentare,
          oreNoapte: pontajAngajat.ore_noapte,
          zileConcediuOdihna: pontajAngajat.zile_concediu_odihna,
          zileConcediuMedical: pontajAngajat.zile_concediu_medical,
          zileAbsentaNemotivata: pontajAngajat.zile_absenta_nemotivata,
        },
        bonuses: (primePeAngajat.get(angajat.employee_id) ?? []).map((p) => ({
          suma: p.suma,
          impozabil: p.impozabil,
          supusContributii: p.supus_contributii,
        })),
        deductions: (retineriPeAngajat.get(angajat.employee_id) ?? []).map((r) => ({
          suma: r.suma,
          procentMaximDinNet: r.procentMaximDinNet,
        })),
      });

      return {
        organization_id: ctx.tenant.organizationId,
        period_id: perioada.id,
        employee_id: angajat.employee_id,
        contract_id: angajat.contract_id,
        status: "calculat" as const,
        zile_lucratoare_luna: zileLuna,
        zile_lucrate: pontajAngajat.zile_lucrate,
        zile_concediu_odihna: pontajAngajat.zile_concediu_odihna,
        zile_concediu_medical: pontajAngajat.zile_concediu_medical,
        zile_absenta_nemotivata: pontajAngajat.zile_absenta_nemotivata,
        ore_lucrate: pontajAngajat.ore_lucrate,
        ore_suplimentare: pontajAngajat.ore_suplimentare,
        ore_noapte: pontajAngajat.ore_noapte,
        baza_salariu: rezultat.bazaSalariu,
        suma_ore_suplimentare: rezultat.sumaOreSuplimentare,
        spor_noapte: rezultat.sporNoapte,
        prime_total: rezultat.primeTotal,
        brut: rezultat.brut,
        nr_tichete: rezultat.nrTichete,
        valoare_tichete: rezultat.valoareTichete,
        baza_cas_cass: rezultat.bazaCasCass,
        cas: rezultat.cas,
        cass: rezultat.cass,
        deducere_personala: rezultat.deducerePersonala,
        baza_impozit: rezultat.bazaImpozit,
        impozit: rezultat.impozit,
        cam_angajator: rezultat.camAngajator,
        net: rezultat.net,
        retineri_total: rezultat.retineriTotal,
        net_de_plata: rezultat.netDePlata,
        cost_total_angajator: rezultat.costTotalAngajator,
        // JSON.parse(JSON.stringify(...)) scapă de `readonly` pe array-uri și
        // obiecte imbricate — `Json` din tipurile generate cere structuri
        // mutabile, iar rezultatul motorului de calcul e complet imutabil.
        settings_snapshot: JSON.parse(JSON.stringify(snapshot)) as Json,
        calc_breakdown: JSON.parse(JSON.stringify(rezultat.breakdown)) as Json,
        calc_warnings: JSON.parse(JSON.stringify(rezultat.warnings)) as Json,
        calculat_la: new Date().toISOString(),
      };
    });

    // Fără `.upsert(..., { onConflict })`: unicitatea e pe un index PARȚIAL
    // (`where deleted_at is null`), iar PostgREST nu poate ținti unul prin
    // ON CONFLICT — exact limitarea documentată în `scripts/demo/seed-demo.mjs`
    // pentru `asigura()`. Recalcularea devine, deci, select-apoi-scrie.
    const { data: existente, error: eroareExistente } = await ctx.supabase
      .from("payroll_entries")
      .select("id, employee_id")
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("period_id", perioada.id)
      .is("deleted_at", null)
      .returns<{ id: string; employee_id: string }[]>();
    if (eroareExistente !== null) throw eroareExistente;
    const idExistent = new Map((existente ?? []).map((e) => [e.employee_id, e.id]));

    const deActualizat = randuri.filter((r) => idExistent.has(r.employee_id));
    const deInserat = randuri.filter((r) => !idExistent.has(r.employee_id));

    const rezultateActualizare = await Promise.all(
      deActualizat.map((rand) =>
        ctx.supabase
          .from("payroll_entries")
          .update(rand)
          .eq("id", idExistent.get(rand.employee_id) as string),
      ),
    );
    const eroareActualizare = rezultateActualizare.find((r) => r.error !== null)?.error;
    if (eroareActualizare !== undefined) throw eroareActualizare;

    if (deInserat.length > 0) {
      const { error: eroareInserare } = await ctx.supabase
        .from("payroll_entries")
        .insert(deInserat);
      if (eroareInserare !== null) throw eroareInserare;
    }

    const totalBrut = randuri.reduce((s, r) => s + r.brut, 0);
    const totalNet = randuri.reduce((s, r) => s + r.net, 0);
    const totalCost = randuri.reduce((s, r) => s + r.cost_total_angajator, 0);

    const { error: eroareStatus } = await ctx.supabase
      .from("payroll_periods")
      .update({
        status: "calculat",
        total_brut: totalBrut,
        total_net: totalNet,
        total_cost_angajator: totalCost,
      })
      .eq("id", perioada.id)
      .eq("organization_id", ctx.tenant.organizationId);
    if (eroareStatus !== null) throw eroareStatus;

    return { id: perioada.id, angajati: randuri.length };
  },
});

export const aprobaPerioada = createAction({
  name: "payroll.period.approve",
  feature: "payroll",
  permission: "payroll:approve",
  minScope: "all",
  input: idPerioadaSchema,
  audit: { action: "update", entityType: "payroll_period", allow: ["id"] },
  revalidate: CAI_REVALIDARE,
  handler: async (ctx, input) => {
    const { error } = await ctx.supabase
      .from("payroll_periods")
      .update({ status: "aprobat" })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId);
    if (error !== null) throw error;
    return null;
  },
});

export const inchidePerioada = createAction({
  name: "payroll.period.close",
  feature: "payroll",
  permission: "payroll:approve",
  minScope: "all",
  input: idPerioadaSchema,
  audit: { action: "update", entityType: "payroll_period", allow: ["id"] },
  revalidate: CAI_REVALIDARE,
  handler: async (ctx, input) => {
    const { error } = await ctx.supabase
      .from("payroll_periods")
      .update({ status: "inchis" })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId);
    if (error !== null) throw error;
    return null;
  },
});

export const adaugaPrima = createAction({
  name: "payroll.bonus.add",
  feature: "payroll",
  permission: "payroll:create",
  minScope: "all",
  input: primaSchema,
  audit: {
    action: "create",
    entityType: "payroll_bonus",
    allow: ["period_id", "employee_id", "tip"],
  },
  revalidate: CAI_REVALIDARE,
  handler: async (ctx, input) => {
    const { error } = await ctx.supabase.from("payroll_bonuses").insert({
      organization_id: ctx.tenant.organizationId,
      period_id: input.period_id,
      employee_id: input.employee_id,
      tip: input.tip,
      suma: input.suma,
      motiv: input.motiv,
      impozabil: input.impozabil,
      supus_contributii: input.supus_contributii,
    });
    if (error !== null) throw error;
    return null;
  },
});

export const adaugaRetinere = createAction({
  name: "payroll.deduction.add",
  feature: "payroll",
  permission: "payroll:create",
  minScope: "all",
  input: retinereSchema,
  audit: {
    action: "create",
    entityType: "payroll_deduction",
    allow: ["period_id", "employee_id", "tip"],
  },
  revalidate: CAI_REVALIDARE,
  handler: async (ctx, input) => {
    const { error } = await ctx.supabase.from("payroll_deductions").insert({
      organization_id: ctx.tenant.organizationId,
      period_id: input.period_id,
      employee_id: input.employee_id,
      tip: input.tip,
      suma: input.suma,
      procent_maxim_din_net: input.procent_maxim_din_net,
      motiv: input.motiv,
    });
    if (error !== null) throw error;
    return null;
  },
});
