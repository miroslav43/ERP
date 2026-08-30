// src/app/(app)/panou/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarPlus, Check, UserPlus } from "lucide-react";

import { AntetPagina } from "@/components/ui/antet-pagina";
import { buton } from "@/components/ui/buton";
import { Indicator } from "@/components/ui/indicator";
import { FEATURES, type FeatureKey } from "@/config/features";
import { RUTA_ALEGE_ORGANIZATIA, RUTA_AUTENTIFICARE } from "@/config/routes";
import { can } from "@/lib/auth/permissions";
import { getEnabledFeatures } from "@/lib/auth/features";
import { getPermissionMap } from "@/lib/auth/permissions";
import { buildNavigation } from "@/lib/navigation/build-navigation";
import { contoarePanouPentru, PRAG_PANOU_ZILE, type ContoarePanou } from "@/lib/queries/panou";
import { resolveTenant } from "@/lib/tenant/resolve-tenant";

import { RandCoada } from "./_components/rand-coada";

export const metadata: Metadata = { title: "Panou" };

/**
 * Panoul principal — registrul de dimineață al administratorului.
 *
 * ── CE ERA ÎNAINTE ────────────────────────────────────────────────────────
 * Un cuprins: numele firmei, o linie cu trei cifre administrative (locuri
 * ocupate, membri activi, invitații) și o grilă de carduri care duceau în
 * module. Niciun număr operațional — nimic care așteaptă o semnătură, nimic
 * care expiră. Era, în plus, singura pagină din `(app)` FĂRĂ preambul de
 * permisiuni, deci putea trimite un `manager` direct într-un refuz.
 *
 * ── PRINCIPIUL ────────────────────────────────────────────────────────────
 * Coada stă deasupra cifrelor, întotdeauna, chiar și goală. Panoul trebuie să
 * se GOLEASCĂ, nu să se umple: unul mereu plin nu mai înseamnă nimic. De aceea
 * starea goală se scrie ca reușită, nu ca absență.
 *
 * ── DE CE INDICATORII SE ADAPTEAZĂ LA EFECTIV ─────────────────────────────
 * Sub prag se arată numere absolute și fapte; procentele apar abia peste el.
 * Pe opt angajați — efectivul real al celei mai mari firme din sistem — o
 * plecare înseamnă 12,5 % fluctuație, iar un indicator care afișează asta
 * minte mai mult decât spune.
 */

/** Peste acest efectiv, procentele și tendințele încep să însemne ceva. */
const PRAG_EFECTIV_PROCENTE = 25;

/** Ordinea din coadă: cine mă așteaptă pe mine, apoi ce are termen, apoi ce e blocat. */
type IntrareCoada = Readonly<{
  cheie: string;
  numar: number;
  titlu: string;
  detaliu: string;
  href: string;
  actiune: string;
  urgent?: boolean;
}>;

