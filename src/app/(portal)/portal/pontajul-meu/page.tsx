// src/app/(portal)/portal/pontajul-meu/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { CalendarDays, Clock, CalendarClock, LayoutList } from "lucide-react";
import { z } from "zod";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { buton } from "@/components/ui/buton";
import { ComutatorVizualizare } from "@/components/ui/comutator-vizualizare";
import { StareGoala } from "@/components/ui/stare-goala";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, formatMonthYear, todayInBucharest } from "@/lib/format/date";
import { formatOraZi, formatOre } from "@/lib/format/ore";
import { anDinUrl } from "@/lib/rute/parametri";
import { pontajulMeu, fisaMea } from "@/lib/queries/portal";

import { ETICHETE_TIP_ZI } from "../etichete";

import { FaraFisa } from "../fara-fisa";
import { GrilaLuna } from "./grila-luna";

export const metadata: Metadata = { title: "Pontajul meu" };

/**
 * Vizualizarea stă în ADRESĂ, nu în stare de client: supraviețuiește
 * reîncărcării, se poate trimite cuiva prin copy-paste și dă un buton „înapoi”
 * care funcționează. Același tipar ca `/departamente`.
 *
 * `.catch()`, nu `.parse()` strict: o adresă copiată greșit trebuie să cadă pe
 * implicit, nu să strice ecranul cu o eroare de validare.
 */
const VIZUALIZARI = ["calendar", "lista"] as const;
const vizualizareSchema = z.enum(VIZUALIZARI).catch("calendar");

const OPTIUNI_VIZUALIZARE = [
  { cheie: "calendar", eticheta: "Calendar", pictograma: CalendarDays },
  { cheie: "lista", eticheta: "Listă", pictograma: LayoutList },
] as const;

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Luna din URL, cu revenire la luna curentă. Ca `anDinUrl`, dar pentru 1–12. */
function lunaDinUrl(valoare: string | string[] | undefined, implicit: number): number {
  const brut = Array.isArray(valoare) ? valoare[0] : valoare;
  if (brut === undefined) return implicit;
  const parsat = Number(brut);
  if (!Number.isInteger(parsat) || parsat < 1 || parsat > 12) return implicit;
  return parsat;
}

