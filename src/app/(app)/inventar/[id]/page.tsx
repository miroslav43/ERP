// src/app/(app)/inventar/[id]/page.tsx
import { Package, Ticket } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { Indicator } from "@/components/ui/indicator";
import { ListaDefinitii } from "@/components/ui/lista-definitii";
import { Nivel } from "@/components/ui/nivel";
import { Scadenta } from "@/components/ui/scadenta";
import { StareGoala } from "@/components/ui/stare-goala";
import {
  CAMPURI_FISA,
  campuriCompletate,
  custodie,
  evenimenteFisa,
  treaptaGarantie,
  zileInEvidenta,
} from "@/domain/inventory/fisa";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { getEnabledFeatures, requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, toBucharestDateString, todayInBucharest } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import {
  angajatiActivi,
  categorii,
  citesteObiect,
  istoricAlocari,
  numeleAngajatilor,
} from "@/lib/queries/inventory";
import { listeazaTicheteleObiectului } from "@/lib/queries/ticketing";
import { cn } from "@/lib/ui/cn";

import { ETICHETE_STARE, ETICHETE_STATUS, TONURI_STARE, TONURI_STATUS } from "../etichete";
import {
  ETICHETE_STATUS as ETICHETE_STATUS_TICHET,
  TONURI_STATUS as TONURI_STATUS_TICHET,
} from "../../ticketing/etichete";
import { ButonCasare } from "./buton-casare";
import { Cronologie } from "./cronologie";
import { CardCustodie } from "./custodie";
import { DialogObiect } from "./dialog-obiect";
import { idDinRuta } from "@/lib/rute/parametri";

