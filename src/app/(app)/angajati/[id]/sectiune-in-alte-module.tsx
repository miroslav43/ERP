// src/app/(app)/angajati/[id]/sectiune-in-alte-module.tsx
import Link from "next/link";
import type { ReactElement } from "react";

import { poateDeschide, type ContextPorti } from "@/config/porti-ruta";
import { scopeFor } from "@/lib/auth/permissions";
import type { PermissionScope } from "@/config/permissions";
import { formatDate, formatMonthYear } from "@/lib/format/date";
import { filtreInstanteSchema } from "@/schemas/checklist";
import { listeazaInstante } from "@/lib/queries/checklist";
import { cursurileMele } from "@/lib/queries/cursuri";
import { inPrimireaMea } from "@/lib/queries/inventory";
import { deplasarileMele } from "@/lib/queries/per-diem";
import { echipamenteleMele } from "@/lib/queries/maintenance";
import { citesteFluturasulPropriu } from "@/lib/queries/payroll";
import { kpiAngajat } from "@/lib/queries/kpi";
import { listeazaTichete } from "@/lib/queries/ticketing";
import {
  autorizatiiNominaleAngajat,
  eipAngajatului,
  fiseAptitudineAngajat,
  instruirileAngajatului,
  restrictiiActiveAngajat,
} from "@/lib/queries/ssm";
import { createServerSupabase } from "@/lib/supabase/server";

import { ETICHETE_STATUS as ETICHETE_STATUS_CURS } from "../../cursuri/etichete";
import { ETICHETE_STATUS_DEPLASARE } from "../../diurna/etichete";
import {
  ETICHETE_STATUS_INSTANTA,
  ETICHETE_TIP as ETICHETE_TIP_PARCURS,
} from "../../onboarding/etichete";
import { ETICHETE_STATUS as ETICHETE_STATUS_TICHET } from "../../ticketing/etichete";
import { ETICHETE_REZULTAT_EXAMEN } from "../../ssm/etichete";

/**
 * „În alte module" — fișa angajatului ca punct de plecare.
 *
 * Analiza din 2026-10-08 (docs/design/navigare-intre-module.md, §angajati):
 * fișa avea încadrare, contracte, concedii, scutiri, sporuri, evaluări și
 * documente, dar NIMIC despre pontaj, cursuri, inventar, diurnă, SSM,
 * integrare, tichete, flotă, REGES sau KPI — deși citirile per-angajat
 * existau toate și le folosea doar portalul. Cine deschidea fișa trebuia să
 * plece prin meniu și să caute omul din nou în fiecare modul.
 *
 * ── REGULILE ──────────────────────────────────────────────────────────────
 * 1. Un card apare DOAR dacă pagina-țintă („vezi tot") se deschide pentru
 *    rolul ăsta: `poateDeschide()` din registrul porților, care știe și modulul
 *    activ, și permisiunea paginii. Nu `can()` ales de mână per card — aceeași
 *    funcție decide și citirea, și linkul, deci nu pot diverge. hr n-are
 *    `per_diem:*`/`maintenance:*`/`vehicles:*`; managerul n-are `payroll`/
 *    `reges`/`registru`. Cardurile lor lipsesc, nu apar goale.
 * 2. Toate citirile pleacă într-UN SINGUR `Promise.all`, cu `Promise.resolve(null)`
 *    pe ramura refuzată: nicio interogare care nu se va randa.
 * 3. Lista-țintă primește filtrul de INTRARE (`?angajat=<id>`, livrat în lotul
 *    3a), ca „vezi tot" să arate exact rândurile omului, cu pastilă.
 * 4. La `employees:read = team`, listele cu `read team` văd aceeași echipă prin
 *    RLS, deci un card gol e chiar gol. Singura excepție e `ssm:read team` pe o
 *    fișă din afara echipei, când privitorul are `employees:read = all` dar nu
 *    `ssm:read = all` — acolo nu se poate deosebi „n-are" de „nu vezi", deci
 *    cardul spune „nu aveți acces", nu „nimic".
 */

type Rand = Readonly<{
  cheie: string;
  eticheta: string;
  detaliu: string | null;
  /** `null` = text simplu (fără pagină de detaliu sau fără drept). */
  href: string | null;
}>;

type Card = Readonly<{
  cheie: string;
  titlu: string;
  randuri: readonly Rand[];
  /** Mesajul listei goale; `null` = cardul nu se randează când e gol. */
  gol: string | null;
  vezitot: Readonly<{ href: string; eticheta: string }> | null;
  /** Legături secundare, fără listă (forme de intrare, liste filtrate). */
  legaturi: readonly Readonly<{ href: string; eticheta: string }>[];
}>;

