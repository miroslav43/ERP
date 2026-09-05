// src/app/(app)/angajati/nou/actions.ts
"use server";

import { z } from "zod";

import { createAction } from "@/lib/actions/create-action";
import { businessRule } from "@/lib/actions/errors";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { genereazaEvenimenteReges } from "@/lib/reges/genereaza-evenimente";
import { genereazaDocumenteInrolare, type DocumentEmis } from "@/lib/documents/inrolare";
import { alegeSablon } from "@/domain/checklist/potrivire-sablon";
import { creeazaInvitatie } from "@/lib/invitatii/creeaza";
import { adresaRealaDinFisa } from "@/lib/invitatii/adresa";
import {
  salveazaCiornaInrolareSchema, inroleazaAngajatSchema } from "@/schemas/employee";
import { predaObiect } from "@/app/(app)/inventar/actions";
import { adaugaAutorizatieNominala, adaugaFisaAptitudine } from "@/app/(app)/ssm/actions";

import { ETICHETE_ACT_IDENTITATE, ETICHETE_MOD_LUCRU } from "../etichete";
import { salveazaDateSensibile } from "../actions";

interface RezultatInrolare {
  readonly id: string;
  readonly contractId: string;
  /** Numărul alocat contractului — cel scris efectiv, nu cel cerut. */
  readonly numarContract: string;
  /** Documentele emise, în ordinea în care s-au generat. */
  readonly documente: readonly DocumentEmis[];
  /** Adresa la care a plecat invitația de acces, sau `null` dacă n-a plecat. */
  readonly invitatieTrimisaLa: string | null;
  /** Denumirea șablonului de integrare pornit automat, sau `null`. */
  readonly checklistPornit: string | null;
  /**
   * Ce NU s-a putut face, deși înrolarea a reușit.
   *
   * Pașii opționali — bunul de inventar, fișa de aptitudine, autorizația,
   * documentele, evenimentul REVISAL — sunt fiecare într-un `try/catch` care
   * doar loga, fiindcă fiecare are propriul prag de permisiune, diferit de
   * `employees:create`. Principiul e corect: un `hr` fără `inventory:update` nu
   * trebuie să rateze înrolarea din cauza unui laptop.
   *
   * Dar până acum utilizatorul NU AFLA NICIODATĂ. Ecranul spunea „angajat
   * înrolat", iar laptopul rămânea nepredat, fișa medicală neînregistrată și
   * contractul negenerat — tăcut. Exact „gap-ul care generează muncă în plus"
   * pe care modulul își propune să-l închidă.
   */
  readonly avertismente: readonly string[];
}

const CAMPURI_ANGAJAT = [
  "last_name",
  "first_name",
  "email_personal",
  "telefon",
  "adresa_strada",
  "adresa_oras",
  "adresa_judet",
  "adresa_cod_postal",
  "adresa_resedinta_strada",
  "adresa_resedinta_oras",
  "adresa_resedinta_judet",
  "adresa_resedinta_cod_postal",
  "email_serviciu",
  "telefon_serviciu",
  "stare_civila",
  "data_nasterii",
  "gen",
  "cetatenie",
  "tip_act_identitate",
  "reges_tip_act",
  "serie_act",
  "numar_act",
  "act_eliberat_de",
  "act_eliberat_la",
  "act_valabil_pana",
  "department_id",
  "functie",
  "cod_cor",
  "manager_employee_id",
  "hired_on",
  "conditii_munca",
  "grad_handicap",
  "nr_persoane_intretinere",
  "optiune_pilon_ii",
  "is_primary",
  "contact_urgenta_nume",
  "contact_urgenta_telefon",
  "contact_urgenta_relatie",
  "observatii",
] as const;

const CAMPURI_CONTRACT = [
  "numar",
  "data_contract",
  "valabil_de_la",
  "valabil_pana",
  "contract_duration",
  "motiv_determinat",
  "norma_ore_saptamana",
  "norma_ore_zi",
  "work_mode",
  "special_regime",
  "loc_telemunca",
  "loc_munca",
  "punct_lucru_id",
  "conditii_munca",
  "moneda",
  "zile_concediu_anual",
  "perioada_proba_zile",
  "preaviz_zile",
] as const;