export const metadata: Metadata = { title: "Fișa obiectului de inventar" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

/**
 * Ritmul fișei: un card ridicat pentru antet, apoi secțiuni de aceeași
 * greutate. E clasa fișei angajatului (`angajati/[id]/page.tsx`), singura din
 * `(app)` care aplică elevația — fișa asta avea până acum chenare plate, deci
 * nimic nu spunea care e obiectul și care e comentariul despre el.
 */
const CLASA_SECTIUNE = "border-border bg-surface rounded-panou border p-5 shadow-ridicat";

export default async function PaginaFisaObiect({ params }: ProprietatiPagina) {
  const id = idDinRuta((await params).id);
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "inventory");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);
  const scope = scopeFor(permisiuni, "inventory:read");

  if (scope === null || scope === "none") {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta fișele de inventar." />;
  }

  const obiect = await citesteObiect(tenant.organizationId, id);
  if (obiect === null) notFound();

  /*
    `getEnabledFeatures` e memoizat cu `React.cache()` și l-a cerut deja
    `(app)/layout.tsx`, deci așteptarea de aici nu costă niciun drum la bază —
    dar deblochează poarta de modul ÎNAINTE de valul următor. Așa, tichetele
    intră în `Promise.all` în loc să fie un val propriu după el.
  */
  const moduleActive = await getEnabledFeatures(tenant.organizationId);

  const poateScrie = can(permisiuni, "inventory:update", "all");

  const [istoric, listaCategorii, tichete, angajatiDePredare] = await Promise.all([
    istoricAlocari(tenant.organizationId, id),
    categorii(),
    // Modulul de ticketing e opțional: dacă nu e activ la organizație, secțiunea
    // cu tichete nu se randează deloc, în loc să arate o listă goală derutantă.
    moduleActive.has("ticketing") ? listeazaTicheteleObiectului(obiect.id) : null,
    /*
      Lista de angajați se cere doar când se poate preda. Caseta se montează
      abia la deschidere, deci `<select>`-ul nu costă nimic până atunci — dar
      datele trebuie să existe pe server la randarea fișei, fiindcă dialogul e
      componentă de client și nu poate citi singur din bază.
    */
    poateScrie ? angajatiActivi(tenant.organizationId) : [],
  ]);

  const angajati = await numeleAngajatilor(
    tenant.organizationId,
    istoric.map((rand) => rand.employee_id),
  );

  const categorieNume =
    obiect.category_id === null
      ? null
      : (listaCategorii.find((cat) => cat.id === obiect.category_id)?.denumire ?? null);
  const alocareDeschisa = istoric.find((rand) => rand.returnat_la === null) ?? null;

  const stareCustodie = custodie(
    obiect,
    alocareDeschisa,
    alocareDeschisa === null
      ? null
      : (angajati.get(alocareDeschisa.employee_id)?.full_name ?? null),
  );
  const poateCasa = poateScrie && stareCustodie.fel !== "alocat" && obiect.status !== "casat";

  const azi = todayInBucharest();
  const completate = campuriCompletate(obiect);
  const fisaIntreaga = completate === CAMPURI_FISA.length;
  const numeNume = new Map(
    [...angajati].map(([idAngajat, angajat]) => [idAngajat, angajat.full_name] as const),
  );

  return (
    <div className={cn(LATIMI.detaliu, "space-y-6")}>
      <div className={cn(CLASA_SECTIUNE, "@container")}>
        <div className="flex flex-col gap-4 @2xl:flex-row @2xl:items-start">
          {/*
            Fișa angajatului are avatar; obiectul n-are chip. Pictograma e cea
            cu care modulul se numește peste tot — `navigation.ts` și
            `features.ts` folosesc amândouă `Package` — deci pastila leagă fișa
            de meniul din care s-a ajuns la ea, în loc să inventeze un simbol.
          */}
          <span
            aria-hidden="true"
            className="bg-primary text-primary-foreground rounded-panou flex size-16 shrink-0 items-center justify-center"
          >
            <Package className="size-8" />
          </span>

          <AntetPagina
            className="min-w-0 @2xl:flex-1"
            firimituri={[{ eticheta: "Inventar", href: "/inventar" }]}
            titlu={obiect.denumire}
            descriere={
              <>
                Nr. inventar <span className="font-mono">{obiect.numar_inventar}</span>
                {categorieNume === null ? " · Necategorizat" : ` · ${categorieNume}`}
              </>
            }
            {...(poateScrie
              ? {
                  actiuni: (
                    <>
                      <DialogObiect
                        obiect={obiect}
                        categorii={listaCategorii}
                        eticheta={fisaIntreaga ? "Editează" : "Completează"}
                      />
                      {poateCasa ? (
                        <ButonCasare
                          id={obiect.id}
                          denumire={obiect.denumire}
                          numarInventar={obiect.numar_inventar}
                          valoare={
                            obiect.valoare === null ? "Necompletată" : formatLei(obiect.valoare)
                          }
                        />
                      ) : null}
                    </>
                  ),
                }
              : {})}
            file={
              <div className="flex flex-wrap items-center gap-2">
                <Badge ton={TONURI_STATUS[obiect.status]}>{ETICHETE_STATUS[obiect.status]}</Badge>
                <Badge ton={TONURI_STARE[obiect.stare]}>{ETICHETE_STARE[obiect.stare]}</Badge>
              </div>
            }
          />
        </div>
      </div>

      {/*
        Cifrele obiectului. Cuvinte, nu liniuțe, acolo unde lipsește ceva: „—”
        nu se aude deloc la cititorul de ecran și nu distinge „necompletat” de
        „nimic” — aceeași regulă ca în `lista-definitii.tsx`.
      */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Indicator
          eticheta="Valoare"
          valoare={obiect.valoare === null ? "Necompletată" : formatLei(obiect.valoare)}
          {...(obiect.valoare === null ? { esteCuvant: true } : {})}
        />
        <Indicator
          eticheta="Predări"
          valoare={istoric.length}
          nota={
            istoric.length === 0
              ? "niciuna încă"
              : stareCustodie.fel === "alocat"
                ? "una în curs"
                : "toate încheiate"
          }
        />
        {/*
          A patra cartelă, „În evidență de N zile”, a fost scoasă: propoziția
          din cardul de custodie o spune deja, cu dată cu tot. Trei cifre pe care
          le citești sunt mai mult decât patru pe care le sari — iar pe telefon,
          unde cartelele se stivuiesc (cifra de 2rem are nevoie de lățime, deci
          nu pot sta două pe rând), a patra însemna încă 130px până la întrebarea
          pentru care ai deschis fișa.
        */}
        <Indicator
          eticheta="Garanție"
          esteCuvant
          valoare={
            <Scadenta treapta={treaptaGarantie(obiect.garantie_expira, azi)}>
              {obiect.garantie_expira === null
                ? "Fără garanție"
                : formatDate(obiect.garantie_expira)}
            </Scadenta>
          }
        />
      </div>

      <section aria-labelledby="titlu-custodie" className={CLASA_SECTIUNE}>
        <h2 id="titlu-custodie" className="text-sectiune mb-4 font-medium">
          Unde e obiectul
        </h2>
        <CardCustodie
          custodie={stareCustodie}
          obiectId={obiect.id}
          creatLa={obiect.created_at}
          zileInEvidenta={zileInEvidenta(obiect.created_at, azi)}
          angajati={angajatiDePredare}
          poateScrie={poateScrie}
        />
      </section>

      <section aria-labelledby="titlu-date-generale" className={CLASA_SECTIUNE}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <h2 id="titlu-date-generale" className="text-sectiune font-medium">
              Date generale
            </h2>
            {/*
              Bara dispare la fișa întreagă: o bară plină e zgomot, iar
              indicatorul care spune mereu „gata” nu mai spune nimic.
            */}
            {fisaIntreaga ? null : (
              <Nivel
                className="mt-2 max-w-xs"
                marime="subtire"
                valoare={completate}
                din={CAMPURI_FISA.length}
                eticheta="Cât e completată fișa obiectului"
                text={`${String(completate)} din ${String(CAMPURI_FISA.length)} câmpuri completate`}
              />
            )}
          </div>
        </div>

        <ListaDefinitii
          coloane={3}
          textNecompletat="Necompletat"
          definitii={[
            { eticheta: "Serie", valoare: obiect.serie, identificator: true },
            { eticheta: "Model", valoare: obiect.model },
            { eticheta: "Producător", valoare: obiect.producator },
            {
              eticheta: "Valoare",
              valoare: obiect.valoare === null ? null : formatLei(obiect.valoare),
            },
            {
              eticheta: "Data achiziției",
              valoare: obiect.data_achizitie === null ? null : formatDate(obiect.data_achizitie),
            },
            {
              eticheta: "Garanția expiră",
              valoare: obiect.garantie_expira === null ? null : formatDate(obiect.garantie_expira),
            },
            { eticheta: "Locație", valoare: obiect.locatie },
            { eticheta: "Observații", valoare: obiect.observatii, lat: true },
          ]}
        />
      </section>

      <section aria-labelledby="titlu-cronologie" className={CLASA_SECTIUNE}>
        <h2 id="titlu-cronologie" className="text-sectiune font-medium">
          Cronologie
        </h2>
        <p className="text-muted-foreground text-corp mt-1 mb-5">
          {istoric.length === 0
            ? "Obiectul nu a fost încă predat nimănui. Fiecare predare și fiecare returnare apar aici, cu procesul-verbal."
            : "Fiecare predare și fiecare returnare, de la cea mai recentă."}
        </p>
        <Cronologie evenimente={evenimenteFisa(obiect, istoric, numeNume)} />
        {istoric.length === 0 ? null : (
          <ul className="border-border mt-5 flex flex-wrap gap-x-4 gap-y-1 border-t pt-4">
            {istoric.map((alocare) => (
              <li key={alocare.id}>
                <Link
                  href={`/inventar/${obiect.id}/pv/${alocare.id}`}
                  className="text-nota underline-offset-2 hover:underline"
                >
                  Proces-verbal · {formatDate(toBucharestDateString(new Date(alocare.predat_la)))}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Integrare bidirecțională cu ticketing-ul: pe fișa obiectului se văd
          defecțiunile raportate pe el. Secțiunea apare doar dacă modulul e
          activ la organizația respectivă. */}
      {tichete !== null && (
        <section aria-labelledby="titlu-tichete" className={CLASA_SECTIUNE}>
          <h2 id="titlu-tichete" className="text-sectiune mb-4 font-medium">
            Tichete pe acest obiect
          </h2>
          {tichete.length === 0 ? (
            <StareGoala
              fel="initiala"
              compact
              pictograma={Ticket}
              titlu="Nicio defecțiune raportată"
              descriere="Sesizările deschise pe acest obiect apar aici, cu numărul și starea lor."
            />
          ) : (
            <ul className="space-y-2">
              {tichete.map((tichet) => (
                <li
                  key={tichet.id}
                  className="border-border rounded-control bg-background flex flex-wrap items-center gap-3 border p-3"
                >
                  <Link
                    href={`/ticketing/${tichet.id}`}
                    className="text-primary text-nota font-mono hover:underline"
                  >
                    {tichet.numar_afisat}
                  </Link>
                  <span className="text-corp flex-1">{tichet.titlu}</span>
                  <Badge ton={TONURI_STATUS_TICHET[tichet.status]} className="shrink-0">
                    {ETICHETE_STATUS_TICHET[tichet.status]}
                  </Badge>
                  {/*
                    `created_at` e `timestamptz`, iar `formatDate` ARUNCĂ pe
                    orice nu e exact `YYYY-MM-DD` (`parseIsoDate`, date.ts:68).
                    Pagina chema `formatDate(tichet.created_at)` direct: fișa
                    oricărui obiect cu măcar un tichet cădea în `error.tsx`,
                    cu modulul de ticketing activ. Nu s-a văzut fiindcă niciun
                    obiect din bază n-are încă tichete.
                  */}
                  <span className="text-muted-foreground text-nota">
                    {formatDate(toBucharestDateString(new Date(tichet.created_at)))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
