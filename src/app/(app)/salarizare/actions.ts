"use server";

import { createAction } from "@/lib/actions/create-action";
import { businessRule, notFound } from "@/lib/actions/errors";
import {
  angajatiActiviCuContract,
  citesteSetariPeId,
  componenteSalarialeActivePerioada,
  PONTAJ_GOL,
  pontajAgregatPerioada,
  scutiriActivePerioada,
  zileLucratoareLuna,
} from "@/lib/queries/payroll";
import { calculatePayrollEntry, type PayrollSettingsSnapshot } from "@/domain/payroll/calc";
import { descriereCompleta, problema } from "@/domain/payroll/erori";
import {
  creeazaPerioadaSchema,
  idPerioadaSchema,
  primaSchema,
  retinereSchema,
  setariSalarizareSchema,
} from "@/schemas/payroll";
import type { Json } from "@/types/database";
import { traduEroare } from "./erori";

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
        tichete_supuse_cass: input.tichete_supuse_cass,
        salariu_minim_brut: input.salariu_minim_brut,
        aplica_minim_contributii: input.aplica_minim_contributii,
        rotunjire_lei: input.rotunjire_lei,
      })
      .select("id")
      .single<{ id: string }>();
    if (error !== null) traduEroare(error);

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
    if (eroarePraguri !== null) traduEroare(eroarePraguri);

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
    if (eroarePontaj !== null) traduEroare(eroarePontaj);
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
    if (eroareSetari !== null) traduEroare(eroareSetari);
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
    if (error !== null) traduEroare(error);
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
    ticheteSupuseCass: setari.tichete_supuse_cass,
    verificatDeContabil: setari.verificat_de_contabil,
    deducerePersonala: setari.praguri.map((p) => ({
      nrPersoaneIntretinereMin: p.nr_persoane_intretinere_min,
      nrPersoaneIntretinereMax: p.nr_persoane_intretinere_max,
      venitBrutMax: p.venit_brut_max,
      valoare: p.valoare,
    })),
    rotunjireLei: setari.rotunjire_lei,
    salariuMinimBrut: setari.salariu_minim_brut,
    aplicaMinimContributii: setari.aplica_minim_contributii,
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
    if (eroarePerioada !== null) traduEroare(eroarePerioada);
    if (perioada === null) throw notFound("Perioada de salarizare nu a fost găsită.");
    if (perioada.status !== "draft") {
      throw businessRule(
        "Perioada nu mai este în ciornă. Recalcularea unei perioade calculate se face din același ecran.",
      );
    }

    const setari = await citesteSetariPeId(ctx.tenant.organizationId, perioada.settings_id);
    if (setari === null) throw notFound("Setările de salarizare ale perioadei nu mai există.");
    const snapshot = laSetariSnapshot(setari);

    const [zileLuna, personal, pontaj, scutiri, componenteSalariale] = await Promise.all([
      zileLucratoareLuna(ctx.tenant.organizationId, perioada.an, perioada.luna),
      angajatiActiviCuContract(ctx.tenant.organizationId, perioada.an, perioada.luna),
      pontajAgregatPerioada(perioada.attendance_period_id),
      scutiriActivePerioada(ctx.tenant.organizationId, perioada.an, perioada.luna),
      componenteSalarialeActivePerioada(ctx.tenant.organizationId, perioada.an, perioada.luna),
    ]);
    const angajati = personal.angajati;

    // O citire trunchiată ar produce un stat de plată incomplet care ARATĂ
    // complet — clasa de defect cea mai costisitoare din acest modul.
    if (personal.trunchiat || pontaj.trunchiat) {
      const p = problema("SAL_TRUNCHIERE_CITIRE");
      throw businessRule(descriereCompleta(p));
    }
    // Angajații activi fără contract aplicabil se raportau NOMINAL, nu se sar:
    // varianta veche îi elimina tăcut și pur și simplu lipseau de pe stat.
    if (personal.faraContract.length > 0) {
      const nume = personal.faraContract
        .map((a) => `${a.full_name || "(fără nume)"} (marca ${a.marca})`)
        .join(", ");
      const p = problema("SAL_CONTRACT_LIPSA", {
        detalii: `${String(personal.faraContract.length)}: ${nume}.`,
      });
      throw businessRule(descriereCompleta(p));
    }
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
    if (eroarePrime !== null) traduEroare(eroarePrime);

    const { data: retineri, error: eroareRetineri } = await ctx.supabase
      .from("payroll_deductions")
      .select("employee_id, suma, procent_maxim_din_net")
      .eq("period_id", perioada.id)
      .is("deleted_at", null)
      .returns<{ employee_id: string; suma: number; procent_maxim_din_net: number | null }[]>();
    if (eroareRetineri !== null) traduEroare(eroareRetineri);

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
      const pontajAngajat = pontaj.pePersoana.get(angajat.employee_id) ?? PONTAJ_GOL;
      const rezultat = calculatePayrollEntry({
        settings: snapshot,
        contract: {
          salariuBaza: angajat.salariu_baza,
          nrPersoaneIntretinere: angajat.nr_persoane_intretinere,
          normaZilnicaOre: angajat.norma_ore_zi,
          exemptii: scutiri.get(angajat.employee_id) ?? [],
        },
        attendance: {
          zileLucratoareLuna: zileLuna,
          zileLucrate: pontajAngajat.zile_lucrate,
          oreLucrate: pontajAngajat.ore_lucrate,
          oreSuplimentare: pontajAngajat.ore_suplimentare_zi,
          oreNoapte: pontajAngajat.ore_noapte,
          zileConcediuOdihna: pontajAngajat.zile_concediu_odihna,
          zileConcediuMedical: pontajAngajat.zile_concediu_medical,
          zileAbsentaNemotivata: pontajAngajat.zile_absenta_nemotivata,
          zileRepausLucrate: pontajAngajat.zile_repaus_lucrate,
          zileSarbatoareLucrate: pontajAngajat.zile_sarbatoare_lucrate,
          oreNormaleRepaus: pontajAngajat.ore_normale_repaus,
          oreSuplimentareRepaus: pontajAngajat.ore_suplimentare_repaus,
          oreNormaleSarbatoare: pontajAngajat.ore_normale_sarbatoare,
          oreSuplimentareSarbatoare: pontajAngajat.ore_suplimentare_sarbatoare,
        },
        bonuses: [
          ...(primePeAngajat.get(angajat.employee_id) ?? []).map((p) => ({
            suma: p.suma,
            impozabil: p.impozabil,
            supusContributii: p.supus_contributii,
          })),
          // Sporuri/prime reutilizabile asociate pe fișă (etapa 3) — nu mai
          // trebuie re-introduse manual în fiecare perioadă.
          ...(componenteSalariale.get(angajat.employee_id) ?? []).map((c) => ({
            suma:
              c.kind === "spor_procent"
                ? angajat.salariu_baza * ((c.procent ?? 0) / 100)
                : (c.suma ?? 0),
            impozabil: c.impozabil,
            supusContributii: c.supusContributii,
            intraInBazaCas: c.intraInBazaCas,
            intraInBazaCass: c.intraInBazaCass,
            // Mașina de serviciu, cazarea, abonamentul: intră în brut și se
            // impozitează, dar nu se plătesc a doua oară în bani.
            esteAvantajInNatura: c.kind === "beneficiu_natura",
          })),
        ],
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
        ore_suplimentare: pontajAngajat.ore_suplimentare_zi,
        ore_noapte: pontajAngajat.ore_noapte,
        zile_repaus_lucrate: pontajAngajat.zile_repaus_lucrate,
        zile_sarbatoare_lucrate: pontajAngajat.zile_sarbatoare_lucrate,
        ore_repaus: rezultat.oreRepaus,
        ore_sarbatoare: rezultat.oreSarbatoare,
        spor_repaus: rezultat.sporRepaus,
        spor_sarbatoare: rezultat.sporSarbatoare,
        baza_salariu: rezultat.bazaSalariu,
        suma_ore_suplimentare: rezultat.sumaOreSuplimentare,
        spor_noapte: rezultat.sporNoapte,
        prime_total: rezultat.primeTotal,
        brut: rezultat.brut,
        nr_tichete: rezultat.nrTichete,
        valoare_tichete: rezultat.valoareTichete,
        baza_cas_cass: rezultat.bazaCasCass,
        baza_cas: rezultat.bazaCas,
        baza_cass: rezultat.bazaCass,
        cas: rezultat.cas,
        cass: rezultat.cass,
        deducere_personala: rezultat.deducerePersonala,
        scutire_fiscala: rezultat.scutireFiscala,
        baza_impozit: rezultat.bazaImpozit,
        impozit: rezultat.impozit,
        cam_angajator: rezultat.camAngajator,
        net: rezultat.net,
        retineri_total: rezultat.retineriTotal,
        net_de_plata: rezultat.netDePlata,
        avantaje_natura: rezultat.avantajeNatura,
        rest_de_plata: rezultat.restDePlata,
        cost_total_angajator: rezultat.costTotalAngajator,
        // JSON.parse(JSON.stringify(...)) scapă de `readonly` pe array-uri și
        // obiecte imbricate — `Json` din tipurile generate cere structuri
        // mutabile, iar rezultatul motorului de calcul e complet imutabil.
        settings_snapshot: JSON.parse(JSON.stringify(snapshot)) as Json,
        calc_breakdown: JSON.parse(JSON.stringify(rezultat.breakdown)) as Json,
        calc_warnings: JSON.parse(
          JSON.stringify([
            ...rezultat.warnings,
            ...(angajat.contract_schimbat_in_luna
              ? [
                  (() => {
                    const p = problema("SAL_CONTRACT_SCHIMBAT_IN_LUNA");
                    return { cod: p.cod, mesaj: descriereCompleta(p) };
                  })(),
                ]
              : []),
          ]),
        ) as Json,
        calculat_la: new Date().toISOString(),
      };
    });

    // O SINGURĂ tranzacție, prin RPC (migrarea 0051).
    //
    // Varianta anterioară trimitea câte o cerere HTTP per angajat — pentru 200
    // de angajați, 200 de cereri fără nimic care să le lege. Un eșec la
    // jumătate lăsa perioada cu jumătate din rânduri recalculate și jumătate
    // vechi, fără urmă a locului rupturii. Un apel RPC rulează într-o singură
    // tranzacție: ori toate rândurile, ori niciunul.
    //
    // `organization_id` și `period_id` NU se trimit: funcția le derivă din
    // perioadă, ca o sarcină utilă construită de mână să nu poată ținti altă
    // organizație.
    const { data: scrise, error: eroareScriere } = await ctx.supabase
      .rpc("payroll_scrie_rezultate", {
        p_period_id: perioada.id,
        p_randuri: randuri.map(({ organization_id: _o, period_id: _p, ...rest }) => rest) as Json,
      })
      .select("inserate, actualizate")
      .maybeSingle<{ inserate: number; actualizate: number }>();
    if (eroareScriere !== null) traduEroare(eroareScriere);
    if (scrise === null) {
      throw businessRule(
        "Rândurile de salariu nu au putut fi scrise. Verificați că aveți dreptul de calcul și că perioada mai este în ciornă.",
      );
    }
    if (scrise.inserate + scrise.actualizate !== randuri.length) {
      // Numărul scris trebuie să fie exact numărul calculat. O diferență
      // înseamnă că o politică RLS a filtrat rânduri fără să arunce eroare —
      // exact clasa de defect pe care restul modulului o vânează.
      throw businessRule(
        `S-au calculat ${String(randuri.length)} rânduri, dar baza a acceptat doar ${String(scrise.inserate + scrise.actualizate)}. Perioada nu a fost marcată drept calculată.`,
      );
    }

    const totalBrut = randuri.reduce((s, r) => s + r.brut, 0);
    const totalNet = randuri.reduce((s, r) => s + r.net, 0);
    const totalCost = randuri.reduce((s, r) => s + r.cost_total_angajator, 0);

    // Capcana 17: un UPDATE respins de clauza USING a politicii RLS afectează
    // ZERO rânduri, TĂCUT — fără nicio eroare. `.select()` după update e
    // singura dovadă că s-a schimbat ceva; fără el UI-ul raportează succes
    // peste o bază neschimbată.
    const { data: perioadaCalculata, error: eroareStatus } = await ctx.supabase
      .from("payroll_periods")
      .update({
        status: "calculat",
        total_brut: totalBrut,
        total_net: totalNet,
        total_cost_angajator: totalCost,
      })
      .eq("id", perioada.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle<{ id: string }>();
    if (eroareStatus !== null) traduEroare(eroareStatus);
    if (perioadaCalculata === null) {
      throw businessRule(
        "Rândurile de salariu au fost scrise, dar perioada nu a putut fi trecută în starea calculat. Reîmprospătați pagina și recalculați.",
      );
    }

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
    // Capcana 17: un UPDATE respins de clauza USING a politicii RLS afectează
    // ZERO rânduri, TĂCUT — fără nicio eroare. `.select()` după update e
    // singura dovadă că s-a schimbat ceva; fără el UI-ul raportează succes
    // peste o bază neschimbată.
    const { data, error } = await ctx.supabase
      .from("payroll_periods")
      .update({ status: "aprobat" })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id, status")
      .maybeSingle<{ id: string; status: string }>();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule(
        "Perioada nu a putut fi aprobată. Fie nu mai este în starea calculat, fie nu aveți dreptul de aprobare. Reîmprospătați pagina.",
      );
    }
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
    // Capcana 17: un UPDATE respins de clauza USING a politicii RLS afectează
    // ZERO rânduri, TĂCUT — fără nicio eroare. `.select()` după update e
    // singura dovadă că s-a schimbat ceva; fără el UI-ul raportează succes
    // peste o bază neschimbată.
    const { data, error } = await ctx.supabase
      .from("payroll_periods")
      .update({ status: "inchis" })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id, status")
      .maybeSingle<{ id: string; status: string }>();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule(
        "Perioada nu a putut fi închisă. Fie nu mai este în starea aprobat, fie nu aveți dreptul de închidere. Reîmprospătați pagina.",
      );
    }
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
    if (error !== null) traduEroare(error);
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
    if (error !== null) traduEroare(error);
    return null;
  },
});
