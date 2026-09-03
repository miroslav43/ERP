// src/app/(app)/cursuri/conformitate/page.tsx
//
// Matricea angajat × curs obligatoriu.
//
// ── DE CE NU FOLOSEȘTE `<Tabel>` ─────────────────────────────────────────
// `Tabel` se transformă automat în listă de carduri sub 768 px, câte un card
// per rând. Pentru o matrice asta e greșit: ar produce un card cu N coloane
// fără antet. Aici întoarcerea e alta — un card per ANGAJAT, cu lista lui de
// cursuri — deci matricea e scrisă direct, cu `<table>` pe laptop și cu carduri
// pe telefon, ambele în același DOM.
//
// ── CIFRE ABSOLUTE ───────────────────────────────────────────────────────
// Sub 25 de persoane nu se afișează niciun procent. „62,5 % conformitate" pe
// opt oameni e o minciună cu trei zecimale: un singur om mută cifra cu 12,5
// puncte.

import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Indicator } from "@/components/ui/indicator";
import { Scadenta } from "@/components/ui/scadenta";
import { StareGoala } from "@/components/ui/stare-goala";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import {
  cheieCelula,
  cursuriObligatoriiNepublicate,
  matriceConformitate,
  type CelulaConformitate,
} from "@/lib/queries/cursuri";
import { textProgres, treaptaTermen, treaptaValabilitate } from "@/domain/cursuri/scadente";
import type { TreaptaScadenta } from "@/domain/scadente";

import { NavCursuri } from "../nav-cursuri";

export const metadata: Metadata = { title: "Conformitate" };

/**
 * Treapta unei celule.
 *
 * `lipsa` pentru „neatribuit", nu `neaplicabil`: un curs obligatoriu pe care
 * omul nu l-a primit niciodată e mai grav decât unul expirat de ieri — nu
 * există nici măcar un istoric din care să se calculeze o scadență. Aceeași
 * ordonare ca la SSM și la flotă.
 */
function treaptaCelula(celula: CelulaConformitate | undefined, azi: string): TreaptaScadenta {
  if (celula === undefined) return "lipsa";
  if (celula.status === "finalizat") {
    return treaptaValabilitate(celula.expiraLa, azi, celula.pragAvertizareZile);
  }
  if (celula.status === "expirat") return "expirat";
  /*
   * Un curs atribuit, neînceput și FĂRĂ TERMEN (posibil de la migrarea 0085)
   * n-are ce rata, deci nu e nici „curând", nici „critic". Dar nici
   * `neaplicabil` nu e: aia înseamnă „nu i se cere", iar aici i se cere.
   * `in_regula` — nimic nu e în neregulă, dar cursul apare ca nefăcut în
   * numărătoarea de mai jos, care se uită la STATUS, nu la treaptă.
   */
  if (celula.termen === null) return "in_regula";
  return treaptaTermen(celula.termen, azi, celula.status ?? "neinceput");
}

/** Cine e efectiv acoperit: a parcurs cursul și parcurgerea încă e valabilă. */
function esteLaZi(celula: CelulaConformitate | undefined, treapta: TreaptaScadenta): boolean {
  return celula?.status === "finalizat" && treapta !== "expirat";
}

function textCelula(celula: CelulaConformitate | undefined): string {
  if (celula === undefined) return "Neatribuit";
  if (celula.status === "finalizat") {
    return celula.expiraLa === null ? "Parcurs" : `Până la ${formatDate(celula.expiraLa)}`;
  }
  if (celula.status === "expirat") return "Expirat";
  return celula.termen === null ? "În curs" : formatDate(celula.termen);
}

