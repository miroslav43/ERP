// src/app/(app)/angajati/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ChevronRight, FileCheck, FileText, FolderOpen, KeyRound, Pencil } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { AvatarAngajat } from "@/components/data/avatar-angajat";
import { Badge } from "@/components/ui/badge";
import { buton } from "@/components/ui/buton";
import { IncarcareAvatar } from "@/components/forms/incarcare-avatar";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireUser } from "@/lib/auth/current-user";
import { evaluariAngajat, listeazaSabloane } from "@/lib/queries/evaluari";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import {
  ETICHETE_STATUS_EVALUARE,
  TONURI_STATUS_EVALUARE,
  tonPunctaj,
} from "../../evaluari/etichete";
import { formatDate } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import { Nivel } from "@/components/ui/nivel";
import { cn } from "@/lib/ui/cn";
import { pregatesteIncarcareAvatarulPropriu, salveazaAvatarulPropriu } from "@/lib/actions/profile";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  citesteAngajat,
  citesteComponenteSalariale,
  citesteRezumatDateSensibile,
  citesteScutiriFiscale,
  idFisaProprie,
  lantulDeManageri,
  piediciStergereAngajat,
  rolurileConturilor,
} from "@/lib/queries/employees";

import {
  ETICHETE_CONTRACT,
  ETICHETE_MOD_LUCRU,
  ETICHETE_ROL_CONT,
  ETICHETE_SCUTIRE,
  ETICHETE_TIP_COMPONENTA,
  TONURI_STATUS,
  etichetaStare,
  rolAdministrativ,
} from "../etichete";
import { ButonIncheieComponenta } from "./buton-incheie-componenta";
import { ButonStergeAngajat } from "./buton-sterge-angajat";
import { DateSensibile } from "./date-sensibile";
import { FormularContractNou } from "./formular-contract-nou";
import { FormularComponentaSalariala } from "./formular-componenta-salariala";
import {
  ButonContinuaCiorna,
  ButonEvaluareNoua,
  FormularEvaluareNoua,
} from "./formular-evaluare-noua";
import { FormularInceteazaContract } from "./formular-inceteaza-contract";
import { FormularModificaSalariu } from "./formular-modifica-salariu";
import { FormularScutireFiscala } from "./formular-scutire-fiscala";
import { IncarcareAvatarAdmin } from "./incarcare-avatar-admin";
import { SectiuneConcedii } from "./sectiune-concedii";
import { SectiuneDependenti, type RandDependent } from "./sectiune-dependenti";
import { InvitatieAngajat } from "./invitatie-angajat";
import { DateLipsa } from "./date-lipsa";