/**
 * Câte alocări de număr se încearcă înainte de a renunța.
 *
 * NEEXPORTAT, deliberat: fișierul e `"use server"`, iar o constantă exportată de
 * aici rupe build-ul — `tsc` tace, doar `pnpm build` o prinde.
 */
const MAX_INCERCARI_NUMAR = 5;

function textAtribuiri(text: string | null): readonly string[] {
  if (text === null) return [];
  return text
    .split("\n")
    .map((linie) => linie.trim())
    .filter((linie) => linie.length > 0);
}

export const inroleazaAngajat = createAction<typeof inroleazaAngajatSchema, RezultatInrolare>({
  name: "employees.enroll",
  permission: "employees:create",
  minScope: "all",
  input: inroleazaAngajatSchema,
  audit: {
    action: "create",
    entityType: "employee",
    entityId: (_input, data) => data.id,
    // Salariul rămâne deliberat în afara jurnalului de audit, ca la `creeazaContract`.
    //
    // `numar` e în listă, dar cu alocare automată INPUTUL e gol: numărul efectiv
    // se vede în jurnalul tabelei `employment_contracts`, scris de triggerul de
    // audit atașat în bucla `do $$` a migrării ei. Aici s-ar înregistra ce a
    // cerut omul, acolo ce s-a scris — a doua e informația care contează.
    allow: [...CAMPURI_ANGAJAT, ...CAMPURI_CONTRACT],
  },
  // `revalidate:` se DECLARĂ, nu se cheamă `revalidatePath()` din handler —
  // regula din CLAUDE.md, încălcată aici de la prima livrare.
  revalidate: ["/angajati", "/reges", "/concedii/sold", "/onboarding", "/setari/membri"],
  handler: async (ctx, input): Promise<RezultatInrolare> => {
    const db = ctx.supabase;
    const avertismente: string[] = [];

    const { data: marca, error: eroareMarca } = await db.rpc("urmatoarea_marca", {
      p_organization_id: ctx.tenant.organizationId,
    });
    if (eroareMarca !== null) throw eroareMarca;

    const {
      cnp,
      iban,
      banca,
      subordonare,
      atributii,
      competente,
      numar,
      data_contract,
      valabil_de_la,
      valabil_pana,
      contract_duration,
      motiv_determinat,
      norma_ore_saptamana,
      norma_ore_zi,
      work_mode,
      special_regime,
      loc_telemunca,
      loc_munca,
      punct_lucru_id,
      moneda,
      salariu_baza,
      zile_concediu_anual,
      perioada_proba_zile,
      preaviz_zile,
      inventory_item_ids,
      examen_data,
      examen_tip,
      examen_rezultat,
      examen_valabil_pana,
      examen_medic,
      examen_unitate_medicala,
      examen_numar_fisa,
      autorizatii,
      permis_tip,
      permis_numar,
      permis_emis_de,
      permis_valabil_de_la,
      permis_valabil_pana,
      numar_pasaport,
      componente_salariale,
      scutiri_fiscale,
      ...fisa
    } = input;

    const { data: angajat, error: eroareAngajat } = await db
      .from("employees")
      .insert({
        ...fisa,
        // Textul de pe documente se DERIVĂ din valoarea REGES, dintr-un singur
        // `<select>`. Ținute separat, cele două ar fi divergent tăcut: omul ar
        // alege „Permis de ședere" și contractul ar tipări altceva.
        tip_act_identitate: ETICHETE_ACT_IDENTITATE[fisa.reges_tip_act],
        marca,
        organization_id: ctx.tenant.organizationId,
        status: "activ",
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id, full_name")
      .single();
    if (eroareAngajat !== null) throw eroareAngajat;

    await salveazaDateSensibile(db, angajat.id, cnp, iban, banca);

    /*
     * Locul muncii se scrie de DOUĂ ori, deliberat.
     *
     * `punct_lucru_id` e legătura vie, folosită de rapoarte. `loc_munca` e
     * denumirea REZOLVATĂ la momentul semnării: contractul deja emis trebuie să
     * rămână corect chiar dacă punctul de lucru e redenumit peste doi ani.
     */
    let denumireLocMunca = loc_munca;
    if (punct_lucru_id !== null) {
      const { data: punct } = await db
        .from("puncte_lucru")
        .select("denumire")
        .eq("id", punct_lucru_id)
        .eq("organization_id", ctx.tenant.organizationId)
        .is("deleted_at", null)
        .maybeSingle();
      if (punct === null) {
        throw businessRule("Punctul de lucru ales nu mai există. Alegeți altul.");
      }
      denumireLocMunca = punct.denumire;
    }

    /*
     * Numărul contractului.
     *
     * Gol în formular = alocat automat de `public.aloca_numar_contract` (0098),
     * atomic, cu resetare anuală. Completat = folosit ca atare, pentru un
     * contract preluat prin transfer sau importat istoric.
     *
     * Reîncercarea acoperă cursa cu o altă înrolare simultană — dar NUMAI pe
     * indexul de număr: `employment_contracts` are cel puțin două indexuri
     * unice, iar un 23505 venit din altă parte, tratat ca „numărul e luat", ar
     * arde numere din registru și ar ieși cu un mesaj fără legătură cu cauza.
     */
    let numarContract: string | null = numar;
    let contract: { id: string } | null = null;

    for (let incercare = 0; incercare < MAX_INCERCARI_NUMAR && contract === null; incercare += 1) {
      let numarDeFolosit = numarContract;
      if (numarDeFolosit === null) {
        const { data: alocat, error: eroareAlocare } = await db.rpc("aloca_numar_contract", {
          p_organization_id: ctx.tenant.organizationId,
        });
        if (eroareAlocare !== null) throw eroareAlocare;
        numarDeFolosit = alocat;
      }

      // RLS (`contracts_insert`) forțează status = 'proiect' la INSERT — vezi
      // comentariul identic din `creeazaContract` (../actions.ts). Activarea e
      // un al doilea pas, prin UPDATE.
      const { data, error: eroareContract } = await db
        .from("employment_contracts")
        .insert({
          employee_id: angajat.id,
          parent_contract_id: null,
          este_act_aditional: false,
          numar: numarDeFolosit,
          data_contract,
          valabil_de_la,
          valabil_pana,
          contract_duration,
          motiv_determinat,
          norma_ore_saptamana,
          norma_ore_zi,
          work_mode,
          special_regime,
          loc_telemunca,
          loc_munca: denumireLocMunca,
          punct_lucru_id,
          department_id: fisa.department_id,
          // Înghețate la semnare: codul COR e o declarație făcută ACUM
          // către ITM, nu o valoare care se recitește din fișă la fiecare
          // export. Vezi antetul migrării 0110.
          functie: fisa.functie,
          cod_cor: fisa.cod_cor,
          conditii_munca: fisa.conditii_munca,
          salariu_baza,
          moneda,
          zile_concediu_anual,
          perioada_proba_zile,
          preaviz_zile,
          organization_id: ctx.tenant.organizationId,
          status: "proiect",
          cod_revisal: null,
          incetat_la: null,
          motiv_incetare: null,
          temei_incetare: null,
          created_by: ctx.user.id,
          updated_by: ctx.user.id,
        })
        .select("id")
        .single();

      if (eroareContract === null) {
        contract = data;
        numarContract = numarDeFolosit;
        break;
      }

      const detalii = `${eroareContract.message} ${eroareContract.details ?? ""}`;
      const numarulELuat =
        eroareContract.code === "23505" && detalii.includes("contracts_org_numar_uniq");
      if (!numarulELuat) throw eroareContract;

      if (numar !== null) {
        // Numărul l-a ales omul: nu se realocă pe la spatele lui.
        throw businessRule(
          `Numărul de contract „${numar}” este deja folosit în firma ta. Alegeți altul sau lăsați câmpul gol.`,
        );
      }
      numarContract = null; // alocat automat: reluăm cu următorul din contor
    }

    if (contract === null || numarContract === null) {
      throw businessRule("Numerotarea contractelor este ocupată. Încercați din nou.");
    }

    // `.select()` obligatoriu: un UPDATE respins de clauza `USING` afectează
    // zero rânduri FĂRĂ eroare (capcana 17). Contractul ar rămâne „proiect",
    // iar înrolarea ar raporta succes cu un angajat care nu e angajat.
    const { data: contractActivat, error: eroareActivare } = await db
      .from("employment_contracts")
      .update({ status: "activ", updated_by: ctx.user.id })
      .eq("id", contract.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (eroareActivare !== null) throw eroareActivare;
    if (contractActivat === null) {
      throw businessRule("Contractul a fost creat, dar activarea lui a fost respinsă.");
    }

    const anulAngajarii = Number(valabil_de_la.slice(0, 4));
    const { error: eroareSold } = await db.rpc("seed_leave_balances", {
      p_employee: angajat.id,
      p_an: anulAngajarii,
      p_zile_odihna_override: zile_concediu_anual,
    });
    if (eroareSold !== null) throw eroareSold;

    let jobDescriptionId: string | null = null;
    const listaAtributii = textAtribuiri(atributii);
    const listaCompetente = textAtribuiri(competente);
    if (listaAtributii.length > 0 || listaCompetente.length > 0 || subordonare !== null) {
      const { data: fisaPost, error: eroareFisaPost } = await db
        .from("job_descriptions")
        .insert({
          organization_id: ctx.tenant.organizationId,
          employee_id: angajat.id,
          contract_id: contract.id,
          titlu: `Fișa postului — ${angajat.full_name ?? ""}`,
          atributii: [...listaAtributii],
          competente: [...listaCompetente],
          subordonare,
          valabil_de_la,
          created_by: ctx.user.id,
          updated_by: ctx.user.id,
        })
        .select("id")
        .single();
      if (eroareFisaPost !== null) throw eroareFisaPost;
      jobDescriptionId = fisaPost.id;
    }

    // Bunuri și certificări existente — pași opționali ai formularului.
    // `predaObiect`/`adaugaFisaAptitudine`/`adaugaAutorizatieNominala` verifică
    // FIECARE propriul prag de permisiune (inventory:update / ssm:create),
    // diferit de employees:create — dacă actorul nu-l are, eșecul nu trebuie
    // să anuleze o înrolare deja reușită (același principiu ca la documente).
    // Fiecare bun se predă SEPARAT, cu propriul try/catch: dacă al doilea din
    // trei eșuează, primul rămâne predat și al treilea se încearcă oricum.
    // Un singur try în jurul buclei ar fi transformat un eșec într-o listă
    // predată pe jumătate, fără să se vadă unde s-a rupt.
    for (const itemId of inventory_item_ids) {
      try {
        await predaObiect({
          item_id: itemId,
          employee_id: angajat.id,
          predat_la: null,
          stare_la_predare: "bun",
          observatii: null,
          pv_document_path: null,
        });
      } catch (eroare) {
        avertismente.push(
          "Un bun de inventar nu a putut fi predat. Predați-l manual din fișa angajatului — poate fi nevoie de dreptul „inventar: modificare”.",
        );
        console.error("[inventar] bunul nu a putut fi predat la înrolare", {
          employeeId: angajat.id,
          itemId,
          requestId: ctx.requestId,
          eroare,
        });
      }
    }

    if (examen_data !== null) {
      try {
        await adaugaFisaAptitudine({
          employee_id: angajat.id,
          tip: examen_tip,
          data_examinarii: examen_data,
          medic: examen_medic,
          unitate_medicala: examen_unitate_medicala,
          rezultat: examen_rezultat,
          valabil_pana: examen_valabil_pana,
          numar_fisa: examen_numar_fisa,
          cost: null,
        });
      } catch (eroare) {
        avertismente.push(
          "Fișa de aptitudine (medicina muncii) nu a putut fi înregistrată. Adăugați-o din SSM → Medicina muncii.",
        );
        console.error("[ssm] fișa de aptitudine nu a putut fi înregistrată la înrolare", {
          employeeId: angajat.id,
          requestId: ctx.requestId,
          eroare,
        });
      }
    }

    // Permisul de muncă, pentru cetățenii non-RO. `work_permits` exista din
    // 0004 cu politici RLS și index de expirare, dar NICIUN cod nu o atingea:
    // un angajat străin se înrola fără aviz, iar expirarea nu apărea nicăieri.
    //
    // Scriere directă, nu printr-o acțiune vecină: nu există una. Pragul e
    // `employees:create`, deja verificat de `createAction` — iar RLS-ul tabelei
    // rămâne bariera.
    if (permis_numar !== null && permis_valabil_de_la !== null && permis_valabil_pana !== null) {
      try {
        const { error: eroarePermis } = await db.from("work_permits").insert({
          organization_id: ctx.tenant.organizationId,
          employee_id: angajat.id,
          tip_permis: permis_tip ?? "aviz",
          numar: permis_numar,
          emis_de: permis_emis_de,
          valabil_de_la: permis_valabil_de_la,
          valabil_pana: permis_valabil_pana,
          numar_pasaport,
          cetatenie: (fisa.cetatenie ?? "RO").toUpperCase(),
          created_by: ctx.user.id,
          updated_by: ctx.user.id,
        });
        if (eroarePermis !== null) throw eroarePermis;
      } catch (eroare) {
        avertismente.push(
          "Permisul de muncă nu a putut fi înregistrat. ATENȚIE: munca fără permis valabil e contravenție pentru angajator.",
        );
        console.error("[hr] permisul de muncă nu a putut fi înregistrat la înrolare", {
          employeeId: angajat.id,
          requestId: ctx.requestId,
          eroare,
        });
      }
    }

    /*
     * ── PACHETUL SALARIAL ȘI SCUTIRILE ─────────────────────────────────────
     *
     * Ambele se negociază la angajare și, până acum, se introduceau abia DUPĂ,
     * dintr-un al doilea ecran. Cine uita al doilea drum avea un om plătit
     * greșit din prima lună, iar nimic nu semnala lipsa: un pachet salarial gol
     * e o stare validă.
     *
     * `valabil_de_la` e data de început a CONTRACTULUI, nu ziua înrolării: un
     * spor negociat azi pentru un contract care începe luni se aplică de luni.
     *
     * AVERTISMENT, nu eroare — ca la autorizații și la permisul de muncă mai
     * sus. Angajatul și contractul există deja; a desface înrolarea fiindcă o
     * primă n-a intrat ar costa mai mult decât a o adăuga din fișă.
     */
    if (componente_salariale.length > 0) {
      const { error: eroareComponente } = await db.from("salary_components").insert(
        componente_salariale.map((c) => ({
          organization_id: ctx.tenant.organizationId,
          employee_id: angajat.id,
          contract_id: contract.id,
          component_type_id: c.component_type_id,
          kind: c.kind,
          procent: c.procent,
          suma: c.suma,
          moneda,
          valabil_de_la,
          created_by: ctx.user.id,
          updated_by: ctx.user.id,
        })),
      );
      if (eroareComponente !== null) {
        avertismente.push(
          "Sporurile și beneficiile nu au putut fi înregistrate. Adăugați-le din fișa angajatului → Componente salariale.",
        );
        console.error("[salarizare] componentele salariale nu au intrat la înrolare", {
          employeeId: angajat.id,
          requestId: ctx.requestId,
          eroare: eroareComponente,
        });
      }
    }

    if (scutiri_fiscale.length > 0) {
      const { error: eroareScutiri } = await db.from("employee_tax_exemptions").insert(
        scutiri_fiscale.map((sc) => ({
          organization_id: ctx.tenant.organizationId,
          employee_id: angajat.id,
          contract_id: contract.id,
          exemption_type: sc.exemption_type,
          procent_scutire: sc.procent_scutire,
          plafon_lunar: sc.plafon_lunar,
          temei_legal: sc.temei_legal,
          valabil_de_la,
          created_by: ctx.user.id,
          updated_by: ctx.user.id,
        })),
      );
      if (eroareScutiri !== null) {
        avertismente.push(
          "Scutirile fiscale nu au putut fi înregistrate. Adăugați-le din fișa angajatului → Scutiri fiscale — până atunci, primul stat de plată reține impozit.",
        );
        console.error("[salarizare] scutirile fiscale nu au intrat la înrolare", {
          employeeId: angajat.id,
          requestId: ctx.requestId,
          eroare: eroareScutiri,
        });
      }
    }

    for (const autorizatie of autorizatii) {
      try {
        await adaugaAutorizatieNominala({
          employee_id: angajat.id,
          tip: autorizatie.tip,
          grupa: null,
          numar: autorizatie.numar,
          emitent: autorizatie.emitent,
          emis_la: null,
          valabil_pana: autorizatie.valabil_pana,
          suspendata_la: null,
          observatii: null,
        });
      } catch (eroare) {
        avertismente.push(
          `Autorizația „${autorizatie.tip}" nu a putut fi înregistrată. Adăugați-o din SSM → Autorizații.`,
        );
        console.error("[ssm] autorizația nominală nu a putut fi înregistrată la înrolare", {
          employeeId: angajat.id,
          numar: autorizatie.numar,
          requestId: ctx.requestId,
          eroare,
        });
      }
    }

    // Generarea documentelor nu blochează înrolarea deja reușită — eșecul se
    // vede în jurnalul serverului, iar datele rămân disponibile pentru
    // regenerare manuală (același principiu ca la evenimentele REVISAL, mai jos).
    // Funcția NU mai cere o interogare: după migrarea 0110 e text pe fișă.
    // Departamentul rămâne o cheie străină, deci pe el încă trebuie mers.
    const randDepartament =
      fisa.department_id === null
        ? null
        : await db
            .from("departments")
            .select("denumire")
            .eq("id", fisa.department_id)
            .maybeSingle();
    const denumireFunctie = fisa.functie;
    const denumireDepartament = randDepartament?.data?.denumire ?? null;

    const { documente, avertismente: avertismenteDocumente } = await genereazaDocumenteInrolare(
      db,
      {
        organizationId: ctx.tenant.organizationId,
        employeeId: angajat.id,
        contractId: contract.id,
        emisDe: ctx.user.id,
        azi: todayInBucharest(),
        angajat: {
          nume: angajat.full_name ?? "",
          adresa: [fisa.adresa_strada, fisa.adresa_oras, fisa.adresa_judet]
            .filter((v): v is string => v !== null)
            .join(", "),
          serieAct: fisa.serie_act,
          numarAct: fisa.numar_act,
          actEliberatDe: fisa.act_eliberat_de,
          actEliberatLa: fisa.act_eliberat_la,
          functie: denumireFunctie,
          departament: denumireDepartament,
        },
        contract: {
          numar: numarContract,
          dataContract: data_contract,
          dataAngajarii: valabil_de_la,
          durata:
            contract_duration === "determinat" && valabil_pana !== null
              ? `determinată, până la ${formatDate(valabil_pana)}`
              : "nedeterminată",
          normaOreSaptamana: norma_ore_saptamana,
          normaOreZi: norma_ore_zi,
          modLucru: ETICHETE_MOD_LUCRU[work_mode] ?? work_mode,
          locMunca: denumireLocMunca,
          locTelemunca: loc_telemunca,
          salariuBrut: salariu_baza,
          zileConcediuAnual: zile_concediu_anual,
        },
        codModLucru: work_mode,
        fisaPostului:
          jobDescriptionId === null
            ? null
            : { subordonare, atributii: listaAtributii, competente: listaCompetente },
      },
    );
    avertismente.push(...avertismenteDocumente);

    /*
     * Invitația de acces în aplicație.
     *
     * Până acum, lanțul se rupea aici: angajatul se crea, iar contul lui se
     * invita din alt modul, sub alt rol, dintr-un ecran pe care nimeni nu-l
     * deschidea. `employees.user_id` nu era scris NICIODATĂ de aplicație, deci
     * omul primea cont și tot n-avea fișă.
     *
     * `employee_id` pe invitație (0099) închide bucla: la acceptare, triggerul
     * `internal.membru_creeaza_fisa_de_angajat` scrie legătura.
     *
     * Ca toți pașii opționali de mai sus, eșecul NU anulează înrolarea: pragul
     * cerut e `employees:invite`, pe care un `manager` nu-l are.
     */
    let invitatieTrimisaLa: string | null = null;
    /*
     * Adresa REALĂ, personală sau de serviciu. Până acum se citea doar
     * `email_personal`, deci un angajat care are numai adresă de firmă rămânea
     * fără cont, deși avea unde primi mesajul.
     *
     * Când nu există NICIUNA, invitația NU se creează aici, deliberat: ar avea
     * nevoie de o adresă fabricată, ar consuma un loc din `seats_limit` și ar
     * expira în șapte zile cu un link pe care nu l-a văzut nimeni — rezultatul
     * înrolării nu are unde să-l arate. Se face din fișa angajatului, unde fișa
     * tipăribilă cu cod QR apare pe ecran în clipa creării.
     */
    const adresaInvitatie = adresaRealaDinFisa(fisa);
    if (adresaInvitatie === null) {
      avertismente.push(
        "Angajatul nu are e-mail, deci nu i s-a trimis nicio invitație. Deschideți fișa lui și apăsați „Invită în aplicație”: primește un nume de utilizator și o fișă de tipărit, cu cod QR.",
      );
    } else {
      try {
        const invitatie = await creeazaInvitatie({
          db,
          organizationId: ctx.tenant.organizationId,
          email: adresaInvitatie,
          rol: "employee",
          employeeId: angajat.id,
          invitatDe: ctx.user.fullName ?? ctx.user.email,
          userId: ctx.user.id,
          acum: ctx.now,
        });
        invitatieTrimisaLa = invitatie.emailTrimis ? invitatie.email : null;
        if (!invitatie.emailTrimis) {
          avertismente.push(
            "Invitația a fost creată, dar e-mailul nu a plecat. Retrimiteți-l din Setări → Membri.",
          );
        }
      } catch (eroare) {
        avertismente.push(
          "Invitația de acces nu a putut fi trimisă. Poate fi nevoie de dreptul „angajați: invitare”.",
        );
        console.error("[invitatii] invitația de înrolare nu a putut fi trimisă", {
          employeeId: angajat.id,
          requestId: ctx.requestId,
          eroare,
        });
      }
    }

    /*
     * Checklistul de integrare.
     *
     * Se alege cel mai SPECIFIC șablon activ de tip `onboarding` care se
     * potrivește: pe funcție bate pe departament, care bate pe general. La
     * egalitate, cel mai recent — o firmă care și-a rescris șablonul vrea
     * varianta nouă, nu pe cea din primul an.
     *
     * `data_referinta` e `valabil_de_la`, nu ziua de azi: termenele pașilor se
     * calculează relativ la începerea activității, nu la clipa în care cineva
     * a apăsat butonul.
     */
    let checklistPornit: string | null = null;
    try {
      const { data: sabloane } = await db
        .from("checklist_templates")
        .select("id, denumire, department_id, cod_cor")
        .eq("organization_id", ctx.tenant.organizationId)
        .eq("tip", "onboarding")
        .eq("activ", true)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      const ales = alegeSablon(sabloane ?? [], {
        department_id: fisa.department_id,
        cod_cor: fisa.cod_cor,
      });

      if (ales === null) {
        avertismente.push(
          "Nu există niciun șablon de integrare activ, deci nu s-a pornit niciun checklist. Creați unul din Integrare → Șabloane.",
        );
      } else {
        const { error: eroareInstanta } = await db.from("checklist_instances").insert({
          organization_id: ctx.tenant.organizationId,
          template_id: ales.id,
          employee_id: angajat.id,
          data_referinta: valabil_de_la,
          observatii: null,
          // Triggerul `internal.checklist_pregateste_instanta` (BEFORE INSERT)
          // suprascrie `tip` din șablon; valoarea de aici există doar ca să
          // compileze, exact ca în `pornesteInstanta`.
          tip: "onboarding",
        });
        if (eroareInstanta !== null) throw eroareInstanta;
        checklistPornit = ales.denumire;
      }
    } catch (eroare) {
      avertismente.push(
        "Checklistul de integrare nu a putut fi pornit. Îl puteți porni din Integrare → Instanță nouă.",
      );
      console.error("[integrare] checklistul nu a putut fi pornit la înrolare", {
        employeeId: angajat.id,
        requestId: ctx.requestId,
        eroare,
      });
    }

    // REVISAL: aceeași generare idempotentă, mutată din `creeazaContract` —
    // vezi comentariul identic acolo.
    try {
      await genereazaEvenimenteReges({
        supabase: db,
        organizationId: ctx.tenant.organizationId,
        userId: ctx.user.id,
        evenimente: [
          {
            employeeId: angajat.id,
            contractId: contract.id,
            tip: "angajare",
            dataEvenimentului: valabil_de_la,
            valabilDeLa: valabil_de_la,
            dataContract: data_contract,
            payload: { numar, salariu_baza },
          },
        ],
      });
    } catch (eroare) {
      avertismente.push(
        "Evenimentul REVISAL de angajare nu a fost generat. ATENȚIE: transmiterea la ITM are termen legal — cel târziu în ziua lucrătoare anterioară începerii activității. Verificați în ecranul REVISAL.",
      );
      console.error("[revisal] evenimentul de angajare nu a putut fi generat", {
        contractId: contract.id,
        requestId: ctx.requestId,
        eroare,
      });
    }

    return {
      id: angajat.id,
      contractId: contract.id,
      numarContract,
      documente,
      invitatieTrimisaLa,
      checklistPornit,
      avertismente,
    };
  },
});

// ── Ciorna de înrolare ──────────────────────────────────────────────────────

/**
 * Salvează înrolarea neterminată, ca omul să se poată întoarce la ea.
 *
 * O SINGURĂ ciornă per autor și organizație — indexul unic parțial din 0131 o
 * impune. Consecința lui e că NU se poate folosi `.upsert()`: unicitatea e
 * `where deleted_at is null`, iar PostgREST nu emite predicatul în
 * `ON CONFLICT`, deci apelul ar cădea cu 42P10 la FIECARE salvare, nu doar la
 * conflict (capcana 7). De aceea citește-apoi-scrie.
 *
 * Poarta e `employees:create` la scope `all`, aceeași ca înrolarea însăși: o
 * ciornă e o înrolare începută, nu un obiect de sine stătător.
 *
 * `revalidate` e GOL, deliberat. Salvarea se cheamă la fiecare schimbare de
 * pas, iar o revalidare de rută la fiecare apăsare de „Continuă" ar reîncărca
 * pagina sub degetele omului, exact în mijlocul completării.
 */
export const salveazaCiornaInrolare = createAction({
  name: "employees.enroll.draft.save",
  permission: "employees:create",
  minScope: "all",
  input: salveazaCiornaInrolareSchema,
  audit: {
    action: "update",
    entityType: "inrolare_ciorna",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    // NUMAI pasul. `date` conține CNP, act de identitate, adresă și IBAN —
    // jurnalul de audit e citibil de oricine are `audit:read`, iar allow-lista
    // e mecanismul prin care datele astea nu ajung acolo.
    allow: ["pas"],
  },
  revalidate: [],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = ctx.supabase;

    const { data: existenta, error: eroareCitire } = await db
      .from("inrolare_ciorne")
      .select("id")
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("autor_id", ctx.user.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (eroareCitire !== null) throw eroareCitire;

    const camp = {
      pas: input.pas,
      eticheta: input.eticheta,
      date: input.date as Record<string, never>,
      // Fereastra se împinge la fiecare salvare: o ciornă atinsă azi nu expiră
      // fiindcă a fost începută acum 29 de zile.
      expira_la: new Date(ctx.now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    if (existenta !== null) {
      const { data, error } = await db
        .from("inrolare_ciorne")
        .update(camp)
        .eq("id", existenta.id)
        .eq("organization_id", ctx.tenant.organizationId)
        .select("id")
        .maybeSingle();
      if (error !== null) throw error;
      // Zero rânduri sub politica de UPDATE: altcineva a șters ciorna între
      // citire și scriere. Nu e o eroare de spus omului — se reia ca inserare.
      if (data !== null) return { id: data.id };
    }

    const { data, error } = await db
      .from("inrolare_ciorne")
      .insert({
        organization_id: ctx.tenant.organizationId,
        autor_id: ctx.user.id,
        ...camp,
      })
      .select("id")
      .single();
    if (error !== null) throw error;
    return { id: data.id };
  },
});

/**
 * Renunță la ciornă.
 *
 * Ștergere LOGICĂ, ca peste tot în proiect — dar cu o coadă proprie: rândul
 * marcat e apoi șters FIZIC de `internal.sterge_ciorne_inrolare()`, din pg_cron.
 * O ciornă „ștearsă" care păstrează CNP-ul la nesfârșit ar fi fost exact riscul
 * pe care 0131 îl elimină.
 */
export const stergeCiornaInrolare = createAction({
  name: "employees.enroll.draft.delete",
  permission: "employees:create",
  minScope: "all",
  input: z.object({}),
  audit: { action: "delete", entityType: "inrolare_ciorna", allow: [] },
  revalidate: ["/angajati/nou"],
  handler: async (ctx): Promise<Readonly<{ sters: boolean }>> => {
    const db = ctx.supabase;
    const { data, error } = await db
      .from("inrolare_ciorne")
      .update({ deleted_at: ctx.now.toISOString() })
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("autor_id", ctx.user.id)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) throw error;
    // Zero rânduri = nu era nicio ciornă. Cazul normal al unei a doua apăsări,
    // nu un refuz: nu se aruncă.
    return { sters: data !== null };
  },
});