function coadaDinContoare(c: ContoarePanou): readonly IntrareCoada[] {
  const { coada } = c;
  const intrari: IntrareCoada[] = [];

  if (coada.cereriConcediu !== null && coada.cereriConcediu > 0) {
    /*
     * Rândul ducea la `/concedii/aprobari`, dar contorul nu numără același
     * lucru: ecranul acela listează sarcinile atribuite MIE
     * (`deAprobat` filtrează `approval_tasks.approver_user_id = userId`), în
     * timp ce cifra numără CERERILE în curs pe care le văd, oricine ar fi
     * aprobatorul lor. Un `org_admin` care nu e în lanțul de aprobare citea
     * „5 cereri" și deschidea un ecran gol — contorul nu urma lista, exact
     * defectul pe care `queries/panou.ts` îl interzice în capul fișierului.
     * Acum duce la lista filtrată pe aceleași stări, prin aceeași politică
     * RLS, deci cifra și rândurile nu se mai pot contrazice.
     */
    intrari.push({
      cheie: "concedii",
      numar: coada.cereriConcediu,
      titlu: "Cereri de concediu care așteaptă o decizie",
      detaliu: coada.cereriConcediu === 1 ? "cerere trimisă" : "cereri trimise",
      href: "/concedii?status=trimisa,in_aprobare",
      actiune: "Deschide",
    });
  }
  if (coada.saptamaniPontaj !== null && coada.saptamaniPontaj > 0) {
    intrari.push({
      cheie: "pontaj",
      numar: coada.saptamaniPontaj,
      titlu: "Perioade de pontaj trimise spre aprobare",
      detaliu: coada.saptamaniPontaj === 1 ? "perioadă" : "perioade",
      href: "/pontaj/aprobare",
      actiune: "Aprobă",
    });
  }
  if (coada.deplasari !== null && coada.deplasari > 0) {
    intrari.push({
      cheie: "diurna",
      numar: coada.deplasari,
      titlu: "Deplasări care așteaptă aprobare",
      detaliu: coada.deplasari === 1 ? "deplasare" : "deplasări",
      href: "/diurna/aprobari",
      actiune: "Aprobă",
    });
  }
  if (coada.foiParcurs !== null && coada.foiParcurs > 0) {
    intrari.push({
      cheie: "foi",
      numar: coada.foiParcurs,
      titlu: "Foi de parcurs trimise spre aprobare",
      detaliu: coada.foiParcurs === 1 ? "foaie" : "foi",
      href: "/flota/aprobari",
      actiune: "Aprobă",
    });
  }
  if (coada.tichete !== null && coada.tichete > 0) {
    intrari.push({
      cheie: "tichete",
      numar: coada.tichete,
      titlu: "Tichete care așteaptă decizia ta",
      detaliu: coada.tichete === 1 ? "tichet" : "tichete",
      href: "/ticketing/coada",
      actiune: "Deschide",
    });
  }
  /*
   * Anomaliile de kilometraj erau citite la fiecare încărcare de panou și
   * aruncate: `contorAnomaliiKm` intra în `Promise.all`, ajungea în
   * `scadente.anomaliiKm` și nicio componentă nu-l citea. Un drum la bază pe
   * fiecare afișare, pentru o cifră care nu apărea nicăieri — și, în același
   * timp, singurul semnal că cineva a scris un kilometraj imposibil rămânea
   * invizibil până când intra cineva anume în `/flota/anomalii`.
   */
  if (coada.anomaliiKm !== null && coada.anomaliiKm > 0) {
    intrari.push({
      cheie: "anomalii",
      numar: coada.anomaliiKm,
      titlu: "Anomalii de kilometraj neconfirmate",
      detaliu: coada.anomaliiKm === 1 ? "citire de contor" : "citiri de contor",
      href: "/flota/anomalii",
      actiune: "Verifică",
    });
  }
  return intrari;
}

