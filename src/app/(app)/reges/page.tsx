// src/app/(app)/reges/page.tsx
import { FileCheck2 } from "lucide-react";
import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { buton } from "@/components/ui/buton";
import { StareGoala } from "@/components/ui/stare-goala";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { meetsScope } from "@/config/permissions";
import { requireFeature } from "@/lib/auth/features";
import { getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/format/date";
import {
  FILTRE_IMPLICITE,
  idOrganizatie,
  interogheazaEvenimenteReges,
  interogheazaMesajeReges,
  interogheazaPropuneriReges,
  propuneriDeRaspuns,
  type FiltruStare,
  type RandMesaj,
} from "@/lib/queries/reges";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import {
  ETICHETE_OPERATIE,
  ETICHETE_STARE_MESAJ,
  ETICHETE_STATUS,
  ETICHETE_TIP,
  OPTIUNI_STARE,
} from "./constante";
import { ActiuniEveniment, ButonExport } from "./actiuni-client";
import { ButonAnuleazaMesaj, ButonPregateste, ButonTransmite } from "./coada-client";
import { NavReges } from "./nav-reges";

export const metadata = { title: "REGES-Online — evidența evenimentelor" };

const STARI_VALIDE: readonly FiltruStare[] = ["toate", "intarziate", "de_transmis", "transmise"];

function esteStare(valoare: string | undefined): valoare is FiltruStare {
  return valoare !== undefined && STARI_VALIDE.includes(valoare as FiltruStare);
}

const CLASA_STARE: Record<string, string> = {
  intarziat: "bg-danger/8 text-danger ring-1 ring-danger/40",
  astazi: "bg-warning/12 text-foreground ring-1 ring-warning/40",
  in_termen: "bg-surface text-foreground ring-1 ring-border",
  transmis: "bg-surface text-foreground ring-1 ring-success/40",
  anulat: "bg-surface text-muted-foreground ring-1 ring-border",
};

export default async function PaginaReges(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "reges"), // modul dezactivat ⇒ 404
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  const scopCitire = scopeFor(permisiuni, "reges:read") ?? undefined;
  if (!meetsScope(scopCitire, "all")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta registrul general de evidență a salariaților. Solicitați administratorului firmei permisiunea „REGES — citire”." />
    );
  }
  const poateActualiza = meetsScope(scopeFor(permisiuni, "reges:update") ?? undefined, "all");
  const poatePregati = meetsScope(scopeFor(permisiuni, "reges:create") ?? undefined, "all");
  const poateTransmite = meetsScope(scopeFor(permisiuni, "reges:transmit") ?? undefined, "all");
  const poateExporta = meetsScope(scopeFor(permisiuni, "reges:export") ?? undefined, "all");
  const poateConfigura = meetsScope(scopeFor(permisiuni, "reges:configure") ?? undefined, "all");

  const parametri = await props.searchParams;
  const stareBruta = Array.isArray(parametri["stare"]) ? parametri["stare"][0] : parametri["stare"];
  const filtre = { ...FILTRE_IMPLICITE, stare: esteStare(stareBruta) ? stareBruta : "toate" };

  const supabase = await createServerSupabase();
  const organizationId = idOrganizatie(tenant);
  // Propunerile se citesc și aici, dar NU se randează: din ele iese doar cifra
  // de pe fila „Propuneri detașare". Citirea completă, în locul unui `count()`
  // separat, e ce ține pastila legată de listă — vezi `propuneriDeRaspuns`.
  // Firma cea mai mare din producție are 8 salariați; costul e o interogare în
  // paralel cu celelalte două, nu un rând în plus de latență.
  const [{ randuri, statistici, azi }, coada, propuneri] = await Promise.all([
    interogheazaEvenimenteReges(supabase, organizationId, filtre),
    interogheazaMesajeReges(supabase, organizationId),
    interogheazaPropuneriReges(supabase, organizationId),
  ]);

  // Coada de mesaje API — un strat SUB registrul de evenimente, nu în locul lui.
  // Un eveniment legal („angajare") se traduce în unul sau două mesaje REGES, iar
  // al doilea nu poate pleca până nu vine identificatorul salariatului din primul.
  const COLOANE_MESAJE: readonly Coloana<RandMesaj>[] = [
    {
      cheie: "operatie",
      antet: "Operație",
      peTelefon: "titlu",
      celula: (m) => (
        <span className="text-foreground">
          {ETICHETE_OPERATIE[m.operatie] ?? m.operatie}
          <span className="text-muted-foreground text-nota block">
            {m.angajatNume ?? "—"}
            {m.contractNumar === null ? "" : ` · CIM ${m.contractNumar}`}
          </span>
        </span>
      ),
    },
    {
      cheie: "stare",
      antet: "Stare",
      celula: (m) => (
        <span className="text-foreground">
          {ETICHETE_STARE_MESAJ[m.stare] ?? m.stare}
          {m.rezultatMesaj === null && m.eroare === null ? null : (
            <span className="text-muted-foreground text-nota block">
              {m.rezultatMesaj ?? m.eroare}
            </span>
          )}
        </span>
      ),
    },
    {
      cheie: "referinta",
      antet: "Identificator REGES",
      celula: (m) =>
        m.referintaId === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <code className="text-nota">{m.referintaId}</code>
        ),
    },
    {
      cheie: "trimis",
      antet: "Trimis",
      celula: (m) => (m.trimisLa === null ? "—" : formatDate(m.trimisLa.slice(0, 10))),
    },
    {
      cheie: "actiuni",
      antet: "Acțiuni",
      peTelefon: "insigna",
      celula: (m) => {
        if (m.stare !== "de_transmis") return <span className="text-muted-foreground">—</span>;
        return (
          <div className="space-y-2">
            {m.tip === "salariat" && poateTransmite ? (
              <ButonTransmite
                mesajId={m.id}
                numeAngajat={m.angajatNume ?? "salariat"}
                transmisibil={m.transmisibil}
              />
            ) : (
              <span className="text-muted-foreground text-nota">
                {m.transmisibil
                  ? "Pleacă la următoarea reconciliere"
                  : "Așteaptă mesajul precedent"}
              </span>
            )}
            {poateActualiza ? <ButonAnuleazaMesaj mesajId={m.id} /> : null}
          </div>
        );
      },
    },
  ];

  /**
   * Nicio coloană nu e `sortabil`: citirea REGES n-are cursor, ordinea după
   * termenul de transmitere e chiar rostul registrului, iar un antet care pare
   * sortabil și nu face nimic e mai rău decât unul care nu pare.
   *
   * Coloana de acțiuni e `insigna`, nu `meta`: pe telefon, `meta` randează
   * într-un `<p>`, iar formularul de marcare e un `<div>` — un `<div>` într-un
   * `<p>` rupe HTML-ul la parsare și dă nepotrivire de hidratare. Ca `insigna`
   * stă în afara paragrafului, deasupra linkului care acoperă cardul, deci
   * rămâne apăsabilă.
   */
  const coloane: readonly Coloana<(typeof randuri)[number]>[] = [
    {
      cheie: "salariat",
      antet: "Salariat",
      peTelefon: "titlu",
      celula: (rand) => (
        <>
          <span className="text-foreground font-medium">{rand.angajatNume}</span>
          <span className="text-muted-foreground text-nota block">
            Marca {rand.angajatMarca}
            {rand.contractNumar === null ? "" : ` · CIM ${rand.contractNumar}`}
          </span>
        </>
      ),
    },
    {
      cheie: "eveniment",
      antet: "Eveniment",
      peTelefon: "meta",
      celula: (rand) => ETICHETE_TIP[rand.tip],
    },
    {
      cheie: "data",
      antet: "Data",
      peTelefon: "meta",
      celula: (rand) => <span className="tabular-nums">{formatDate(rand.dataEvenimentului)}</span>,
    },
    {
      cheie: "termen",
      antet: "Termen",
      peTelefon: "meta",
      celula: (rand) => <span className="tabular-nums">{formatDate(rand.termenTransmitere)}</span>,
    },
    {
      cheie: "stare",
      antet: "Stare",
      peTelefon: "insigna",
      celula: (rand) => (
        <>
          <span
            className={`text-nota inline-block rounded px-2 py-0.5 font-medium ${CLASA_STARE[rand.stare] ?? ""}`}
          >
            {rand.stare === "intarziat"
              ? `Întârziat cu ${rand.zileIntarziere} ${rand.zileIntarziere === 1 ? "zi" : "zile"}`
              : rand.stare === "astazi"
                ? "Termen astăzi"
                : rand.stare === "in_termen"
                  ? `Mai sunt ${rand.zileRamase} ${rand.zileRamase === 1 ? "zi" : "zile"}`
                  : ETICHETE_STATUS[rand.status]}
          </span>
          {rand.eroare === null ? null : (
            <span className="text-danger text-nota mt-1 block">{rand.eroare}</span>
          )}
        </>
      ),
    },
    {
      cheie: "itm",
      antet: "Înregistrare ITM",
      peTelefon: "meta",
      celula: (rand) => rand.numarInregistrare ?? "—",
    },
    {
      cheie: "actiuni",
      antet: "Acțiuni",
      peTelefon: "insigna",
      // Două drumuri, deliberat. „Pregătește" traduce evenimentul în mesaje API
      // și e drumul normal de acum înainte. „Marchează transmis" rămâne pentru
      // evenimentele rezolvate ÎN AFARA aplicației — direct din portalul ITM —
      // altfel registrul ar arăta la nesfârșit restanțe care nu există.
      celula: (rand) =>
        rand.stare === "transmis" || rand.stare === "anulat" ? (
          <span className="text-muted-foreground text-nota">Nimic de făcut</span>
        ) : (
          <div className="space-y-2">
            {poatePregati ? <ButonPregateste evenimentId={rand.id} /> : null}
            {poateActualiza ? (
              <ActiuniEveniment evenimentId={rand.id} numeAngajat={rand.angajatNume} azi={azi} />
            ) : null}
            {!poatePregati && !poateActualiza ? (
              <span className="text-muted-foreground text-nota">Fără drept de transmitere</span>
            ) : null}
          </div>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      {/*
        „Chei API" era buton de acțiune în antet; acum e a treia filă a benzii.
        Un modul nu-și ține navigarea în două locuri — cine caută secțiunile
        REGES le găsește pe toate pe același rând.
      */}
      <AntetPagina
        titlu="REGES-Online (fost Revisal)"
        descriere={`Registrul general de evidență a salariaților. Netransmiterea în termen a unui eveniment este contravenție, separat pentru fiecare salariat. Situația la ${formatDate(azi)}.`}
        file={
          <NavReges
            activ="registru"
            poateCiti
            poateConfigura={poateConfigura}
            propuneriDeRaspuns={propuneriDeRaspuns(propuneri)}
          />
        }
      />

      {/*
        Cifrele se numără în bază, pe tot registrul, nu peste rândurile afișate:
        pe filtrul „Transmise” fișa „Întârziate” arăta 0, iar peste 100 de
        evenimente toate patru erau mai mici decât realitatea. De aceea, când un
        filtru e activ, se spune explicit că sinteza nu-l urmează.
      */}
      <section aria-label="Situația întregului registru" className="space-y-2">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            {
              eticheta: "Întârziate",
              valoare: statistici.intarziate,
              clasa: CLASA_STARE["intarziat"],
            },
            { eticheta: "Cu termen azi", valoare: statistici.astazi, clasa: CLASA_STARE["astazi"] },
            {
              eticheta: "În termen",
              valoare: statistici.inTermen,
              clasa: CLASA_STARE["in_termen"],
            },
            {
              eticheta: "Transmise",
              valoare: statistici.transmise,
              clasa: CLASA_STARE["transmis"],
            },
          ].map((fisa) => (
            <div key={fisa.eticheta} className={`rounded-panou p-4 ${fisa.clasa ?? ""}`}>
              <p className="text-corp font-medium">{fisa.eticheta}</p>
              <p className="text-cifra font-semibold tabular-nums">{fisa.valoare}</p>
            </div>
          ))}
        </div>
        {filtre.stare === "toate" ? null : (
          <p className="text-muted-foreground text-nota">
            Cifrele de mai sus privesc întregul registru, nu filtrul ales.
          </p>
        )}
      </section>

      <nav aria-label="Filtrare după stare" className="flex flex-wrap gap-2">
        {OPTIUNI_STARE.map((optiune) => {
          const activ = optiune.valoare === filtre.stare;
          return (
            <a
              key={optiune.valoare}
              href={`/reges?stare=${optiune.valoare}`}
              aria-current={activ ? "page" : undefined}
              className={buton({ varianta: activ ? "primar" : "secundar" })}
            >
              {optiune.eticheta}
            </a>
          );
        })}
        {poateExporta ? <ButonExport /> : null}
      </nav>

      {randuri.length === 0 ? (
        <StareGoala
          fel="filtrata"
          pictograma={FileCheck2}
          titlu="Niciun eveniment pentru filtrul ales"
          descriere="Evenimentele de raportat se creează automat la înregistrarea unui contract, la modificarea salariului, a funcției sau a normei, la suspendare și la încetare."
          actiune={{ eticheta: "Vezi angajații", href: "/angajati" }}
        />
      ) : (
        <Tabel
          caption="Evenimente REGES-Online, ordonate după termenul de transmitere"
          coloane={coloane}
          randuri={randuri}
          cheieRand={(rand) => rand.id}
          href={(rand) => `/angajati/${rand.angajatId}`}
          densitate="compact"
          gol={null}
          // Citirea taie la `filtre.limita` rânduri, fără să spună. Într-un
          // registru unde netransmiterea în termen e contravenție per salariat,
          // un eveniment care nu se vede e mai rău decât o eroare.
          trunchiat={randuri.length >= filtre.limita}
        />
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-foreground font-medium">Mesaje către Inspecția Muncii</h2>
          <p className="text-muted-foreground text-nota">
            {coada.statistici.deTransmis} de transmis · {coada.statistici.asteapta} în așteptare ·{" "}
            {coada.statistici.esuate} respinse · {coada.statistici.reusite} confirmate
          </p>
        </div>
        <Tabel
          caption="Coada de mesaje REGES-Online"
          coloane={COLOANE_MESAJE}
          randuri={coada.randuri}
          cheieRand={(m) => m.id}
          // Rândul duce la detaliu: acolo se vede ce clasificare va pleca la ITM,
          // se corectează înainte de transmitere și se citește jurnalul apelurilor.
          href={(m) => `/reges/${m.id}`}
          densitate="compact"
          gol={
            <StareGoala
              fel="initiala"
              pictograma={FileCheck2}
              titlu="Nu e nimic de transmis"
              descriere="Un eveniment din registrul de mai sus devine mesaj abia după «Pregătește pentru REGES». Până atunci nu pleacă nimic."
            />
          }
        />
      </section>
    </div>
  );
}
