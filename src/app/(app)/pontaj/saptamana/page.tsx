// src/app/(app)/pontaj/saptamana/page.tsx
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { buton } from "@/components/ui/buton";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { todayInBucharest } from "@/lib/format/date";
import { angajatiPentruPontaj, idFisaProprie } from "@/lib/queries/employees";
import { citesteSaptamanaPontaj, intrariLuna, setariPontaj } from "@/lib/queries/attendance";
import { adaugaZile, esteLuni, lunieaUrmatoare } from "@/domain/attendance/saptamana";
import { ziuaInitialaPlan } from "@/domain/attendance/plan-si-fapt";

import { NavPontaj } from "../nav-pontaj";
import { fileDePontaj } from "../file-pontaj";
import { TONURI_STARE_SAPTAMANA, etichetaStareSaptamana, rezumatRegulaPontaj } from "../etichete";
import type { ConfigZi } from "@/domain/attendance/calcul-ore";

import { FormularSaptamana } from "./formular-saptamana";
import { AlegeAngajat } from "./alege-angajat";

export const metadata: Metadata = { title: "Planul săptămânii" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PaginaSaptamanaPontaj({ searchParams }: ProprietatiPagina) {
  const { user, tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "attendance"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "attendance:create", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a completa un plan de prezență. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;
  const parametruSaptamana = parametri["saptamana"];
  const saptamanaCeruta = typeof parametruSaptamana === "string" ? parametruSaptamana : "";
  const saptamanaStart = esteLuni(saptamanaCeruta)
    ? saptamanaCeruta
    : lunieaUrmatoare(todayInBucharest());

  // ── PENTRU CINE SE COMPLETEAZĂ SĂPTĂMÂNA (0084) ──────────────────────────
  // Ecranul era personal prin construcție: citea și scria exclusiv săptămâna
  // celui care privea. Patronul — `attendance:create = all` — vedea orele
  // tuturor în foaia colectivă, dar nu putea deschide planul nimănui, nici
  // măcar ca să-l corecteze; iar dacă n-avea fișă proprie (cazul obișnuit
  // înainte de 0077), ecranul îi răspundea cu un refuz de ACCES, deși drepturi
  // avea toate.
  //
  // Selectorul se oferă DOAR la scope `all`. La `team`, `app.poate_scrie_pontaj`
  // ar accepta subalternii, dar lista ar trebui filtrată la subarborele lui —
  // altfel ecranul arată nume pe care baza le refuză la salvare, adică exact
  // butonul care se vede și nu funcționează. Se poate adăuga separat.
  const poateAlegeAngajat = can(permisiuni, "attendance:create", "all");
  const parametruAngajat = parametri["angajat"];
  const angajatCerut =
    poateAlegeAngajat && typeof parametruAngajat === "string" && parametruAngajat.length > 0
      ? parametruAngajat
      : null;

  /*
    Trei citiri independente, un singur val.
    Erau în serie: fișa proprie, lista de angajați, apoi — după două ramuri de
    ieșire și după `submisie` — setările. Niciuna dintre cele trei nu depinde de
    alta; doar `submisie` are nevoie de `fisaTinta`.

    Setările se citesc și pe ramurile de ieșire, unde nu se folosesc: o
    interogare în plus pe un drum rar (cont fără fișă proprie), în schimbul unui
    val mai puțin pe drumul normal.

    A patra citire, `zileNelucratoare`, a dispărut odată cu poarta
    `esteZiLucratoare` de mai jos: singurul ei consumator golea câmpuri care
    aveau ore salvate. Sărbătorile rămân treaba calculului de ore, nu a
    implicitelor din formular.
  */
  const [propriaFisaId, angajati, setari, fileNav] = await Promise.all([
    idFisaProprie(tenant.organizationId, user.id),
    poateAlegeAngajat ? angajatiPentruPontaj(tenant.organizationId) : [],
    setariPontaj(tenant.organizationId, saptamanaStart),
    // A patra: ce file se desenează. `poateAproba` din ea ține cont și de
    // alegerea firmei de a avea un pas de aprobare (0118), nu doar de
    // permisiune — vezi `file-pontaj.ts`.
    fileDePontaj(tenant.organizationId, permisiuni),
  ]);
  const fisaTinta = angajatCerut ?? propriaFisaId;

  // Fără fișă proprie ȘI fără drept de a alege pe altcineva nu există nicio
  // săptămână de arătat. Mesajul spune ce lipsește — o fișă — nu „acces
  // restricționat", care trimite omul să-și caute drepturi pe care le are.
  if (fisaTinta === null && !poateAlegeAngajat) {
    return (
      <AccesRestrictionat mesaj="Contul dvs. nu este legat de o fișă de angajat principală în această organizație, deci nu are o săptămână proprie de planificat. Cereți-i administratorului să vă creeze fișa." />
    );
  }

  if (fisaTinta === null) {
    return (
      <div className="space-y-6">
        <AntetPagina
          titlu="Planul săptămânii"
          descriere="Contul dumneavoastră nu are fișă de angajat proprie, deci nu are nici săptămână proprie. Alegeți angajatul pentru care completați."
          file={<NavPontaj {...fileNav} />}
        />
        <AlegeAngajat angajati={angajati} selectat={null} saptamanaStart={saptamanaStart} />
      </div>
    );
  }

  /*
    Planul săptămânii și ce s-a pontat efectiv în ea (0118).

    Până acum ecranul ăsta arăta DOAR planul: pontai marți de acasă, trăgând
    peste grila orară, și „Planul săptămânii" continua să spună „La birou".
    Adică exact ecranul care se trimite spre aprobare contrazicea ecranul din
    care se pontează.

    `intrariLuna(org, [fisa], …)`, nu `intrariProprii`: aceea NU filtrează pe
    `employee_id` și se bazează pe RLS, care pentru scope `all` nu îngustează
    nimic — un `hr` ar fi primit pontajul întregii firme peste planul unui singur
    om. Aceeași capcană e scrisă în `sectiune-saptamana.tsx`.
  */
  const [submisie, pontate] = await Promise.all([
    citesteSaptamanaPontaj(tenant.organizationId, fisaTinta, saptamanaStart),
    intrariLuna(tenant.organizationId, [fisaTinta], saptamanaStart, adaugaZile(saptamanaStart, 6)),
  ]);

  /*
   * Implicitul se calcula ca 8 ore „La birou” pentru toate cele ȘAPTE zile,
   * sâmbăta și duminica incluse: cine deschidea ecranul și apăsa direct
   * „Trimite spre aprobare” declara 56 de ore planificate pe săptămână, dintre
   * care 16 într-un weekend pe care nu-l alesese nimeni. Norma zilnică vine
   * din `attendance_settings` (fără rând de setări, 8 — același implicit ca în
   * `celula-zi.tsx`), iar zilele nelucrătoare pornesc de la 0: le poate ridica
   * oricine are nevoie, dar acum e o alegere, nu o valoare moștenită.
   */
  const orePeZi = setari?.ore_pe_zi ?? 8;

  const zileInitiale = Array.from({ length: 7 }, (_, i) => {
    const data = adaugaZile(saptamanaStart, i);
    return ziuaInitialaPlan(
      data,
      submisie?.zile.find((z) => z.data === data) ?? null,
      pontate.find((z) => z.data === data) ?? null,
    );
  });

  // Parametrii după care se derivă orele — aceiași ca la ziua individuală și ca
  // în `trimiteSaptamanaPontaj`, care rescrie oricum cifra pe server.
  const config: ConfigZi = {
    orePeZi,
    noapteStart: setari?.noapte_start.slice(0, 5) ?? "22:00",
    noapteSfarsit: setari?.noapte_sfarsit.slice(0, 5) ?? "06:00",
    pauzaMinute: setari?.pauza_masa_minute ?? 0,
    pauzaInclusaInProgram: setari?.pauza_masa_inclusa_in_program ?? true,
    pauzaObligatoriePesteOre: setari?.pauza_obligatorie_peste_ore ?? 0,
  };

  // Săptămâna deja trimisă își păstrează declarația; una nouă pornete de la ce a
  // bifat firma în /pontaj/setări (0080).
  const lucreazaWeekendInitial = submisie?.lucreazaWeekend ?? setari?.lucreaza_weekend ?? false;

  /*
    Într-o firmă FĂRĂ pas de aprobare, `aprobata` e pusă de trigger chiar la
    trimitere (0118 §3) — deci fără ramura a doua, planul s-ar îngheța la prima
    apăsare, cu un mesaj despre o decizie pe care n-a luat-o nimeni. Perechea de
    server a ramurii ăsteia e în upsert-ul lui `trimite_saptamana_pontaj`
    (0118 §5); despărțite, ecranul ar oferi un buton pe care baza îl refuză.
  */
  const poateEdita =
    submisie === null || submisie.status !== "aprobata" || !fileNav.necesitaAprobare;
  const inceputSaptamanii = new Date(`${saptamanaStart}T00:00:00Z`).toLocaleDateString("ro-RO");

  // Persoana aleasă călătorește prin navigarea între săptămâni; fără ea,
  // „Săptămâna următoare" ar sări înapoi pe fișa proprie.
  const contextAngajat = fisaTinta === propriaFisaId ? "" : `&angajat=${fisaTinta}`;

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Planul săptămânii"
        descriere={`Declarați, pentru săptămâna care începe ${inceputSaptamanii}, cum veniți la lucru și câte ore planificați — editabil oricând, până la decizia managerului.`}
        file={<NavPontaj {...fileNav} />}
      />

      {poateAlegeAngajat ? (
        <AlegeAngajat angajati={angajati} selectat={fisaTinta} saptamanaStart={saptamanaStart} />
      ) : null}

      <nav aria-label="Alege săptămâna" className="flex flex-wrap items-center gap-3">
        <Link
          href={`/pontaj/saptamana?saptamana=${adaugaZile(saptamanaStart, -7)}${contextAngajat}`}
          className={buton({ varianta: "secundar" })}
        >
          ← Săptămâna anterioară
        </Link>
        <Link
          href={`/pontaj/saptamana?saptamana=${adaugaZile(saptamanaStart, 7)}${contextAngajat}`}
          className={buton({ varianta: "secundar" })}
        >
          Săptămâna următoare →
        </Link>
        {submisie === null ? null : (
          <Badge ton={TONURI_STARE_SAPTAMANA[submisie.status]}>
            {etichetaStareSaptamana(submisie.status, fileNav.necesitaAprobare)}
          </Badge>
        )}
      </nav>

      {submisie?.status === "respinsa" && submisie.motivRespingere !== null ? (
        <p className="border-danger/40 bg-danger/8 text-danger rounded-panou text-corp border p-3">
          <strong>Motivul respingerii:</strong> {submisie.motivRespingere}
        </p>
      ) : null}

      {/*
        `key` pe săptămână, nu decor: formularul ține zilele în `useState`,
        inițializat din props. La navigarea pe client către altă săptămână, React
        găsește același tip de componență în aceeași poziție și REUTILIZEAZĂ
        instanța — argumentul lui `useState` se citește doar la montare, deci
        tabelul rămânea pe zilele săptămânii precedente. Antetul se schimba (e
        randat pe server), tabelul nu, iar butoanele „Anterioară"/„Următoarea"
        păreau moarte. Cheia schimbată forțează remontarea.
      */}
      <FormularSaptamana
        key={saptamanaStart}
        saptamanaStart={saptamanaStart}
        zileInitiale={zileInitiale}
        poateEdita={poateEdita}
        necesitaAprobare={fileNav.necesitaAprobare}
        config={config}
        // Regula se compune pentru ÎNCEPUTUL săptămânii, aceeași dată pentru
        // care s-au citit setările — altfel textul ar putea descrie altă
        // versiune decât cea din care ies cifrele.
        regulaFirmei={rezumatRegulaPontaj(config, setari !== null)}
        lucreazaWeekendInitial={lucreazaWeekendInitial}
        employeeId={fisaTinta === propriaFisaId ? null : fisaTinta}
      />
    </div>
  );
}
