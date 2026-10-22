// src/app/(app)/flota/foi/[id]/page.tsx
import { ListaDefinitii } from "@/components/ui/lista-definitii";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { getEnabledFeatures, requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import { idDinRuta } from "@/lib/rute/parametri";
import { abatereConsum, abatereNotabila, consumLa100Km } from "@/domain/fleet/consum";
import {
  alimentarileFoii,
  angajatiDupaId,
  anomaliiPeFoi,
  citesteFoaie,
  curseleFoii,
  numeleContului,
  sabloaneTraseu,
  uiturileFoii,
  urlSemnateFlota,
  vehiculeDupaId,
} from "@/lib/queries/fleet";

import { ETICHETE_STATUS_FOAIE, formatConsum, TONURI_STATUS_FOAIE } from "../../etichete";
import { ActiuniFoaie } from "./actiuni-foaie";
import { ButonStergePeFoaie } from "./buton-sterge-pe-foaie";
import { DialogAlimentare } from "./dialog-alimentare";
import { DialogAntetFoaie } from "./dialog-antet-foaie";
import { SectiuneCurse } from "./sectiune-curse";
import { SoferulFoii } from "./soferul-foii";
import { LinkEntitate } from "@/components/ui/link-entitate";
import { hrefFisa } from "@/lib/navigare/fisa";
import { legaturaSigura } from "@/config/porti-ruta";
import { requireUser } from "@/lib/auth/current-user";
import { idFisaProprie } from "@/lib/queries/employees";
import { DecizieFoaie } from "../../aprobari/decizie-foaie";
import { NumarRegistru } from "@/components/registru/numar-registru";
import { IncarcareFisierFlota } from "../../incarcare-fisier-flota";
import { LinkBon } from "./link-bon";
import { PastileBon } from "./pastile-bon";
import { citireaBonuluiDisponibila } from "@/lib/fleet/citire-bon";

export const metadata: Metadata = { title: "Foaie de parcurs" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function PaginaFoaie({ params }: ProprietatiPagina) {
  const id = idDinRuta((await params).id);

  const { tenant } = await requireTenant();
  const utilizator = await requireUser();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni, module] = await Promise.all([
    requireFeature(tenant.organizationId, "fleet"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
    getEnabledFeatures(tenant.organizationId),
  ]);

  if (!can(permisiuni, "trip_sheets:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta foile de parcurs. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const foaie = await citesteFoaie(tenant.organizationId, id);
  if (foaie === null) notFound();

  const [alimentari, vehicule, soferi, anomalii, curse, aprobator, uituri] = await Promise.all([
    alimentarileFoii(foaie.id),
    vehiculeDupaId(tenant.organizationId, [foaie.vehicle_id]),
    angajatiDupaId(tenant.organizationId, foaie.employee_id === null ? [] : [foaie.employee_id]),
    anomaliiPeFoi(tenant.organizationId, [foaie.id]),
    curseleFoii(tenant.organizationId, foaie.id),
    foaie.aprobat_de === null ? Promise.resolve(null) : numeleContului(foaie.aprobat_de),
    uiturileFoii(tenant.organizationId, foaie.id),
  ]);

  const vehicul = vehicule.get(foaie.vehicle_id);
  const sofer = foaie.employee_id === null ? undefined : soferi.get(foaie.employee_id);
  const poateScrieUndeva = can(permisiuni, "trip_sheets:update", "own");
  const scrieOricare = scopeFor(permisiuni, "trip_sheets:update") === "all";
  // Decizia pe fișa foii (precedentul /concedii/[id]): aprobatorul venit din
  // coadă sau din notificare decide aici. Propria foaie e refuzată de trigger;
  // butoanele nu se arată deloc pentru ea.
  const poateAproba = can(permisiuni, "trip_sheets:approve", "team");
  const propriaFisaId =
    (poateAproba && foaie.status === "trimis") || (poateScrieUndeva && !scrieOricare)
      ? await idFisaProprie(tenant.organizationId, utilizator.id)
      : null;
  /*
   * Închiderea, alimentarea și redeschiderea: doar pe foaia PROPRIE, sub `all`.
   * Din 0199 managerul are `trip_sheets:update = own` și vede foile echipei;
   * fără condiția pe șofer, formularele ar fi apărut și pe foaia subordonatului,
   * iar baza le-ar fi refuzat (`foi_parcurs_inainte` §C2: aprobatorul doar
   * decide). Un buton care duce sigur într-un refuz e un defect de ecran.
   */
  const poateScrie =
    poateScrieUndeva &&
    (scrieOricare || (foaie.employee_id !== null && foaie.employee_id === propriaFisaId));
  const poateDecideAici =
    poateAproba &&
    foaie.status === "trimis" &&
    (foaie.employee_id === null || propriaFisaId !== foaie.employee_id);
  // 0200 §D1: cursele, alimentările și antetul se scriu doar pe ciornă.
  const editabil = poateScrie && foaie.status === "draft";
  const sabloane = editabil ? await sabloaneTraseu(tenant.organizationId) : [];

  // Titlul și subtitlul se compun ca text: `AntetPagina` cere `string`, iar
  // conținutul rămâne cuvânt cu cuvânt cel de dinainte.
  // Instantaneul de la trimitere bate vehiculul de azi: documentul nu se
  // schimbă retroactiv, iar aprobatorul fără drept pe vehicul îl vede totuși.
  const titlu = `${foaie.vehicul_nr ?? vehicul?.nr_inmatriculare ?? "Vehicul indisponibil"}${
    foaie.numar === null ? "" : ` · ${foaie.numar}`
  }`;
  const descriere = (
    <>
      {`Foaia zilei ${formatDate(foaie.data)}`}
      {sofer === undefined ? null : (
        <>
          {" · "}
          <LinkEntitate href={hrefFisa(sofer, permisiuni)}>
            {sofer.full_name ?? sofer.marca}
          </LinkEntitate>
        </>
      )}
      {vehicul === undefined ? null : (
        <>
          {" · "}
          <LinkEntitate
            href={legaturaSigura(`/flota/${foaie.vehicle_id}`, {
              features: module,
              permissions: permisiuni,
            })}
          >
            fișa vehiculului
          </LinkEntitate>
        </>
      )}
    </>
  );

  const litriTotali = alimentari.reduce((s, a) => s + a.litri, 0);
  const costTotal = alimentari.reduce((s, a) => s + a.cost, 0);
  // Formula a plecat în `@/domain/fleet/consum`: coada de aprobare avea nevoie
  // de exact aceeași cifră, iar a doua copie scrisă în JSX pe alt ecran e felul
  // în care două pagini ajung să arate două consumuri pentru aceeași cursă.
  const consumReal = consumLa100Km(litriTotali, foaie.km_parcursi);
  const abatere = abatereConsum(consumReal, vehicul?.consum_mediu_declarat ?? null);
  const aleFoii = anomalii.get(foaie.id) ?? [];
  // Pozele bonurilor (0202), semnate sub sesiunea omului: aprobatorul vede
  // bonul lângă litri, șoferul îl vede pe al lui.
  const urlBonuri = await urlSemnateFlota(alimentari.map((a) => a.fisier_bon_path));

  // Fără sortare: alimentările unei curse se citesc întregi, în ordinea orei, și
  // n-au cursor keyset.
  const coloaneAlimentari: readonly Coloana<(typeof alimentari)[number]>[] = [
    {
      cheie: "data",
      antet: "Data",
      latime: "ingusta",
      peTelefon: "titlu",
      celula: (a) => formatDateTime(new Date(a.alimentat_la)),
    },
    {
      cheie: "statie",
      antet: "Stație",
      peTelefon: "meta",
      celula: (a) => a.statie ?? "—",
    },
    {
      // „Plin” contează la consum: între două plinuri, litrii alimentați sunt
      // exact cât s-a consumat. Fără marcaj, cifra de consum e o estimare.
      cheie: "bon",
      antet: "Bon",
      peTelefon: "meta",
      celula: (a) => (
        <>
          {a.numar_bon ?? "—"}
          {a.plin ? <span className="text-muted-foreground"> · plin</span> : null}
          <LinkBon cale={a.fisier_bon_path} urluri={urlBonuri} />
          <PastileBon alimentare={a} />
          {a.observatii === null ? null : (
            <span className="text-muted-foreground block text-xs">{a.observatii}</span>
          )}
        </>
      ),
    },
    {
      cheie: "litri",
      antet: "Litri",
      numeric: true,
      peTelefon: "meta",
      celula: (a) => a.litri,
    },
    {
      cheie: "cost",
      antet: "Cost",
      numeric: true,
      peTelefon: "meta",
      celula: (a) => formatLei(a.cost),
    },
    {
      cheie: "pret",
      antet: "Preț/litru",
      numeric: true,
      peTelefon: "meta",
      celula: (a) => (a.pret_litru === null ? "—" : formatLei(a.pret_litru)),
    },
    ...(editabil
      ? ([
          {
            cheie: "actiuni",
            antet: "Acțiuni",
            peTelefon: "actiuni",
            celula: (a: (typeof alimentari)[number]) => (
              <span className="flex justify-end gap-1">
                <DialogAlimentare foaieId={foaie.id} alimentare={a} />
                <IncarcareFisierFlota
                  tinta={{ fel: "bon", alimentareId: a.id, foaieId: foaie.id }}
                  descriere={`${String(a.litri)} l, ${formatDateTime(new Date(a.alimentat_la))}`}
                  areFisier={a.fisier_bon_path !== null}
                />
                <ButonStergePeFoaie
                  fel="alimentare"
                  id={a.id}
                  foaieId={foaie.id}
                  descriere={`${String(a.litri)} l, ${formatDateTime(new Date(a.alimentat_la))}`}
                />
              </span>
            ),
          },
        ] satisfies Coloana<(typeof alimentari)[number]>[])
      : []),
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-muted-foreground text-corp">
          <Link href="/flota/foi" className="underline-offset-2 hover:underline">
            Foi de parcurs
          </Link>
        </p>
        <AntetPagina
          titlu={titlu}
          descriere={descriere}
          actiuni={
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Badge ton={TONURI_STATUS_FOAIE[foaie.status]}>
                {ETICHETE_STATUS_FOAIE[foaie.status]}
              </Badge>
              {/* Documentul justificativ: numărul, vehiculul, cursele, norma,
                  aprobarea. Ruta judecă singură dreptul, prin RLS. */}
              <a
                href={`/api/export/flota/foaie/${foaie.id}`}
                className="text-corp underline underline-offset-2"
              >
                Descarcă PDF
              </a>
              {editabil ? (
                <DialogAntetFoaie
                  foaieId={foaie.id}
                  areCurse={curse.length > 0}
                  plecareLa={foaie.plecare_la}
                  kmPlecare={foaie.km_plecare}
                  traseu={foaie.traseu}
                  scop={foaie.scop}
                  observatii={foaie.observatii}
                />
              ) : null}
            </div>
          }
        />
        {foaie.status === "aprobat" && foaie.aprobat_la !== null ? (
          <p className="text-muted-foreground text-corp">
            Aprobată de {aprobator ?? "—"} la {formatDateTime(new Date(foaie.aprobat_la))}.
          </p>
        ) : null}
        {/* Drumul înapoi spre registru: numărul de înregistrare, dacă există (prin RLS). */}
        <NumarRegistru tenant={tenant} entitateTip="trip_sheets" entitateId={foaie.id} />
      </div>

      {foaie.status === "respins" ? (
        <div
          role="alert"
          className="border-danger/40 bg-danger/8 text-corp rounded-panou border p-4"
        >
          <p className="font-medium">Foaia a fost respinsă</p>
          {/* Castul de aici — `(foaie as { motiv_respingere?: string | null })` —
              era o promisiune neverificată: dacă selectul ar fi pierdut coloana,
              ecranul ar fi scris „Nu a fost consemnat niciun motiv.” pentru o
              respingere motivată. Acum `citesteFoaie` întoarce tipul `Foaie`. */}
          <p className="mt-1">{foaie.motiv_respingere ?? "Nu a fost consemnat niciun motiv."}</p>
        </div>
      ) : null}

      {/* Avertismentul de salt de kilometraj trăia doar în `useState`-ul
          formularului de trimitere, iar `router.refresh()` de pe rândul următor
          îl ștergea: la prima reîncărcare foaia arăta identic cu una curată,
          deși anomalia era în bază, legată chiar de ea prin `trip_sheet_id`.
          Aici se citește de pe server, deci rămâne cât timp există. */}
      {aleFoii.map((a) => {
        // `diferenta` e GENERATED ALWAYS în bază; ocolirea acoperă doar rândurile
        // vechi, dinainte de coloană. Semnul e explicit: un regres e negativ.
        const diferenta = a.diferenta ?? a.km_declarat - a.km_asteptat;
        const semn = diferenta < 0 ? "−" : "+";
        return (
          <Callout
            key={a.id}
            fel="atentie"
            titlu={`Anomalie de kilometraj: ${semn}${Math.abs(diferenta).toLocaleString("ro-RO")} km`}
            actiune={
              <Link href="/flota/anomalii" className="text-corp underline underline-offset-2">
                Vezi anomaliile
              </Link>
            }
          >
            Ultimul kilometraj cunoscut al vehiculului era {a.km_asteptat.toLocaleString("ro-RO")}{" "}
            km, iar foaia declară {a.km_declarat.toLocaleString("ro-RO")} km.
            {a.explicatie === null ? null : ` ${a.explicatie}`}
            {a.confirmat_la === null
              ? " Diferența nu blochează foaia, dar cineva trebuie să o explice."
              : ` Explicată: ${a.nota ?? "fără notă"}.`}
          </Callout>
        );
      })}

      {/* ── flota F9 (0204): verificările șoferului și legătura cu deplasarea ── */}
      <SoferulFoii
        organizationId={tenant.organizationId}
        foaie={foaie}
        curse={curse}
        editabil={editabil}
        permisiuni={permisiuni}
        bazaDeplasare="/diurna"
      />

      {/* ── flota F12f (0217): încadrarea e-Transport și codurile UIT stau pe cursă ── */}
      <SectiuneCurse
        foaieId={foaie.id}
        curse={curse}
        editabil={editabil}
        kmPlecareFoaie={foaie.km_plecare ?? 0}
        sabloane={sabloane}
        ziuaFoii={foaie.data}
        uituri={uituri}
        masaVehiculKg={vehicul?.masa_maxima_kg ?? null}
      />

      <section aria-label="Kilometraj și consum" className="border-border rounded-panou border p-4">
        {/* Același defect ca în fluturaș: `<dt>`/`<dd>` într-un `<div>`, fără
            niciun `<dl>` în fișier — perechea nu exista pentru cititorul de
            ecran. Iar `?? "—"` nu spunea dacă valoarea lipsește sau nu se
            aplică; primitiva primește valoarea brută și scrie cuvântul o dată. */}
        <ListaDefinitii
          coloane={4}
          textNecompletat="Neînregistrat"
          definitii={[
            {
              eticheta: "Plecare",
              valoare:
                foaie.km_plecare === null ? null : `${foaie.km_plecare.toLocaleString("ro-RO")} km`,
            },
            {
              eticheta: "Sosire",
              valoare:
                foaie.km_sosire === null ? null : `${foaie.km_sosire.toLocaleString("ro-RO")} km`,
            },
            {
              // „cursă în desfășurare” NU e o valoare lipsă: e o stare reală a
              // foii, iar „Neînregistrat” ar fi sugerat că cineva a uitat.
              eticheta: "Parcurs (bord)",
              valoare:
                foaie.km_parcursi === null
                  ? "cursă în desfășurare"
                  : `${foaie.km_parcursi.toLocaleString("ro-RO")} km`,
            },
            {
              // Cifra izolată n-avea niciun verdict: 9,4 l/100 km e bine sau rău
              // doar față de ce declară vehiculul.
              eticheta: "Consum real",
              valoare:
                consumReal === null ? null : (
                  <>
                    {formatConsum(consumReal)}
                    {abatere === null ? null : (
                      <span
                        className={
                          abatereNotabila(abatere)
                            ? "text-danger ml-1 font-medium"
                            : "text-muted-foreground ml-1"
                        }
                      >
                        ({abatere < 0 ? "−" : "+"}
                        {Math.abs(Math.round(abatere))}% față de declarat)
                      </span>
                    )}
                  </>
                ),
            },
          ]}
        />
      </section>

      {foaie.traseu === null && foaie.scop === null && foaie.observatii === null ? null : (
        <section aria-label="Traseu, scop și observații" className="text-corp space-y-1">
          {foaie.traseu === null ? null : (
            <p>
              <span className="text-muted-foreground">Traseul pe scurt: </span>
              {foaie.traseu}
            </p>
          )}
          {foaie.scop === null ? null : (
            <p>
              <span className="text-muted-foreground">Scop: </span>
              {foaie.scop}
            </p>
          )}
          {/* `observatii` era selectat de `citesteFoaie` și nu apărea nicăieri:
              cine îl completa printr-o altă cale scria într-un câmp pe care
              produsul nu-l arăta niciodată înapoi. */}
          {foaie.observatii === null ? null : (
            <p>
              <span className="text-muted-foreground">Observații: </span>
              {foaie.observatii}
            </p>
          )}
        </section>
      )}

      <section aria-labelledby="alimentari" className="space-y-3">
        <h2 id="alimentari" className="text-sectiune font-semibold">
          Alimentări
        </h2>
        <Tabel
          caption="Alimentările înregistrate pe această cursă."
          coloane={coloaneAlimentari}
          randuri={alimentari}
          cheieRand={(a) => a.id}
          gol={
            <p className="text-muted-foreground text-corp">
              Nicio alimentare înregistrată pe această cursă.
            </p>
          }
          subsol={
            <tr>
              <td className="px-4 py-3" colSpan={3}>
                Total
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{litriTotali.toFixed(2)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatLei(costTotal)}</td>
              <td className="px-4 py-3" />
              {editabil ? <td className="px-4 py-3" /> : null}
            </tr>
          }
        />
      </section>

      {poateDecideAici ? (
        <section
          aria-labelledby="titlu-decizie"
          className="border-primary/30 bg-primary/5 rounded-panou border p-4"
        >
          <h2 id="titlu-decizie" className="text-sectiune mb-2 font-medium">
            Decizia dumneavoastră
          </h2>
          <DecizieFoaie id={foaie.id} />
        </section>
      ) : null}

      {poateScrie ? (
        <ActiuniFoaie
          id={foaie.id}
          status={foaie.status}
          numar={foaie.numar}
          poateAnula={scrieOricare}
          plecareLa={foaie.plecare_la}
          sosireLa={foaie.sosire_la}
          areCurse={curse.length > 0}
          bazaFoi="/flota/foi"
          poateCitiBonul={citireaBonuluiDisponibila(module, permisiuni)}
        />
      ) : null}
    </div>
  );
}