export default async function PaginaPontajulMeu({ searchParams }: ProprietatiPagina) {
  const { tenant, user } = await requireTenant();
  await requireFeature(tenant.organizationId, "attendance");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "attendance:read", "own")) {
    return (
      <div className="p-4">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta pontajul. Cereți-i administratorului organizației dreptul necesar." />
      </div>
    );
  }

  // `fisaMea`, nu `idFisaProprie`: cea din urmă doar SORTEAZĂ după `is_primary`,
  // în timp ce `app.current_employee_id()` — prin care trec toate ramurile `own`
  // din RLS — chiar îl cere. Un cont a cărui unică fișă nu e principală primea
  // altfel un ecran care îi arăta numele și nicio dată, fără nicio explicație.
  // `attendance:create`, nu `:read`: planul e o scriere. Fără dreptul ăsta,
  // butonul ar duce direct într-un refuz.
  const poatePlanifica = can(permisiuni, "attendance:create", "own");

  const stare = await fisaMea(tenant.organizationId, user.id);
  if (stare.stare !== "ok") return <FaraFisa stare={stare} numeOrganizatie={tenant.name} />;
  const propriaFisaId = stare.fisa.id;

  const parametri = await searchParams;
  const azi = todayInBucharest();
  const an = anDinUrl(parametri["an"], Number(azi.slice(0, 4)));
  const luna = lunaDinUrl(parametri["luna"], Number(azi.slice(5, 7)));
  const vizualizare = vizualizareSchema.parse(parametri["vizualizare"]);

  const zile = await pontajulMeu(tenant.organizationId, an, luna, propriaFisaId);

  const total = zile.reduce(
    (s, z) => ({
      lucrate: s.lucrate + (z.ore_lucrate ?? 0),
      suplimentare: s.suplimentare + (z.ore_suplimentare ?? 0),
      noapte: s.noapte + (z.ore_noapte ?? 0),
    }),
    { lucrate: 0, suplimentare: 0, noapte: 0 },
  );

  // Navigarea între luni se face pe șiruri de dată, nu pe `Date`: ziua 1 a lunii
  // convertită în `Date` alunecă peste graniță în funcție de fus.
  const lunaAnterioara = luna === 1 ? { an: an - 1, luna: 12 } : { an, luna: luna - 1 };
  const lunaUrmatoare = luna === 12 ? { an: an + 1, luna: 1 } : { an, luna: luna + 1 };

  /**
   * Săgețile de lună construiesc adresa de la zero, deci trebuie să care mai
   * departe vizualizarea: fără asta, primul „Luna următoare” apăsat din listă
   * te arunca înapoi în calendar, ceea ce arată exact ca un defect. Aceeași
   * scăpare era semnalată în scris la comutatorul din `/rapoarte`.
   *
   * Se omite valoarea IMPLICITĂ, care e acum `calendar` — aceeași pe care o
   * șterge din adresă `ComutatorVizualizare` prin `implicita`. Cele două
   * trebuie să spună mereu același lucru: dacă diverg, săgeata de lună scrie în
   * adresă exact parametrul pe care comutatorul tocmai l-a scos.
   */
  const sufixVizualizare = vizualizare === "calendar" ? "" : `&vizualizare=${vizualizare}`;
  const adresaLuna = (tinta: { readonly an: number; readonly luna: number }) =>
    `/portal/pontajul-meu?an=${String(tinta.an)}&luna=${String(tinta.luna)}${sufixVizualizare}`;

  return (
    <div className={`${LATIMI.lista} space-y-4 p-4`}>
      <AntetPagina
        titlu="Pontajul meu"
        {...(poatePlanifica
          ? {
              actiuni: (
                <Link
                  href="/portal/pontajul-meu/saptamana"
                  className={buton({ varianta: "secundar" })}
                >
                  <CalendarClock aria-hidden="true" className="size-4" />
                  Planul săptămânii
                </Link>
              ),
            }
          : {})}
      />

      <nav aria-label="Alege luna" className="flex items-center justify-between gap-2">
        <Link href={adresaLuna(lunaAnterioara)} className={buton({ varianta: "secundar" })}>
          ← Luna anterioară
        </Link>
        <p className="text-foreground text-corp font-medium">{formatMonthYear(an, luna)}</p>
        <Link href={adresaLuna(lunaUrmatoare)} className={buton({ varianta: "secundar" })}>
          Luna următoare →
        </Link>
      </nav>

      {/* Comutatorul rămâne pe ecran și când luna e goală: altfel omul care a
          ajuns pe o lună fără înregistrări nu mai are de unde să afle că există
          și cealaltă vedere. */}
      <ComutatorVizualizare
        eticheta="Cum se afișează pontajul"
        cheieParametru="vizualizare"
        optiuni={OPTIUNI_VIZUALIZARE}
        curenta={vizualizare}
        implicita="calendar"
        parametri={parametri}
        cale="/portal/pontajul-meu"
      />

      {zile.length === 0 ? (
        <StareGoala
          fel="initiala"
          pictograma={Clock}
          titlu="Nicio zi înregistrată în această lună"
          descriere="Zilele apar aici pe măsură ce sunt completate. Dacă luna s-a încheiat și tot e goală, întrebați responsabilul de pontaj."
        />
      ) : (
        <>
          <section
            aria-label="Totaluri"
            className="bg-primary text-primary-foreground rounded-panou grid grid-cols-3 gap-2 p-4 text-center"
          >
            <Total eticheta="Ore lucrate" valoare={total.lucrate} />
            <Total eticheta="Suplimentare" valoare={total.suplimentare} />
            <Total eticheta="De noapte" valoare={total.noapte} />
          </section>

          {vizualizare === "calendar" ? (
            <GrilaLuna an={an} luna={luna} zile={zile} poateEdita={poatePlanifica} />
          ) : (
            <ul className="space-y-2">
              {zile.map((z) => (
                <li key={z.id}>
                  {/* Rândul e link doar când ziua chiar se poate edita: o zi
                      venită din concediu sau dintr-o lună închisă ar duce la un
                      ecran care explică refuzul, ceea ce e corect — dar un rând
                      care nu reacționează spune mai bine „nu e nimic de făcut
                      aici". */}
                  <ZiRand data={z.data} editabila={poatePlanifica && z.tip_zi === "lucratoare"}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-foreground text-corp font-medium">
                          {formatDate(z.data)}
                        </p>
                        <p className="text-muted-foreground text-nota">
                          {ETICHETE_TIP_ZI[z.tip_zi] ?? z.tip_zi}
                        </p>
                      </div>
                      <div className="text-right">
                        {/*
                          O zi deschisă cu ceasul și neînchisă încă are
                          `ore_lucrate = 0` — adică arată IDENTIC cu o zi
                          legitimă de zero ore. Fără rândul ăsta, singurul semn
                          că cineva a uitat să apese „Am ieșit" ar fi absența
                          orelor la sfârșit de lună, pe fluturaș.
                        */}
                        {z.ora_inceput !== null && z.ora_sfarsit === null ? (
                          <p className="text-warning text-corp font-medium tabular-nums">
                            în curs · de la {formatOraZi(z.ora_inceput) ?? ""}
                          </p>
                        ) : (
                          <p className="text-foreground text-corp tabular-nums">
                            {formatOre(z.ore_lucrate ?? 0)}
                          </p>
                        )}
                        {(z.ore_suplimentare ?? 0) > 0 ? (
                          <p className="text-muted-foreground text-nota tabular-nums">
                            +{formatOre(z.ore_suplimentare ?? 0)} suplimentare
                          </p>
                        ) : null}
                      </div>
                    </div>
                    {z.observatii === null ? null : (
                      <p className="text-muted-foreground text-nota mt-2">{z.observatii}</p>
                    )}
                  </ZiRand>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function Total({ eticheta, valoare }: { readonly eticheta: string; readonly valoare: number }) {
  return (
    <div>
      <p className="text-nota opacity-90">{eticheta}</p>
      <p className="text-cifra font-mono font-semibold tabular-nums">{formatOre(valoare)}</p>
    </div>
  );
}

/**
 * Rândul unei zile: link când e editabilă, simplu card când nu.
 *
 * Un singur element interactiv per rând, niciodată un link într-un link — de
 * aceea decizia se ia aici, nu prin înfășurarea condiționată a conținutului.
 */
function ZiRand({
  data,
  editabila,
  children,
}: {
  readonly data: string;
  readonly editabila: boolean;
  readonly children: React.ReactNode;
}) {
  const clasa = "bg-surface border-border block rounded-panou border p-3";
  if (!editabila) return <div className={clasa}>{children}</div>;
  return (
    <Link
      href={`/portal/pontajul-meu/zi/${data}`}
      className={`${clasa} hover:border-ring transition-colors`}
    >
      {children}
    </Link>
  );
}