export const metadata: Metadata = { title: "Fișa angajatului" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

const CLASA_SECTIUNE = "rounded-panou border border-border bg-surface p-5 shadow-ridicat";

function Camp({
  eticheta,
  valoare,
}: {
  readonly eticheta: string;
  readonly valoare: string | null;
}) {
  const gol = valoare === null || valoare.length === 0;
  return (
    <div>
      <dt className="text-muted-foreground text-nota tracking-wide uppercase">{eticheta}</dt>
      <dd className={`text-corp mt-0.5 ${gol ? "text-muted-foreground/70 italic" : ""}`}>
        {gol ? "Necompletat" : valoare}
      </dd>
    </div>
  );
}

function GrupCampuri({
  titlu,
  children,
}: {
  readonly titlu: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="border-border border-t pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-muted-foreground text-nota mb-2 font-semibold tracking-wide uppercase">
        {titlu}
      </h3>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</dl>
    </div>
  );
}

function StareGoala({ mesaj }: { readonly mesaj: string }) {
  return (
    <p className="border-border text-muted-foreground rounded-control text-corp border border-dashed px-3 py-4 text-center">
      {mesaj}
    </p>
  );
}

export default async function PaginaFisaAngajat({ params }: ProprietatiPagina) {
  const { id } = await params;
  const utilizator = await requireUser();
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "nucleu");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);
  const scope = scopeFor(permisiuni, "employees:read") ?? undefined;

  if (scope === undefined) {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta fișele de personal." />;
  }

  const propriaFisaId =
    scope === "all" ? null : await idFisaProprie(tenant.organizationId, utilizator.id);
  const angajat = await citesteAngajat(tenant.organizationId, id, scope, propriaFisaId);
  if (angajat === null) notFound();

  /*
   * ── UN SINGUR VAL, NU OPT ─────────────────────────────────────────────
   * Pagina asta era cea mai grea din tot produsul: opt `await` pe rând, unul
   * după altul, niciunul dependent de rezultatul precedentului — toate au
   * nevoie doar de `angajat`, care e deja în mână. Opt dus-întors înlănțuite
   * la ~27 ms fiecare, plus valurile învelișului deasupra.
   *
   * Porțile de permisiune se evaluează ÎNAINTE, sincron: ele decid dacă o
   * interogare pleacă deloc. `Promise.resolve(…)` pe ramura refuzată păstrează
   * exact semantica de dinainte — nicio interogare, nicio schimbare de tip.
   */
  const poateAdaugaScutire = can(permisiuni, "payroll:create", "all");
  const poateAdaugaComponenta = can(permisiuni, "payroll:create", "all");
  // Cheie proprie din 0070; politicile au urmat-o în 0071. Până atunci poarta
  // din bază era `employees:update`, pe care managerul nu o are la niciun
  // scope: acțiunea trecea de preambul și baza o refuza cu 42501, deci
  // formularul era în fapt exclusiv al HR-ului și al administratorului,
  // contrar cerinței „managerul direct".
  const poateCreaEvaluare = can(permisiuni, "evaluations:create", "team");
  const poateEditaEvaluare = can(permisiuni, "evaluations:update", "team");
  // Invitarea are permisiune PROPRIE (0099), separată de `employees:update`:
  // ea consumă un loc din `seats_limit` și creează un cont, nu editează o fișă.
  // Stă printre porțile de sus fiindcă decide dacă pleacă interogarea de mai
  // jos — `invitations_select` cere `users:read` sau `employees:invite`, deci
  // pentru un manager ar fi fost oricum zero rânduri.
  const poateInvita = can(permisiuni, "employees:invite", "all");

  const dbFisa = await createServerSupabase();

  const [
    rezumatSensibil,
    scutiriFiscale,
    componenteSalariale,
    evaluari,
    sabloaneEvaluareBrute,
    sabloaneComponente,
    lantManageri,
    dependentiRes,
    documenteEmiseRes,
    invitatiePendinte,
  ] = await Promise.all([
    // Datele sensibile nu se randează deloc dacă scope-ul nu acoperă întreaga organizație.
    scope === "all" ? citesteRezumatDateSensibile(tenant.organizationId, id) : null,
    scope === "all" ? citesteScutiriFiscale(tenant.organizationId, id) : [],
    scope === "all" ? citesteComponenteSalariale(tenant.organizationId, id) : [],
    evaluariAngajat(tenant.organizationId, id),
    // Șabloanele arhivate nu se pot alege la o evaluare nouă: acțiunea le
    // respinge oricum, iar un `<option>` care duce garantat la un refuz e mai
    // rău decât unul absent.
    poateCreaEvaluare ? listeazaSabloane(tenant.organizationId, { includeArhivate: false }) : [],
    scope === "all" && poateAdaugaComponenta
      ? dbFisa
          .from("salary_component_types")
          .select("id, denumire, kind")
          .or(`organization_id.eq.${tenant.organizationId},organization_id.is.null`)
          .eq("activ", true)
          .is("deleted_at", null)
          .order("denumire")
          .then(({ data }) => data ?? [])
      : [],
    lantulDeManageri(tenant.organizationId, angajat.manager_path, angajat.id),
    // Persoanele în întreținere (0069). RLS (`employee_dependents_select` →
    // `app.can_see_employee`) decide singură cine le vede; pagina nu filtrează.
    dbFisa
      .from("employee_dependents")
      .select("id, nume, relatie, data_nasterii, in_intretinere_de_la, in_intretinere_pana_la")
      .eq("organization_id", tenant.organizationId)
      .eq("employee_id", angajat.id)
      .is("deleted_at", null)
      .order("in_intretinere_de_la", { ascending: true })
      .returns<RandDependent[]>(),
    /*
     * Documentele EMISE de aplicație — contractul, fișa postului, acordul de
     * confidențialitate, anexa de proprietate intelectuală, actul adițional de
     * telemuncă. Cele cinci pe care înrolarea le generează dintr-un foc.
     *
     * ── DE CE NU ERAU AICI ────────────────────────────────────────────────
     * Stau în ALTĂ tabelă decât fișierele încărcate: `hr_issued_documents`, cu
     * numerotare proprie pe serie și amprentă SHA-256, față de
     * `employee_documents`. Secțiunea „Documente" citea doar embed-ul
     * `documents` din `citesteAngajat`, adică doar încărcările. Rezultat: omul
     * abia le vedea o dată, în ecranul de confirmare al înrolării, și pe fișă
     * scria „Nu există documente încărcate pentru acest angajat" — despre un
     * angajat cu cinci documente emise pe numele lui.
     *
     * `hr_issued_select` cere doar `app.can_see_employee`: cine a ajuns pe fișă
     * le poate vedea, fără nicio poartă în plus.
     */
    dbFisa
      .from("hr_issued_documents")
      .select("id, titlu, numar_afisat, emis_la, anulat_la")
      .eq("organization_id", tenant.organizationId)
      .eq("employee_id", angajat.id)
      .is("deleted_at", null)
      .order("emis_la", { ascending: false })
      .limit(50),
    /*
     * Invitația plecată și încă neacceptată, dacă există.
     *
     * `maybeSingle()` e sigur: `invitations_employee_pending_uq` (0099) permite
     * o singură invitație în așteptare per fișă. Fără rândul ăsta, butonul
     * spunea „Invită în aplicație" și răspundea „există deja o invitație" —
     * starea era vizibilă doar prin refuz.
     */
    poateInvita && angajat.user_id === null
      ? dbFisa
          .from("invitations")
          .select("email, expires_at")
          .eq("organization_id", tenant.organizationId)
          .eq("employee_id", angajat.id)
          .eq("status", "pending")
          .is("deleted_at", null)
          .maybeSingle()
          .then(({ data }) => data)
      : null,
  ]);

  // Aruncat, nu înghițit cu `?? []`: o listă goală din cauza unei erori arată
  // exact ca dosarul gol al unui angajat nou, iar asta e chiar defectul reparat
  // mai sus. Eroarea ajunge la `angajati/error.tsx`, care are buton de reîncărcare.
  if (documenteEmiseRes.error !== null) {
    throw new Error("Nu am putut încărca documentele emise ale angajatului.");
  }
  const documenteEmise = documenteEmiseRes.data;

  const sabloaneEvaluare = sabloaneEvaluareBrute.map((s) => ({
    id: s.id,
    denumire: s.denumire,
    criterii: s.criterii,
  }));

  /*
   * TOATE contractele active, nu doar primul găsit.
   *
   * Codul de dinainte lua `find(...)` și băga restul în blocul pliat „Istoric
   * contracte și acte adiționale". La cumul de funcții — caz pe care lista
   * chiar îl marchează, prin `is_primary` și eticheta „(cumul de funcții)" —
   * al doilea contract ACTIV ajungea sub eticheta „istoric", lângă cele
   * încetate. Că nu era intenționat se vedea chiar acolo: blocul pliat testa
   * `contract.status === "activ"` ca să ofere butonul de încetare, adică oferea
   * încetarea unui contract dintr-o secțiune numită istoric.
   *
   * `contractPrincipal` rămâne primul activ de bază: el guvernează formularul
   * de modificare salarială de la baza secțiunii.
   */
  const contracteActive = angajat.contracts.filter((c) => c.status === "activ");
  const contractPrincipal =
    contracteActive.find((c) => !c.este_act_aditional) ?? contracteActive[0] ?? null;
  const contracteIstoric = angajat.contracts.filter((c) => c.status !== "activ");

  const esteFisaProprie = angajat.user_id === utilizator.id;
  const poateIncarcaPtOricine = can(permisiuni, "users:update", "all");
  const poateEditaAngajat = can(permisiuni, "employees:update", "all");
  // Pragul `team` e cel mai mic care deschide ecranul: `org_admin` are `all`
  // (toată firma), managerul `team` (doar echipa lui, restul îl oprește RLS).
  const poateAcordaPermisiuni = can(permisiuni, "roles:update", "team");
  const poateVedeaRegulileConcediu = can(permisiuni, "leave:read", "all");
  // Ștergerea are permisiune PROPRIE, nu `employees:update`: seed-ul o dă doar
  // lui `org_admin`, `hr` și `super_admin`, iar managerul — care poate edita
  // fișele echipei — nu o are deloc.
  const poateSterge = can(permisiuni, "employees:delete", "all");
  // Numărate doar când butonul chiar apare. Două `count` în plus la fiecare
  // deschidere de fișă, pentru un buton pe care jumătate din roluri nu-l văd,
  // ar fi cost curat.
  const [piediciStergere, roluriConturi] = await Promise.all([
    poateSterge ? piediciStergereAngajat(tenant.organizationId, angajat.id, esteFisaProprie) : null,
    rolurileConturilor(tenant.organizationId, [angajat.user_id]),
  ]);
  // Rolul din aplicație, dacă fișa are cont și dacă rolul spune ceva. Vezi nota
  // din `../etichete.ts`: e altă informație decât `status`, de aceea altă
  // insignă — și tot de acolo vine reștampilarea lui „Candidat”.
  const rolCont = rolAdministrativ(roluriConturi.get(angajat.user_id ?? "") ?? null);
  const stareAfisata = etichetaStare(angajat.status, rolCont);

  const dependenti = dependentiRes.data ?? [];

  // Nota „fără cont" și lanțul managerial coboară sub titlu, prin prop-ul
  // `file` al antetului: rămân în același bloc, nu ca frați ai lui.
  const notaFaraCont =
    poateIncarcaPtOricine && angajat.user_id === null ? (
      <p className="text-muted-foreground text-nota italic">
        Fără cont în portal — nu i se poate atașa o fotografie.
      </p>
    ) : null;
  const lantAfisat =
    lantManageri.length > 0 ? (
      <ol className="text-corp flex flex-wrap items-center gap-1.5">
        {lantManageri.map((veriga) => (
          <li key={veriga.id} className="flex items-center gap-1.5">
            <Link
              href={`/angajati/${veriga.id}`}
              className="border-border bg-background hover:border-primary/30 hover:bg-primary/5 inline-flex items-center gap-1.5 rounded-full border py-1 pr-3 pl-1 transition-colors"
            >
              <AvatarAngajat url={veriga.avatar_url} nume={veriga.full_name} marime="sm" />
              <span className="font-medium">{veriga.full_name}</span>
            </Link>
            <ChevronRight aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
          </li>
        ))}
        <li className="border-primary/30 bg-primary/5 inline-flex items-center gap-1.5 rounded-full border py-1 pr-3 pl-1">
          <AvatarAngajat url={angajat.avatar_url} nume={angajat.full_name} marime="sm" />
          <span className="text-primary font-semibold">{angajat.full_name}</span>
        </li>
      </ol>
    ) : angajat.manager_path.length > 1 ? (
      <p className="text-muted-foreground text-nota">
        Lanțul de manageri nu a putut fi determinat.
      </p>
    ) : null;
  const subAntet =
    notaFaraCont === null && lantAfisat === null ? null : (
      <div className="flex flex-col gap-2">
        {notaFaraCont}
        {lantAfisat}
      </div>
    );

  return (
    <div className="space-y-6">
      <div className={cn(CLASA_SECTIUNE, "flex flex-wrap items-start gap-4")}>
        {esteFisaProprie ? (
          <IncarcareAvatar
            urlInitial={angajat.avatar_url}
            nume={angajat.full_name}
            pregateste={pregatesteIncarcareAvatarulPropriu}
            salveaza={salveazaAvatarulPropriu}
          />
        ) : poateIncarcaPtOricine && angajat.user_id !== null ? (
          <IncarcareAvatarAdmin
            employeeId={angajat.id}
            urlInitial={angajat.avatar_url}
            nume={angajat.full_name}
          />
        ) : (
          <AvatarAngajat url={angajat.avatar_url} nume={angajat.full_name} marime="lg" />
        )}
        <AntetPagina
          className="min-w-0 flex-1"
          titlu={angajat.full_name}
          descriere={`Marca ${angajat.marca}${
            angajat.job_position !== null ? ` · ${angajat.job_position.denumire}` : ""
          }${angajat.department !== null ? ` · ${angajat.department.denumire}` : ""}`}
          actiuni={
            <>
              {poateAcordaPermisiuni ? (
                <Link
                  href={`/angajati/${angajat.id}/permisiuni`}
                  className={buton({ varianta: "secundar" })}
                >
                  <KeyRound aria-hidden="true" className="size-3.5" />
                  Permisiuni
                </Link>
              ) : null}
              {poateEditaAngajat ? (
                <Link
                  href={`/angajati/${angajat.id}/editeaza`}
                  className={buton({ varianta: "secundar" })}
                >
                  <Pencil aria-hidden="true" className="size-3.5" />
                  Editează fișa
                </Link>
              ) : null}
              {piediciStergere === null ? null : (
                <ButonStergeAngajat
                  id={angajat.id}
                  nume={angajat.full_name}
                  marca={angajat.marca}
                  status={stareAfisata}
                  piedici={piediciStergere}
                />
              )}
              {rolCont === null ? null : (
                <Badge className="text-corp px-3 py-1" ton="neutru">
                  {ETICHETE_ROL_CONT[rolCont]}
                </Badge>
              )}
              <Badge className="text-corp px-3 py-1" ton={TONURI_STATUS[angajat.status]}>
                {stareAfisata}
              </Badge>
            </>
          }
          {...(subAntet === null ? {} : { file: subAntet })}
        />
      </div>

      {/*
        Restanța de date, imediat sub antet.
        Fișele create înainte de 0097 n-au act de identitate complet și n-au
        adresă — verificat pe baza reală: toate 11. Fără semnalul ăsta,
        lipsa iese la lumină abia la prima emitere de contract sau la prima
        transmitere către ITM.
      */}
      <DateLipsa
        employeeId={angajat.id}
        poateEdita={poateEditaAngajat}
        fisa={{
          serie_act: angajat.serie_act,
          numar_act: angajat.numar_act,
          act_eliberat_de: angajat.act_eliberat_de,
          act_eliberat_la: angajat.act_eliberat_la,
          adresa_strada: angajat.adresa_strada,
          adresa_oras: angajat.adresa_oras,
          adresa_judet: angajat.adresa_judet,
          // `null` când actorul n-are dreptul de a vedea rezumatul sensibil:
          // atunci nu se poate ști dacă CNP-ul lipsește, iar o restanță
          // inventată e mai rea decât una netrecută în listă.
          cnpUltimele4: rezumatSensibil?.cnp_last4 ?? "—",
          cetatenie: angajat.cetatenie,
        }}
      />

      <section aria-labelledby="titlu-date-personale" className={CLASA_SECTIUNE}>
        <h2 id="titlu-date-personale" className="text-sectiune mb-4 font-medium">
          Date personale
        </h2>
        <div className="space-y-4">
          <GrupCampuri titlu="Identitate">
            <Camp eticheta="Nume" valoare={angajat.last_name} />
            <Camp eticheta="Prenume" valoare={angajat.first_name} />
            <Camp
              eticheta="Data nașterii"
              valoare={angajat.data_nasterii === null ? null : formatDate(angajat.data_nasterii)}
            />
            <Camp eticheta="Cetățenie" valoare={angajat.cetatenie} />
            <Camp
              eticheta="Angajat din"
              valoare={angajat.hired_on === null ? null : formatDate(angajat.hired_on)}
            />
          </GrupCampuri>
          <GrupCampuri titlu="Contact">
            <Camp eticheta="E-mail personal" valoare={angajat.email_personal} />
            <Camp eticheta="E-mail de serviciu" valoare={angajat.email_serviciu} />
            <Camp eticheta="Telefon" valoare={angajat.telefon} />
            <Camp
              eticheta="Adresă"
              valoare={[angajat.adresa_strada, angajat.adresa_oras, angajat.adresa_judet]
                .filter((v) => v !== null)
                .join(", ")}
            />
            <Camp
              eticheta="Contact de urgență"
              valoare={[angajat.contact_urgenta_nume, angajat.contact_urgenta_telefon]
                .filter((v) => v !== null)
                .join(" · ")}
            />
          </GrupCampuri>
          <GrupCampuri titlu="Situație personală">
            <Camp
              eticheta="Persoane în întreținere"
              valoare={String(angajat.nr_persoane_intretinere)}
            />
            <Camp eticheta="Grad de handicap" valoare={angajat.grad_handicap} />
          </GrupCampuri>
          {/*
            Accesul în aplicație. Apare DOAR când fișa n-are cont: odată legată,
            butonul n-ar avea ce face, iar prezența lui ar sugera că mai e ceva
            de apăsat. Verificat pe baza reală: 4 din 11 fișe active n-aveau
            `user_id`, adică exact oamenii pentru care s-a construit pontarea de
            pe telefon.
          */}
          {poateInvita && angajat.user_id === null ? (
            <div className="sm:col-span-2">
              <h3 className="text-muted-foreground text-nota mb-2 font-medium tracking-wide uppercase">
                Acces în aplicație
              </h3>
              <InvitatieAngajat
                employeeId={angajat.id}
                numeAngajat={angajat.full_name}
                numeFirma={tenant.name}
                pendinte={
                  invitatiePendinte === null
                    ? null
                    : { adresa: invitatiePendinte.email, expiraLa: invitatiePendinte.expires_at }
                }
              />
            </div>
          ) : null}

          <div className="sm:col-span-2">
            <h3 className="text-muted-foreground text-nota mb-2 font-medium tracking-wide uppercase">
              Persoane în întreținere
            </h3>
            <SectiuneDependenti
              employeeId={angajat.id}
              dependenti={dependenti}
              poateEdita={poateEditaAngajat}
            />
          </div>
        </div>
      </section>

      <section aria-labelledby="titlu-contracte" className={CLASA_SECTIUNE}>
        <h2 id="titlu-contracte" className="text-sectiune mb-4 font-medium">
          Contracte
        </h2>
        {angajat.contracts.length === 0 ? (
          <StareGoala mesaj="Fișa nu are încă niciun contract. Adăugați contractul individual de muncă înainte de transmiterea în REVISAL." />
        ) : (
          <div className="space-y-3">
            {contracteActive.length === 0 ? (
              <StareGoala mesaj="Niciun contract activ momentan." />
            ) : (
              contracteActive.map((contract) => (
                <div
                  key={contract.id}
                  className="border-primary/25 bg-primary/5 rounded-control border p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">Contract nr. {contract.numar}</span>
                    <span className="bg-success/12 text-success text-nota rounded-full px-2 py-0.5 font-medium">
                      {ETICHETE_CONTRACT[contract.status] ?? contract.status}
                    </span>
                    {contract.este_act_aditional ? (
                      <span className="bg-background text-nota rounded-full px-2 py-0.5">
                        Act adițional
                      </span>
                    ) : null}
                  </div>
                  <dl className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Camp
                      eticheta="Valabil"
                      valoare={`${formatDate(contract.valabil_de_la)} – ${contract.valabil_pana === null ? "nedeterminat" : formatDate(contract.valabil_pana)}`}
                    />
                    <Camp
                      eticheta="Normă"
                      valoare={`${String(contract.norma_ore_saptamana)} ore/săptămână`}
                    />
                    <Camp eticheta="Salariu de bază" valoare={formatLei(contract.salariu_baza)} />
                    <Camp
                      eticheta="Mod de lucru"
                      valoare={ETICHETE_MOD_LUCRU[contract.work_mode] ?? contract.work_mode}
                    />
                  </dl>
                  {poateEditaAngajat ? (
                    <div className="mt-3">
                      <FormularInceteazaContract contractId={contract.id} />
                    </div>
                  ) : null}
                </div>
              ))
            )}

            {contracteIstoric.length > 0 ? (
              <details className="group">
                <summary className="text-muted-foreground text-corp flex cursor-pointer list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden">
                  <ChevronRight
                    aria-hidden="true"
                    className="size-3.5 shrink-0 transition-transform group-open:rotate-90"
                  />
                  Contracte încheiate și acte adiționale inactive ({contracteIstoric.length})
                </summary>
                <ul className="border-border mt-2 space-y-2 border-l-2 pl-4">
                  {contracteIstoric.map((contract) => (
                    <li key={contract.id} className="border-border rounded-control border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">Contract nr. {contract.numar}</span>
                        {contract.este_act_aditional ? (
                          <span className="bg-surface text-nota rounded-full px-2 py-0.5">
                            Act adițional
                          </span>
                        ) : null}
                        <span className="text-muted-foreground text-nota ml-auto">
                          {ETICHETE_CONTRACT[contract.status] ?? contract.status}
                        </span>
                      </div>
                      <dl className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <Camp
                          eticheta="Valabil"
                          valoare={`${formatDate(contract.valabil_de_la)} – ${contract.valabil_pana === null ? "nedeterminat" : formatDate(contract.valabil_pana)}`}
                        />
                        <Camp
                          eticheta="Normă"
                          valoare={`${String(contract.norma_ore_saptamana)} ore/săptămână`}
                        />
                        <Camp
                          eticheta="Salariu de bază"
                          valoare={formatLei(contract.salariu_baza)}
                        />
                        <Camp
                          eticheta="Mod de lucru"
                          valoare={ETICHETE_MOD_LUCRU[contract.work_mode] ?? contract.work_mode}
                        />
                        {contract.incetat_la !== null ? (
                          <Camp eticheta="Încetat la" valoare={formatDate(contract.incetat_la)} />
                        ) : null}
                        {contract.motiv_incetare !== null ? (
                          <Camp eticheta="Motivul încetării" valoare={contract.motiv_incetare} />
                        ) : null}
                      </dl>
                      {/* Aici NU mai apare butonul de încetare: blocul conține,
                          prin construcție, numai contracte care nu mai sunt
                          active. Când conținea și active, oferea încetarea unui
                          contract dintr-o secțiune numită „istoric". */}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        )}

        <div className="mt-4">
          {contractPrincipal === null ? (
            can(permisiuni, "employees:create", "all") ? (
              <FormularContractNou employeeId={angajat.id} />
            ) : null
          ) : poateEditaAngajat ? (
            <FormularModificaSalariu
              contractId={contractPrincipal.id}
              salariuActual={contractPrincipal.salariu_baza}
            />
          ) : null}
        </div>
      </section>

      <SectiuneConcedii
        organizationId={tenant.organizationId}
        employeeId={angajat.id}
        hiredOn={angajat.hired_on}
        dataNasterii={angajat.data_nasterii}
        conditiiMunca={angajat.conditii_munca}
        gradHandicap={angajat.grad_handicap}
        departmentId={angajat.department?.id ?? null}
        jobPositionId={angajat.job_position?.id ?? null}
        poateVedeaRegulile={poateVedeaRegulileConcediu}
      />

      {scope === "all" ? (
        <section aria-labelledby="titlu-scutiri" className={CLASA_SECTIUNE}>
          <h2 id="titlu-scutiri" className="text-sectiune mb-4 font-medium">
            Scutiri fiscale
          </h2>
          {scutiriFiscale.length === 0 ? (
            <StareGoala mesaj="Angajatul nu are nicio scutire fiscală înregistrată." />
          ) : (
            <ul className="space-y-3">
              {scutiriFiscale.map((scutire) => (
                <li key={scutire.id} className="border-border rounded-control border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {ETICHETE_SCUTIRE[scutire.exemption_type as keyof typeof ETICHETE_SCUTIRE] ??
                        scutire.exemption_type}
                    </span>
                    {scutire.procent_scutire === null ? (
                      <span className="bg-warning/12 text-nota rounded-full px-2 py-0.5 font-medium">
                        Fără procent — nu se aplică automat
                      </span>
                    ) : (
                      <span className="bg-success/12 text-success text-nota rounded-full px-2 py-0.5 font-medium">
                        {scutire.procent_scutire}%
                      </span>
                    )}
                  </div>
                  <dl className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Camp
                      eticheta="Valabil"
                      valoare={`${formatDate(scutire.valabil_de_la)} – ${scutire.valabil_pana === null ? "nedeterminat" : formatDate(scutire.valabil_pana)}`}
                    />
                    <Camp
                      eticheta="Plafon lunar"
                      valoare={
                        scutire.plafon_lunar === null ? null : formatLei(scutire.plafon_lunar)
                      }
                    />
                    <Camp eticheta="Temei legal" valoare={scutire.temei_legal} />
                  </dl>
                </li>
              ))}
            </ul>
          )}
          {poateAdaugaScutire ? (
            <div className="mt-4">
              <FormularScutireFiscala employeeId={angajat.id} />
            </div>
          ) : null}
        </section>
      ) : null}

      {scope === "all" ? (
        <section aria-labelledby="titlu-componente" className={CLASA_SECTIUNE}>
          <h2 id="titlu-componente" className="text-sectiune mb-4 font-medium">
            Sporuri și prime
          </h2>
          {componenteSalariale.length === 0 ? (
            <StareGoala mesaj="Angajatul nu are niciun spor sau primă asociat(ă)." />
          ) : (
            <ul className="space-y-3">
              {componenteSalariale.map((componenta) => {
                const activa =
                  componenta.valabil_pana === null ||
                  componenta.valabil_pana >= new Date().toISOString().slice(0, 10);
                const denumireComponenta =
                  componenta.component_type?.denumire ??
                  ETICHETE_TIP_COMPONENTA[componenta.kind] ??
                  componenta.kind;
                return (
                  <li key={componenta.id} className="border-border rounded-control border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{denumireComponenta}</span>
                      <span className="bg-primary/10 text-primary text-nota rounded-full px-2 py-0.5 font-medium">
                        {componenta.procent !== null
                          ? `${String(componenta.procent)}%`
                          : formatLei(componenta.suma ?? 0)}
                      </span>
                      {!activa ? (
                        <span className="bg-background text-muted-foreground text-nota rounded-full px-2 py-0.5 font-medium">
                          Încheiată
                        </span>
                      ) : null}
                      {activa && poateAdaugaComponenta ? (
                        <span className="ml-auto">
                          <ButonIncheieComponenta
                            id={componenta.id}
                            employeeId={angajat.id}
                            denumire={denumireComponenta}
                          />
                        </span>
                      ) : null}
                    </div>
                    <dl className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <Camp
                        eticheta="Valabil"
                        valoare={`${formatDate(componenta.valabil_de_la)} – ${componenta.valabil_pana === null ? "nedeterminat" : formatDate(componenta.valabil_pana)}`}
                      />
                      <Camp eticheta="Observații" valoare={componenta.observatii} />
                    </dl>
                  </li>
                );
              })}
            </ul>
          )}
          {poateAdaugaComponenta ? (
            <div className="mt-4">
              <FormularComponentaSalariala employeeId={angajat.id} sabloane={sabloaneComponente} />
            </div>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="titlu-evaluari" className={CLASA_SECTIUNE}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="titlu-evaluari" className="text-sectiune font-medium">
            Evaluări
          </h2>
          {poateCreaEvaluare && sabloaneEvaluare.length > 0 ? (
            <ButonEvaluareNoua employeeId={angajat.id} sabloane={sabloaneEvaluare} />
          ) : null}
        </div>

        {evaluari.length === 0 ? (
          <StareGoala mesaj="Angajatul nu are nicio evaluare înregistrată." />
        ) : (
          <ul className="space-y-3">
            {evaluari.map((evaluare) => {
              const criteriiDupaCod = new Map(evaluare.criterii.map((c) => [c.cod, c]));
              return (
                <li key={evaluare.id} className="border-border rounded-panou border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{evaluare.sablon ?? "Șablon șters"}</span>
                    {evaluare.versiune_sablon === null ? null : (
                      <span className="text-muted-foreground text-nota tabular-nums">
                        v{evaluare.versiune_sablon}
                      </span>
                    )}
                    <span className="text-muted-foreground text-corp">
                      {formatDate(evaluare.data_evaluarii)}
                    </span>
                    <Badge ton={TONURI_STATUS_EVALUARE[evaluare.status]}>
                      {ETICHETE_STATUS_EVALUARE[evaluare.status]}
                    </Badge>
                  </div>

                  {evaluare.punctaj.procent === null ? null : (
                    <div className="mt-2 max-w-sm">
                      <Nivel
                        valoare={evaluare.punctaj.procent}
                        din={100}
                        marime="subtire"
                        ton={tonPunctaj(evaluare.punctaj.procent)}
                        eticheta={`Punctajul evaluării din ${formatDate(evaluare.data_evaluarii)}`}
                        text={
                          evaluare.punctaj.necompletate === 0
                            ? `${String(evaluare.punctaj.procent)} %`
                            : `${String(evaluare.punctaj.procent)} % pe ${String(evaluare.punctaj.completate)} din ${String(evaluare.criterii.length)} criterii`
                        }
                      />
                    </div>
                  )}

                  {/* Criteriile vin din INSTANTANEUL evaluării, nu din șablonul
                      de azi: denumirea și scala sunt cele de la momentul
                      notării. Un criteriu nenotat se scrie „—", nu „0". */}
                  <ul className="text-nota mt-2 flex flex-wrap gap-2">
                    {evaluare.raspunsuri.map((raspuns) => {
                      const criteriu = criteriiDupaCod.get(raspuns.criteriu_cod);
                      if (criteriu === undefined) return null;
                      return (
                        <li
                          key={raspuns.criteriu_cod}
                          className="bg-background border-border rounded-full border px-2.5 py-1"
                        >
                          {criteriu.denumire}
                          {": "}
                          {criteriu.tip === "text" ? (
                            <span className="text-muted-foreground">
                              {raspuns.raspuns_text ?? "—"}
                            </span>
                          ) : raspuns.scor === null ? (
                            <span className="text-muted-foreground">nenotat</span>
                          ) : criteriu.tip === "da_nu" ? (
                            <span className="tabular-nums">{raspuns.scor === 1 ? "da" : "nu"}</span>
                          ) : (
                            <span className="tabular-nums">
                              {raspuns.scor}/{criteriu.scala_max}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  {evaluare.concluzie === null ? null : (
                    <p className="text-muted-foreground text-corp mt-2">{evaluare.concluzie}</p>
                  )}

                  {/* Ciorna se poate corecta; evaluarea finalizată e imuabilă
                      pentru scope-ul de echipă, prin politica din 0071. */}
                  {evaluare.status === "draft" && poateEditaEvaluare ? (
                    <div className="mt-3">
                      <ButonContinuaCiorna
                        employeeId={angajat.id}
                        sabloane={sabloaneEvaluare}
                        ciorna={{
                          id: evaluare.id,
                          data_evaluarii: evaluare.data_evaluarii,
                          concluzie: evaluare.concluzie,
                          criterii: evaluare.criterii,
                          raspunsuri: evaluare.raspunsuri,
                          sablon: evaluare.sablon,
                        }}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        {poateCreaEvaluare && sabloaneEvaluare.length === 0 ? (
          <FormularEvaluareNoua employeeId={angajat.id} sabloane={sabloaneEvaluare} />
        ) : null}
      </section>

      {/*
       * Secțiunea listează documentele, dar descărcarea, încărcarea și
       * retragerea trăiesc pe `/angajati/[id]/documente` — o pagină completă
       * către care, până acum, nu ducea NICIUN link din tot `src`. Se ajungea
       * la ea doar tastând adresa, deci documentele de pe fișă erau o listă
       * din care nu se putea deschide nimic.
       */}
      <section aria-labelledby="titlu-documente" className={CLASA_SECTIUNE}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="titlu-documente" className="text-sectiune font-medium">
            Documente
            {/* Numărătoarea le cuprinde pe amândouă. Cât timp arăta doar
                încărcările, un angajat cu cinci documente emise afișa „(0)". */}
            {documenteEmise.length + angajat.documents.length > 0 ? (
              <span className="text-muted-foreground ml-2 font-normal">
                ({documenteEmise.length + angajat.documents.length})
              </span>
            ) : null}
          </h2>
          <Link
            href={`/angajati/${angajat.id}/documente`}
            className={buton({ varianta: "secundar" })}
          >
            <FolderOpen aria-hidden="true" className="size-3.5" />
            Deschide dosarul
          </Link>
        </div>

        {documenteEmise.length === 0 ? null : (
          <div className="mb-5">
            <h3 className="text-muted-foreground text-nota mb-1 font-medium tracking-wide uppercase">
              Emise de aplicație
            </h3>
            <p className="text-muted-foreground text-nota mb-2">
              Generate din șabloane, cu număr propriu și amprentă. Se deschid ca PDF.
            </p>
            <ul className="divide-border text-corp divide-y">
              {documenteEmise.map((document) => (
                <li key={document.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <FileCheck aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
                  {/*
                   * Direct la PDF, într-o filă nouă. Ruta `/documente/[id]` e
                   * deja publică pentru cine poate vedea fișa (RLS:
                   * `hr_issued_select`), deci nu mai trece prin dosar.
                   */}
                  <Link
                    href={`/documente/${document.id}?format=pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 flex-1 font-medium underline-offset-2 hover:underline"
                  >
                    {document.titlu}
                  </Link>
                  {document.anulat_la === null ? null : <Badge ton="neutru">Anulat</Badge>}
                  <span className="text-muted-foreground shrink-0">
                    {document.numar_afisat} · {formatDate(document.emis_la)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {documenteEmise.length === 0 ? null : (
          <h3 className="text-muted-foreground text-nota mb-2 font-medium tracking-wide uppercase">
            Încărcate în dosar
          </h3>
        )}
        {angajat.documents.length === 0 ? (
          <StareGoala
            mesaj={
              documenteEmise.length === 0
                ? "Nu există documente pentru acest angajat. Dosarul se completează din „Deschide dosarul”."
                : "Niciun fișier încărcat în dosar. Se încarcă din „Deschide dosarul”."
            }
          />
        ) : (
          <ul className="divide-border text-corp divide-y">
            {angajat.documents.map((document) => (
              <li key={document.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <FileText aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
                <Link
                  href={`/angajati/${angajat.id}/documente`}
                  className="min-w-0 flex-1 font-medium underline-offset-2 hover:underline"
                >
                  {document.titlu}
                </Link>
                {document.confidential ? <Badge ton="atentie">Confidențial</Badge> : null}
                <span className="text-muted-foreground shrink-0">
                  {document.data_document === null ? "—" : formatDate(document.data_document)}
                  {document.valabil_pana !== null
                    ? ` · expiră ${formatDate(document.valabil_pana)}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {rezumatSensibil !== null ? (
        <DateSensibile
          employeeId={angajat.id}
          cnpUltimele4={rezumatSensibil.cnp_last4}
          ibanUltimele4={rezumatSensibil.iban_last4}
          banca={rezumatSensibil.banca}
        />
      ) : null}
    </div>
  );
}