const LIMITA_CARD = 5;

function CardLegaturi({ card }: Readonly<{ card: Card }>): ReactElement | null {
  if (card.randuri.length === 0 && card.gol === null && card.legaturi.length === 0) return null;
  return (
    <div className="border-border bg-background rounded-control flex min-w-0 flex-col gap-2 border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="font-medium">{card.titlu}</h3>
        {card.vezitot === null ? null : (
          <Link href={card.vezitot.href} className="text-nota underline-offset-2 hover:underline">
            {card.vezitot.eticheta}
          </Link>
        )}
      </div>
      {card.randuri.length === 0 ? (
        card.gol === null ? null : (
          <p className="text-muted-foreground text-nota">{card.gol}</p>
        )
      ) : (
        <ul className="text-corp space-y-1">
          {card.randuri.map((rand) => (
            <li key={rand.cheie} className="flex min-w-0 flex-wrap items-baseline gap-x-2">
              {rand.href === null ? (
                <span className="truncate">{rand.eticheta}</span>
              ) : (
                <Link href={rand.href} className="truncate underline-offset-2 hover:underline">
                  {rand.eticheta}
                </Link>
              )}
              {rand.detaliu === null ? null : (
                <span className="text-muted-foreground text-nota">{rand.detaliu}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {card.legaturi.length === 0 ? null : (
        <p className="text-nota flex flex-wrap gap-x-3 gap-y-1">
          {card.legaturi.map((legatura) => (
            <Link
              key={legatura.href}
              href={legatura.href}
              className="underline-offset-2 hover:underline"
            >
              {legatura.eticheta}
            </Link>
          ))}
        </p>
      )}
    </div>
  );
}

export async function SectiuneInAlteModule({
  organizationId,
  angajat,
  permisiuni,
  module,
  esteFisaProprie,
  azi,
}: Readonly<{
  organizationId: string;
  angajat: Readonly<{ id: string; full_name: string }>;
  permisiuni: ReadonlyMap<string, PermissionScope>;
  module: ReadonlySet<string>;
  esteFisaProprie: boolean;
  /** `YYYY-MM-DD` în fusul firmei — pentru luna KPI curentă. */
  azi: string;
}>): Promise<ReactElement | null> {
  const context: ContextPorti = { features: module, permissions: permisiuni };
  const deschide = (href: string): boolean => poateDeschide(href, context);
  const id = angajat.id;

  // Porțile, evaluate ÎNAINTE: decid dacă o citire pleacă deloc.
  const pontajSaptamana = deschide("/pontaj/saptamana");
  const pontaj = pontajSaptamana || deschide("/pontaj");
  // `/concedii/echipa` exclude fișa proprie (leave.ts): a mea e la `/concedii`.
  const cereri = esteFisaProprie ? deschide("/concedii") : deschide("/concedii/echipa");
  const integrare = deschide("/onboarding");
  const inventar = deschide("/inventar");
  const cursuri = deschide("/cursuri");
  const diurna = deschide("/diurna");
  const ssm = deschide("/ssm/medicina-muncii");
  const echipamente = deschide("/mentenanta/echipamente");
  const flota = deschide("/flota");
  const foi = deschide("/flota/foi");
  const fluturas = deschide("/salarizare/[id]/[entryId]");
  const istoricVenituri = deschide("/salarizare/istoric-venituri");
  const kpi = deschide("/evaluari/kpi");
  const tichete = deschide("/ticketing/coada");
  const reges = deschide("/reges");
  const registru = deschide("/registru");
  const audit = deschide("/setari/audit");
  const organigrama = deschide("/organigrama");

  // Regula 4: „nu aveți acces" în loc de listă goală falsă.
  const ssmPoateFiAscuns =
    ssm &&
    scopeFor(permisiuni, "ssm:read") === "team" &&
    scopeFor(permisiuni, "employees:read") === "all";

  const [an = 0, luna = 1] = azi.split("-").map(Number);

  const [
    parcursuri,
    bunuri,
    inrolari,
    deplasari,
    restrictii,
    fise,
    instruiri,
    eip,
    autorizatii,
    utilaje,
    vehicule,
    fluturasul,
    serieKpi,
    ticheteleLui,
  ] = await Promise.all([
    integrare
      ? listeazaInstante(
          organizationId,
          filtreInstanteSchema.parse({ angajat: id, limita: 5 }),
        ).then((r) => r.randuri)
      : Promise.resolve(null),
    // `inPrimireaMea` cu `null` ar întoarce alocările ÎNTREGII firme: id-ul e obligatoriu.
    inventar ? inPrimireaMea(organizationId, id) : Promise.resolve(null),
    cursuri ? cursurileMele(organizationId, id) : Promise.resolve(null),
    diurna ? deplasarileMele(organizationId, id, LIMITA_CARD) : Promise.resolve(null),
    ssm ? restrictiiActiveAngajat(organizationId, id) : Promise.resolve(null),
    ssm ? fiseAptitudineAngajat(organizationId, id, 1) : Promise.resolve(null),
    ssm ? instruirileAngajatului(organizationId, id) : Promise.resolve(null),
    ssm ? eipAngajatului(organizationId, id) : Promise.resolve(null),
    ssm ? autorizatiiNominaleAngajat(organizationId, id) : Promise.resolve(null),
    echipamente ? echipamenteleMele(organizationId, id) : Promise.resolve(null),
    flota
      ? createServerSupabase().then((db) =>
          db
            .from("vehicle_assignments")
            .select(
              "id, vehicle_id, de_la, pana_la, vehicul:vehicles!vehicle_id(nr_inmatriculare, marca, model)",
            )
            .eq("organization_id", organizationId)
            .eq("employee_id", id)
            .is("deleted_at", null)
            .is("pana_la", null)
            .order("de_la", { ascending: false })
            .limit(LIMITA_CARD)
            .then(({ data }) => data ?? []),
        )
      : Promise.resolve(null),
    fluturas ? citesteFluturasulPropriu(organizationId, id) : Promise.resolve(null),
    kpi ? kpiAngajat(organizationId, id, an, luna, 3).then((k) => k.serie) : Promise.resolve(null),
    tichete
      ? listeazaTichete(organizationId, {}, null, id, LIMITA_CARD).then((p) => p.randuri)
      : Promise.resolve(null),
  ]);

  const carduri: Card[] = [];

  // Pontaj și cereri: doar legături — foaia și cererile au deja filtrul de intrare.
  const legaturiTimp: Array<Readonly<{ href: string; eticheta: string }>> = [];
  if (pontaj) {
    legaturiTimp.push({
      href: pontajSaptamana ? `/pontaj/saptamana?angajat=${id}` : `/pontaj?angajat=${id}`,
      eticheta: pontajSaptamana ? "Săptămâna de pontaj" : "Foaia de pontaj",
    });
  }
  if (cereri) {
    legaturiTimp.push({
      href: esteFisaProprie ? "/concedii" : `/concedii/echipa?employee_id=${id}`,
      eticheta: "Cererile de concediu",
    });
  }
  if (legaturiTimp.length > 0) {
    carduri.push({
      cheie: "timp",
      titlu: "Pontaj și concedii",
      randuri: [],
      gol: null,
      vezitot: null,
      legaturi: legaturiTimp,
    });
  }

  if (parcursuri !== null) {
    carduri.push({
      cheie: "integrare",
      titlu: "Integrare și ieșire",
      randuri: parcursuri.map((p) => ({
        cheie: p.id,
        eticheta: `${ETICHETE_TIP_PARCURS[p.tip]} din ${formatDate(p.data_referinta)}`,
        detaliu: ETICHETE_STATUS_INSTANTA[p.status],
        href: `/onboarding/${p.id}`,
      })),
      gol: "Niciun parcurs pornit.",
      vezitot: { href: `/onboarding?angajat=${id}`, eticheta: "Toate parcursurile" },
      legaturi: deschide("/onboarding/noua")
        ? [{ href: "/onboarding/noua", eticheta: "Pornește un parcurs" }]
        : [],
    });
  }

  if (bunuri !== null) {
    carduri.push({
      cheie: "bunuri",
      titlu: "Bunuri în primire",
      randuri: bunuri.slice(0, LIMITA_CARD).map((b) => ({
        cheie: b.id,
        eticheta: `${b.obiect.denumire} (${b.obiect.numar_inventar})`,
        detaliu: `din ${formatDate(b.predat_la)}${b.confirmat_de_angajat_la === null ? " · neconfirmat" : ""}`,
        href: `/inventar/${b.item_id}`,
      })),
      gol: "Nimic în primire.",
      vezitot: { href: `/inventar?angajat=${id}`, eticheta: "În registrul de inventar" },
      legaturi: [],
    });
  }

  if (inrolari !== null) {
    carduri.push({
      cheie: "cursuri",
      titlu: "Cursuri",
      randuri: inrolari.slice(0, LIMITA_CARD).map((c) => ({
        cheie: c.inrolare.id,
        eticheta: c.denumire,
        detaliu: `${ETICHETE_STATUS_CURS[c.inrolare.status]}${
          c.inrolare.termen === null ? "" : ` · termen ${formatDate(c.inrolare.termen)}`
        }`,
        href: `/cursuri/${c.inrolare.course_id}/stadiu?angajat=${id}`,
      })),
      gol: "Niciun curs atribuit.",
      vezitot: { href: "/cursuri", eticheta: "Toate cursurile" },
      legaturi: [],
    });
  }

  if (deplasari !== null) {
    carduri.push({
      cheie: "diurna",
      titlu: "Deplasări",
      randuri: deplasari.map((d) => ({
        cheie: d.id,
        eticheta: `${d.scop}${d.localitate === null ? "" : ` · ${d.localitate}`}`,
        detaliu: `${formatDate(d.plecare_la)} · ${ETICHETE_STATUS_DEPLASARE[d.status]}`,
        href: `/diurna/${d.id}`,
      })),
      gol: "Nicio deplasare.",
      vezitot: { href: `/diurna?angajat=${id}`, eticheta: "Toate deplasările" },
      legaturi: [],
    });
  }

  if (ssm) {
    const randuriSsm: Rand[] = [];
    const ultimaFisa = fise?.[0] ?? null;
    if (ultimaFisa !== null) {
      randuriSsm.push({
        cheie: `fisa-${ultimaFisa.id}`,
        eticheta: `Fișa de aptitudine: ${ETICHETE_REZULTAT_EXAMEN[ultimaFisa.rezultat]}`,
        detaliu: `${formatDate(ultimaFisa.data_examinarii)}${
          ultimaFisa.valabil_pana === null
            ? ""
            : ` · până la ${formatDate(ultimaFisa.valabil_pana)}`
        }`,
        href: `/ssm/medicina-muncii?angajat=${id}`,
      });
    }
    for (const r of restrictii ?? []) {
      randuriSsm.push({
        cheie: `restrictie-${r.id}`,
        eticheta: `Restricție: ${r.restrictie}`,
        detaliu: r.valabil_pana === null ? "fără termen" : `până la ${formatDate(r.valabil_pana)}`,
        href: `/ssm/medicina-muncii?angajat=${id}`,
      });
    }
    const nrInstruiri = instruiri?.length ?? 0;
    const nrEip = (eip ?? []).filter((e) => e.returnat_la === null).length;
    const nrAutorizatii = (autorizatii ?? []).filter((a) => a.suspendata_la === null).length;
    const legaturiSsm = [
      {
        href: `/ssm/instruiri?q=${encodeURIComponent(angajat.full_name.slice(0, 60))}`,
        eticheta: `Instruiri (${nrInstruiri})`,
      },
      { href: `/ssm/eip?angajat=${id}`, eticheta: `Echipament de protecție (${nrEip})` },
      { href: `/ssm/autorizatii?angajat=${id}`, eticheta: `Autorizații (${nrAutorizatii})` },
    ];
    const golSsm =
      ssmPoateFiAscuns && randuriSsm.length === 0 && nrInstruiri + nrEip + nrAutorizatii === 0
        ? "Fără date vizibile: SSM-ul se vede doar pentru echipa dvs."
        : "Fără fișă de aptitudine și fără restricții.";
    carduri.push({
      cheie: "ssm",
      titlu: "SSM și PSI",
      randuri: randuriSsm,
      gol: golSsm,
      vezitot: { href: `/ssm/medicina-muncii?angajat=${id}`, eticheta: "Fișele medicale" },
      legaturi: legaturiSsm,
    });
  }

  if (utilaje !== null) {
    carduri.push({
      cheie: "echipamente",
      titlu: "Echipamente în grijă",
      randuri: utilaje.slice(0, LIMITA_CARD).map((u) => ({
        cheie: u.id,
        eticheta: `${u.denumire} (${u.cod})`,
        detaliu: u.locatie,
        href: `/mentenanta/echipamente/${u.id}`,
      })),
      gol: "Niciun echipament în grijă.",
      vezitot: {
        href: `/mentenanta/echipamente?responsabil=${id}`,
        eticheta: "Toate echipamentele",
      },
      legaturi: [],
    });
  }

  if (vehicule !== null) {
    carduri.push({
      cheie: "flota",
      titlu: "Flotă",
      randuri: vehicule.map((v) => ({
        cheie: v.id,
        eticheta:
          v.vehicul === null
            ? "Vehicul (ascuns)"
            : `${v.vehicul.nr_inmatriculare} · ${v.vehicul.marca} ${v.vehicul.model}`,
        detaliu: `atribuit din ${formatDate(v.de_la)}`,
        href: v.vehicul === null ? null : `/flota/${v.vehicle_id}`,
      })),
      gol: "Niciun vehicul atribuit.",
      vezitot: foi ? { href: `/flota/foi?sofer=${id}`, eticheta: "Foile lui de parcurs" } : null,
      legaturi: [],
    });
  }

  if (fluturas || istoricVenituri) {
    const randuriSal: Rand[] = [];
    if (fluturasul !== null) {
      randuriSal.push({
        cheie: fluturasul.id,
        eticheta: "Ultimul fluturaș calculat",
        detaliu:
          fluturasul.calculat_la === null
            ? null
            : `calculat la ${formatDate(fluturasul.calculat_la)}`,
        href: `/salarizare/${fluturasul.period_id}/${fluturasul.id}`,
      });
    }
    carduri.push({
      cheie: "salarizare",
      titlu: "Salarizare",
      randuri: randuriSal,
      gol: fluturas ? "Niciun fluturaș calculat încă." : null,
      vezitot: null,
      legaturi: [
        ...(istoricVenituri
          ? [{ href: `/salarizare/istoric-venituri?angajat=${id}`, eticheta: "Istoric venituri" }]
          : []),
        ...(reges ? [{ href: `/reges?angajat=${id}`, eticheta: "Mesajele REGES" }] : []),
        ...(registru
          ? [{ href: `/registru?an=${an}&angajat=${id}`, eticheta: "În registru" }]
          : []),
      ],
    });
  } else if (reges || registru) {
    carduri.push({
      cheie: "evidente",
      titlu: "Evidențe",
      randuri: [],
      gol: null,
      vezitot: null,
      legaturi: [
        ...(reges ? [{ href: `/reges?angajat=${id}`, eticheta: "Mesajele REGES" }] : []),
        ...(registru
          ? [{ href: `/registru?an=${an}&angajat=${id}`, eticheta: "În registru" }]
          : []),
      ],
    });
  }

  if (serieKpi !== null) {
    carduri.push({
      cheie: "kpi",
      titlu: "KPI lunar",
      randuri: serieKpi.slice(0, 3).map((p) => ({
        cheie: p.id,
        eticheta: formatMonthYear(p.an, p.luna),
        detaliu: p.scor_procent === null ? "fără scor" : `${p.scor_procent}%`,
        href: `/evaluari/kpi/${p.id}`,
      })),
      gol: "Nicio lună KPI deschisă.",
      vezitot: { href: `/evaluari/kpi?angajat=${id}`, eticheta: "Toate lunile" },
      legaturi: [],
    });
  }

  if (ticheteleLui !== null) {
    carduri.push({
      cheie: "tichete",
      titlu: "Tichete IT",
      randuri: ticheteleLui.map((t) => ({
        cheie: t.id,
        eticheta: `${t.numar_afisat} · ${t.titlu}`,
        detaliu: ETICHETE_STATUS_TICHET[t.status],
        href: `/ticketing/${t.id}`,
      })),
      gol: "Niciun tichet deschis de el.",
      vezitot: {
        href: `/ticketing/coada?solicitant_employee_id=${id}`,
        eticheta: "Toate tichetele",
      },
      legaturi: [],
    });
  }

  const legaturiStructura: Array<Readonly<{ href: string; eticheta: string }>> = [];
  if (organigrama) legaturiStructura.push({ href: "/organigrama", eticheta: "În organigramă" });
  if (audit) {
    legaturiStructura.push({
      href: `/setari/audit?entity_id=${id}`,
      eticheta: "Istoricul modificărilor",
    });
  }
  if (legaturiStructura.length > 0) {
    carduri.push({
      cheie: "structura",
      titlu: "Structură și istoric",
      randuri: [],
      gol: null,
      vezitot: null,
      legaturi: legaturiStructura,
    });
  }

  if (carduri.length === 0) return null;

  return (
    <section
      aria-labelledby="titlu-in-alte-module"
      className="rounded-panou border-border bg-surface shadow-ridicat border p-5"
    >
      <h2 id="titlu-in-alte-module" className="text-sectiune mb-1 font-medium">
        În alte module
      </h2>
      <p className="text-muted-foreground text-nota mb-4">
        Ce ține de {esteFisaProprie ? "dvs." : "această persoană"} în restul aplicației. Apar doar
        modulele pe care le puteți deschide.
      </p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {carduri.map((card) => (
          <CardLegaturi key={card.cheie} card={card} />
        ))}
      </div>
    </section>
  );
}