export default async function PanouPage() {
  const rezolvare = await resolveTenant();
  if (rezolvare.status === "neautentificat") redirect(RUTA_AUTENTIFICARE);
  if (rezolvare.status !== "ok") redirect(RUTA_ALEGE_ORGANIZATIA);
  const { tenant } = rezolvare;

  // Preambulul canonic, absent până acum de pe singura pagină din `(app)` care
  // n-avea niciunul. Fără el, un `manager` fără `payroll:read` ar fi văzut
  // cifre de salarizare — sau, mai rău, un card care duce într-un refuz.
  const [module, permisiuni] = await Promise.all([
    getEnabledFeatures(tenant.organizationId),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  /*
   * Prin învelișul memoizat, nu direct: `(app)/layout.tsx` cere ACEIAȘI contori
   * pentru insignele de meniu, iar `React.cache()` compară prin identitate —
   * un obiect `porti` construit aici ar fi ratat memoizarea, iar cele
   * unsprezece interogări s-ar fi făcut de două ori pe fiecare încărcare a
   * panoului.
   */
  const contoare = await contoarePanouPentru(tenant.organizationId, tenant.role, tenant.memberId);

  const coada = coadaDinContoare(contoare);
  const { scadente, firma } = contoare;
  const firmaGoala = firma.angajatiActivi === 0;
  const peProcente = firma.angajatiActivi >= PRAG_EFECTIV_PROCENTE;

  const poateAdaugaAngajat = can(permisiuni, "employees:create", "all");
  const poateCereConcediu = module.has("leave") && can(permisiuni, "leave:create", "own");

  const azi = new Intl.DateTimeFormat("ro-RO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Bucharest",
  }).format(new Date());

  const scadenteVizibile = [
    scadente.ssm !== null
      ? {
          cheie: "ssm",
          eticheta: "Scadențe SSM și PSI",
          valoare: scadente.ssm,
          href: "/ssm",
          nota:
            scadente.ssm === 0 ? "Nimic în fereastra de preaviz." : "Instruiri, fișe, verificări.",
        }
      : null,
    scadente.mentenanta !== null
      ? {
          cheie: "mentenanta",
          eticheta: "Mentenanță scadentă",
          valoare: scadente.mentenanta,
          href: "/mentenanta",
          nota:
            scadente.mentenanta === 0 ? "Niciun plan depășit." : "Planuri și autorizații ISCIR.",
        }
      : null,
    scadente.documenteFlota !== null
      ? {
          cheie: "flota",
          eticheta: "Documente de flotă",
          valoare: scadente.documenteFlota,
          href: "/flota",
          nota:
            scadente.documenteFlota === 0
              ? `Nimic în următoarele ${PRAG_PANOU_ZILE} de zile.`
              : "ITP, RCA, asigurare.",
        }
      : null,
    scadente.contracteDeterminate !== null
      ? {
          cheie: "contracte",
          eticheta: "Contracte care expiră",
          valoare: scadente.contracteDeterminate,
          href: "/angajati",
          nota:
            scadente.contracteDeterminate === 0
              ? "Niciunul pe durată determinată în fereastră."
              : "Prelungirea e eveniment REVISAL cu termen.",
        }
      : null,
  ].filter((x): x is NonNullable<typeof x> => x !== null);

  // „Lipsește" nu se numără la un loc cu „expiră": un vehicul fără niciun
  // document n-are dată de la care să numere, deci nu se aprinde niciodată
  // singur. Merită propria cartelă, cu ton de pericol.
  const lipsuri =
    scadente.vehiculeFaraDocumente !== null && scadente.vehiculeFaraDocumente > 0
      ? scadente.vehiculeFaraDocumente
      : null;

  /*
   * ── SCURTĂTURILE VIN DIN MENIU, NU DINTR-O A DOUA HARTĂ ───────────────────
   * Erau construite doar din modulele ACTIVE pe firmă, cu rutele scrise într-un
   * tabel local. Modulul activ nu înseamnă însă că omul are voie înăuntru: un
   * `manager` n-are niciun `vehicles:*` (CLAUDE.md), deci vedea scurtătura
   * „Parc auto" și lovea `AccesRestricționat` la `/flota` — în timp ce bara
   * laterală i-o ascundea corect, fiindcă ea trece prin `buildNavigation`.
   * Panoul și meniul spuneau lucruri diferite despre același drept.
   *
   * Acum trec amândouă prin aceeași funcție și aceeași sursă (`NAV_ITEMS`), deci
   * nu mai pot diverge; ruta fiecărei scurtături e chiar `href`-ul intrării de
   * meniu, iar tabelul local de rute a dispărut. Se ia PRIMA intrare vizibilă a
   * modulului: `buildNavigation` întoarce grupurile în ordinea lor și intrările
   * sortate după `order`, deci „prima" e cea mai de sus din meniu, nu una la
   * întâmplare.
   */
  const navigatie = buildNavigation({ features: module, permissions: permisiuni });
  const rutaVizibilaPeModul = new Map<FeatureKey, string>();
  for (const grup of navigatie) {
    for (const item of grup.items) {
      if (item.featureKey === null || rutaVizibilaPeModul.has(item.featureKey)) continue;
      rutaVizibilaPeModul.set(item.featureKey, item.href);
    }
  }

  const scurtaturi = [...module]
    .filter((cheie): cheie is FeatureKey => cheie !== "nucleu" && cheie !== "employee_portal")
    .flatMap((cheie) => {
      const meta = FEATURES[cheie];
      const href = rutaVizibilaPeModul.get(cheie);
      // `undefined` = modul pornit pe firmă, dar niciun ecran al lui deschis
      // pentru rolul acesta. O scurtătură către un refuz e mai rea decât una
      // absentă.
      return meta === undefined || href === undefined ? [] : [{ cheie, meta, href }];
    })
    .sort((a, b) => a.meta.sortOrder - b.meta.sortOrder);

  return (
    <div className="flex flex-col gap-6">
      <AntetPagina
        titlu="Panou"
        descriere={azi.charAt(0).toUpperCase() + azi.slice(1)}
        {...(poateAdaugaAngajat || poateCereConcediu
          ? {
              actiuni: (
                <>
                  {poateCereConcediu ? (
                    <Link href="/concedii/noua" className={buton({ varianta: "secundar" })}>
                      <CalendarPlus aria-hidden="true" className="size-4" />
                      Cerere de concediu
                    </Link>
                  ) : null}
                  {poateAdaugaAngajat ? (
                    <Link href="/angajati/nou" className={buton({ varianta: "primar" })}>
                      <UserPlus aria-hidden="true" className="size-4" />
                      Angajat nou
                    </Link>
                  ) : null}
                </>
              ),
            }
          : {})}
      />

      {/* ── PORNIRE ─────────────────────────────────────────────────────────
          Apare DOAR cât timp firma n-are angajați și dispare de la sine la
          primul. Două din cele trei firme reale din sistem sunt în starea asta,
          iar pentru ele panoul obișnuit ar fi fost o listă de „nimic de făcut"
          repetată de cinci ori — corect, dar rece pentru cineva care tocmai
          s-a înrolat și nu știe ce urmează. */}
      {firmaGoala ? (
        <section className="border-border rounded-panou overflow-hidden border">
          <header className="border-border border-b px-4 py-3">
            <h2 className="text-eticheta text-foreground font-semibold tracking-wide uppercase">
              Pornire
            </h2>
            <p className="text-foreground text-corp mt-2">
              Firma e configurată. Mai lipsește cine lucrează în ea.
            </p>
            <p className="text-muted-foreground text-nota mt-0.5">
              Blocul acesta dispare singur când adăugați primul angajat.
            </p>
          </header>
          <ul className="divide-border divide-y">
            <PasPornire
              gata
              titlu="Datele firmei sunt complete"
              detaliu="CUI, sediu și reprezentant legal — completate la înrolare."
            />
            <PasPornire
              titlu="Adăugați primul angajat"
              detaliu="Fără oameni, niciun modul nu are ce arăta."
              {...(poateAdaugaAngajat
                ? { actiune: { eticheta: "Adaugă", href: "/angajati/nou" } }
                : {})}
            />
            <PasPornire
              titlu="Definiți departamentele"
              detaliu="Un departament e destul ca să înceapă aprobările."
              actiune={{ eticheta: "Definește", href: "/departamente" }}
            />
            <PasPornire
              titlu="Porniți modulele de care aveți nevoie"
              detaliu={`${module.size} din ${Object.keys(FEATURES).length} pornite. Pontajul și Concediile sunt cele mai folosite la început.`}
              actiune={{ eticheta: "Vezi modulele", href: "/setari/organizatie" }}
            />
          </ul>
        </section>
      ) : null}

      {/* ── COADA ───────────────────────────────────────────────────────────
          Prima secțiune, singura care se poate goli. */}
      <section className="border-border rounded-panou overflow-hidden border">
        <header className="border-border flex items-center justify-between gap-3 border-b px-4 py-3">
          <h2 className="text-eticheta text-foreground font-semibold tracking-wide uppercase">
            De rezolvat
          </h2>
          <span
            className={
              contoare.totalDeRezolvat > 0
                ? "bg-surface text-foreground text-nota rounded-full px-2.5 py-0.5 font-mono font-semibold tabular-nums"
                : "text-muted-foreground text-nota font-mono tabular-nums"
            }
          >
            {contoare.totalDeRezolvat}
          </span>
        </header>

        {coada.length === 0 ? (
          <div className="flex items-start gap-3 px-4 py-7">
            <span
              aria-hidden="true"
              className="border-success text-success grid size-6 shrink-0 place-items-center rounded-full border-2"
            >
              <Check className="size-3.5" strokeWidth={3} />
            </span>
            <div>
              <p className="text-foreground text-corp font-semibold">
                Nimic nu așteaptă semnătura dumneavoastră.
              </p>
              <p className="text-muted-foreground text-corp mt-0.5 max-w-prose">
                Panoul se golește când totul e în regulă. Dacă rămâne gol săptămâni la rând,
                înseamnă că e corect — nu că s-a stricat.
              </p>
            </div>
          </div>
        ) : (
          <ul className="flex flex-col">
            {coada.map((i) => (
              <RandCoada
                key={i.cheie}
                titlu={i.titlu}
                detaliu={i.detaliu}
                numar={i.numar}
                href={i.href}
                etichetaActiune={i.actiune}
                {...(i.urgent === true ? { urgent: true } : {})}
              />
            ))}
          </ul>
        )}
      </section>

      {/* ── SCADENȚE ȘI LIPSURI ─────────────────────────────────────────── */}
      {scadenteVizibile.length > 0 || lipsuri !== null ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-eticheta text-foreground font-semibold tracking-wide uppercase">
            Scadențe și lipsuri
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {lipsuri === null ? null : (
              <Indicator
                eticheta="Documente de flotă"
                valoare="Lipsesc"
                esteCuvant
                ton="pericol"
                href="/flota"
                nota={
                  lipsuri === 1
                    ? "Un vehicul fără ITP, RCA sau asigurare."
                    : `${lipsuri} vehicule fără niciun document.`
                }
              />
            )}
            {scadenteVizibile.map((s) => (
              <Indicator
                key={s.cheie}
                eticheta={s.eticheta}
                valoare={s.valoare}
                href={s.href}
                nota={s.nota}
                ton={s.valoare === 0 ? "bun" : "atentie"}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* ── FIRMA AZI ───────────────────────────────────────────────────── */}
      {firmaGoala ? null : (
        <section className="border-border rounded-panou overflow-hidden border">
          <header className="border-border border-b px-4 py-3">
            <h2 className="text-eticheta text-foreground font-semibold tracking-wide uppercase">
              Firma azi
            </h2>
          </header>
          <dl className="divide-border grid grid-cols-2 divide-x divide-y sm:grid-cols-4 sm:divide-y-0">
            <Fapt valoare={firma.angajatiActivi} eticheta="angajați activi" />
            <Fapt valoare={firma.inConcediu} eticheta="în concediu" />
            <Fapt valoare={firma.departamente} eticheta="departamente" />
          </dl>
          {peProcente ? null : (
            <p className="border-border bg-surface text-foreground text-nota border-t px-4 py-2.5">
              Sub {PRAG_EFECTIV_PROCENTE} de angajați panoul arată{" "}
              <strong className="font-semibold">numere, nu procente</strong>. O plecare din{" "}
              {firma.angajatiActivi} ar însemna{" "}
              {((1 / Math.max(firma.angajatiActivi, 1)) * 100).toFixed(1).replace(".", ",")} %
              fluctuație — un indicator care ar minți mai mult decât ar spune.
            </p>
          )}
        </section>
      )}

      {/* ── SCURTĂTURI ──────────────────────────────────────────────────── */}
      {scurtaturi.length === 0 ? null : (
        <section className="flex flex-col gap-2">
          <h2 className="text-eticheta text-muted-foreground font-semibold tracking-wide uppercase">
            Module active
          </h2>
          <ul className="flex flex-wrap gap-2">
            {scurtaturi.map(({ cheie, meta, href }) => {
              const Pictograma = meta.icon;
              return (
                <li key={cheie}>
                  <Link
                    href={href}
                    className="border-border bg-background hover:bg-surface active:bg-border rounded-control text-foreground text-corp flex min-h-11 items-center gap-2 border px-3 transition-colors md:min-h-0 md:py-1.5"
                  >
                    <Pictograma aria-hidden="true" className="text-muted-foreground size-4" />
                    {meta.denumire}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function Fapt({ valoare, eticheta }: Readonly<{ valoare: number; eticheta: string }>) {
  return (
    <div className="px-4 py-3">
      <dt className="sr-only">{eticheta}</dt>
      <dd>
        <span className="text-foreground text-cifra block font-mono leading-none font-semibold tabular-nums">
          {valoare}
        </span>
        <span className="text-muted-foreground text-nota mt-1 block">{eticheta}</span>
      </dd>
    </div>
  );
}

function PasPornire({
  gata,
  titlu,
  detaliu,
  actiune,
}: Readonly<{
  gata?: boolean;
  titlu: string;
  detaliu: string;
  actiune?: Readonly<{ eticheta: string; href: string }>;
}>) {
  return (
    <li className="flex min-h-14 items-center gap-3 px-4 py-3">
      <span
        aria-hidden="true"
        className={
          gata === true
            ? "border-success bg-success text-background grid size-5 shrink-0 place-items-center rounded-full border-2"
            : "border-muted-foreground size-5 shrink-0 rounded-full border-2"
        }
      >
        {gata === true ? <Check className="size-3" strokeWidth={3.5} /> : null}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={
            gata === true
              ? "text-muted-foreground text-corp font-medium"
              : "text-foreground text-corp font-medium"
          }
        >
          {titlu}
        </p>
        <p className="text-muted-foreground text-nota">{detaliu}</p>
      </div>
      {actiune === undefined ? null : (
        <Link href={actiune.href} className={buton({ varianta: "secundar" })}>
          {actiune.eticheta}
        </Link>
      )}
    </li>
  );
}