export default async function PaginaConformitate() {
  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "courses"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  const scope = scopeFor(permisiuni, "courses:read");
  if (scope === null || scope === "none" || !can(permisiuni, "courses:read", "team")) {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta conformitatea." />;
  }

  const { angajati, cursuri, celule } = await matriceConformitate(tenant.organizationId);
  const azi = todayInBucharest();

  /*
   * Diagnosticul stării goale, cerut doar când chiar e goală.
   *
   * „Niciun curs obligatoriu publicat" e adevărat și inutil: administratorul
   * care tocmai a bifat „Curs obligatoriu" nu are cum să lege propoziția de
   * cursul lui. Aici i se spune care e cursul, ce-i lipsește ca să fie
   * publicabil, și drumul până la el.
   */
  const nepublicate =
    cursuri.length === 0 ? await cursuriObligatoriiNepublicate(tenant.organizationId) : [];
  const primul = nepublicate[0];

  const total = angajati.length * cursuri.length;
  let laZi = 0;
  let lipsa = 0;
  let critic = 0;
  for (const angajat of angajati) {
    for (const curs of cursuri) {
      const celula = celule.get(cheieCelula(angajat.id, curs.id));
      const treapta = treaptaCelula(celula, azi);
      /*
       * „La zi" se numără din STATUS, nu din treaptă.
       *
       * Varianta de dinainte punea `in_regula` și `neaplicabil` la un loc, deci
       * un curs obligatoriu atribuit și NEÎNCEPUT se număra drept acoperit —
       * cifra spunea „toată lumea e în regulă" exact despre oamenii care încă
       * n-au făcut nimic. Cu termene opționale (0085) cazul ar fi devenit
       * obișnuit, nu marginal.
       */
      if (esteLaZi(celula, treapta)) laZi += 1;
      else if (treapta === "lipsa") lipsa += 1;
      else if (treapta === "expirat" || treapta === "critic") critic += 1;
    }
  }

  return (
    <div className={`${LATIMI.lista} space-y-6`}>
      <AntetPagina
        titlu="Conformitate"
        descriere="Cine are la zi cursurile obligatorii ale firmei."
        file={<NavCursuri activ="conformitate" />}
      />

      {cursuri.length === 0 || angajati.length === 0 ? (
        <StareGoala
          fel="initiala"
          pictograma={ShieldCheck}
          titlu={
            cursuri.length > 0
              ? "Niciun angajat activ"
              : primul === undefined
                ? "Niciun curs obligatoriu publicat"
                : nepublicate.length === 1
                  ? `„${primul.denumire}” nu e publicat încă`
                  : `${String(nepublicate.length)} cursuri obligatorii nu sunt publicate`
          }
          descriere={
            cursuri.length > 0
              ? "Adăugați angajați ca să apară aici."
              : primul === undefined
                ? "Matricea arată doar cursurile marcate ca obligatorii și publicate. Marcați un curs ca obligatoriu din formularul lui."
                : primul.lectii === 0
                  ? "Matricea arată doar cursurile publicate. Cursul e marcat ca obligatoriu, dar nu are nicio lecție — adăugați cel puțin un material din bibliotecă, apoi publicați-l."
                  : "Matricea arată doar cursurile publicate. Cursul are deja lecții: mai rămâne să-l publicați."
          }
          actiune={
            cursuri.length > 0
              ? { eticheta: "Deschideți lista de angajați", href: "/angajati" }
              : primul === undefined
                ? { eticheta: "Vedeți cursurile", href: "/cursuri" }
                : {
                    eticheta:
                      nepublicate.length === 1
                        ? "Deschideți cursul"
                        : "Vedeți cursurile nepublicate",
                    href: nepublicate.length === 1 ? `/cursuri/${primul.id}` : "/cursuri",
                  }
          }
        />
      ) : (
        <>
          {/*
            Indicatorii de aici rămân fără `href`, spre deosebire de cei din
            `stadiu`. Nu din neglijență: nu există nicio listă filtrată către
            care să trimită — conformitatea e o matrice, iar detaliul util e
            celula, nu o sublistă. O cifră cu drum inventat e mai rea decât una
            fără drum: promite o filtrare care nu există.
          */}
          <section aria-label="Rezumat" className="grid gap-3 sm:grid-cols-3">
            <Indicator
              eticheta="Parcurse și valabile"
              valoare={textProgres(laZi, total, "situații")}
              esteCuvant
              ton={laZi === total ? "bun" : "neutru"}
            />
            <Indicator
              eticheta="Neatribuite"
              valoare={String(lipsa)}
              ton={lipsa === 0 ? "bun" : "atentie"}
              nota={lipsa === 0 ? "Toată lumea are ce-i trebuie." : "Cursuri obligatorii nedate."}
            />
            <Indicator
              eticheta="Expirate sau pe ultima sută"
              valoare={String(critic)}
              ton={critic === 0 ? "bun" : "pericol"}
            />
          </section>

          {/* Laptop: matricea propriu-zisă. La opt angajați și șase cursuri
              încape întreagă, fără derulare — avantajul scării mici. */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse">
              <caption className="sr-only">
                Matricea de conformitate: angajați pe rânduri, cursuri obligatorii pe coloane.
              </caption>
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="border-border text-eticheta border-b p-2 text-start uppercase"
                  >
                    Persoană
                  </th>
                  {cursuri.map((curs) => (
                    <th
                      key={curs.id}
                      scope="col"
                      className="border-border text-eticheta border-b p-2 text-start uppercase"
                    >
                      {curs.denumire}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {angajati.map((angajat) => (
                  <tr key={angajat.id}>
                    <th scope="row" className="border-border border-b p-2 text-start font-medium">
                      {angajat.nume}
                    </th>
                    {cursuri.map((curs) => {
                      const celula = celule.get(cheieCelula(angajat.id, curs.id));
                      return (
                        <td key={curs.id} className="border-border border-b p-2">
                          <Scadenta treapta={treaptaCelula(celula, azi)}>
                            {textCelula(celula)}
                          </Scadenta>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Telefon: un card per ANGAJAT, cu lista lui de cursuri. */}
          <ul className="space-y-3 md:hidden">
            {angajati.map((angajat) => (
              <li key={angajat.id} className="bg-surface border-border rounded-panou border p-3">
                <p className="font-medium">{angajat.nume}</p>
                <ul className="mt-2 space-y-1">
                  {cursuri.map((curs) => {
                    const celula = celule.get(cheieCelula(angajat.id, curs.id));
                    return (
                      <li
                        key={curs.id}
                        className="flex flex-wrap items-center justify-between gap-2"
                      >
                        <span className="text-corp">{curs.denumire}</span>
                        <Scadenta treapta={treaptaCelula(celula, azi)}>
                          {textCelula(celula)}
                        </Scadenta>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
