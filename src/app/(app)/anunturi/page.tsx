// src/app/(app)/anunturi/page.tsx
import type { Metadata } from "next";
import { Megaphone } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { ComutatorVizualizare } from "@/components/ui/comutator-vizualizare";
import { StareGoala } from "@/components/ui/stare-goala";
import {
  FILTRU_IMPLICIT,
  filtruDinAdresa,
  numaraPeStari,
  potrivesteFiltru,
  stareAnunt,
  type FiltruStareAnunt,
} from "@/domain/announcements/anunt";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { idFisaProprie } from "@/lib/queries/employees";
import { idAnunturiCitite, LIMITA_ANUNTURI, listeazaAnunturi } from "@/lib/queries/announcements";

import { CardAnunt } from "./card-anunt";
import { DialogAnuntNou } from "./dialog-anunt-nou";

export const metadata: Metadata = { title: "Anunțuri" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Antetul unei grupe. `text-eticheta` e treapta scrisă anume pentru majuscule cu tracking. */
function AntetGrupa({ children }: { readonly children: string }) {
  return (
    <h2 className="text-muted-foreground text-eticheta font-medium tracking-[0.14em] uppercase">
      {children}
    </h2>
  );
}

export default async function PaginaAnunturi({ searchParams }: ProprietatiPagina) {
  const { tenant, user } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "announcements"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "announcements:read", "own")) {
    return (
      <div>
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta avizierul." />
      </div>
    );
  }

  const poateAdministra = can(permisiuni, "announcements:update", "all");
  const parametri = await searchParams;

  /*
   * Fișa proprie pleacă ODATĂ cu lista, nu după ea: marcajul „necitit" n-are
   * nevoie de niciun rând din listă ca să fie cerut, iar în serie ar fi adăugat
   * un drum întreg la bază pentru o bulină.
   *
   * Poate lipsi — un administrator invitat e membru fără să fie angajat. Fără
   * fișă nu există `announcement_reads`, deci niciun anunț nu apare ca necitit,
   * ceea ce e corect: n-are cine să confirme.
   */
  const [{ randuri: anunturi, trunchiat }, propriaFisaId] = await Promise.all([
    listeazaAnunturi(tenant.organizationId),
    idFisaProprie(tenant.organizationId, user.id),
  ]);
  const citite =
    propriaFisaId === null
      ? new Set<string>()
      : await idAnunturiCitite(tenant.organizationId, propriaFisaId);

  /*
   * Starea și filtrarea se fac ÎN MEMORIE, nu în interogare. Lista e deja
   * plafonată la `LIMITA_ANUNTURI`, deci nu e nimic de economisit la rețea — în
   * schimb, contoarele de pe comutator („Ciorne 3") au nevoie de TOATE rândurile
   * ca să spună adevărul. Cu filtrarea în SQL, fiecare segment ar fi cerut o
   * interogare proprie doar ca să-și afle propriul număr.
   */
  const acum = new Date();
  const cuStare = anunturi.map((anunt) => ({ anunt, stare: stareAnunt(anunt, acum) }));
  const contoare = numaraPeStari(cuStare.map((x) => x.stare));

  // Filtrul e al administratorului: RLS îi arată angajatului doar anunțurile
  // active, deci pentru el toate cele patru segmente ar da aceeași listă.
  const filtru: FiltruStareAnunt = poateAdministra
    ? filtruDinAdresa(parametri["stare"])
    : FILTRU_IMPLICIT;

  const vizibile = cuStare.filter((x) => potrivesteFiltru(x.stare, filtru));
  const fixate = vizibile.filter((x) => x.anunt.fixat);
  const restul = vizibile.filter((x) => !x.anunt.fixat);

  const necitite = cuStare.filter((x) => x.stare === "activ" && !citite.has(x.anunt.id)).length;

  const descriere =
    necitite > 0
      ? `Avizierul organizației. ${necitite === 1 ? "Un anunț nu e citit încă" : `${String(necitite)} anunțuri nu sunt citite încă`}.`
      : "Avizierul organizației.";

  return (
    <div className={`${LATIMI.formular} space-y-6`}>
      <AntetPagina
        titlu="Anunțuri"
        descriere={descriere}
        actiuni={poateAdministra ? <DialogAnuntNou /> : undefined}
        file={
          poateAdministra && anunturi.length > 0 ? (
            <ComutatorVizualizare
              /*
               * `self-start` fiindcă `file` e copil al unui `flex flex-col`:
               * implicitul `align-self: stretch` întindea comutatorul pe toată
               * lățimea antetului, cu un chenar gol de 600px în dreapta ultimului
               * segment. `inline-flex` din primitivă nu-l apără — regula de
               * aliniere a părintelui bate nivelul de afișare al copilului.
               *
               * `flex-wrap` fiindcă la 390px cele patru segmente cu contoare fac
               * 409px: măsurat, pagina depășea ecranul cu 19px, iar „Expirate"
               * era tăiat. Împreună cu `self-start`, grupul se strânge la lățimea
               * disponibilă și trece pe două rânduri.
               */
              className="flex-wrap self-start"
              eticheta="Starea anunțurilor"
              cheieParametru="stare"
              curenta={filtru}
              implicita={FILTRU_IMPLICIT}
              parametri={parametri}
              cale="/anunturi"
              optiuni={[
                { cheie: "toate", eticheta: `Toate ${String(contoare.toate)}` },
                { cheie: "active", eticheta: `Active ${String(contoare.active)}` },
                { cheie: "ciorne", eticheta: `Ciorne ${String(contoare.ciorne)}` },
                { cheie: "expirate", eticheta: `Expirate ${String(contoare.expirate)}` },
              ]}
            />
          ) : undefined
        }
      />

      {vizibile.length === 0 ? (
        anunturi.length === 0 ? (
          <StareGoala
            fel="initiala"
            pictograma={Megaphone}
            titlu="Niciun anunț"
            descriere={
              poateAdministra
                ? "Scrieți primul anunț. Publicarea trimite o notificare fiecărui membru activ al firmei."
                : "Nu există încă niciun anunț publicat."
            }
          />
        ) : (
          <StareGoala
            fel="filtrata"
            pictograma={Megaphone}
            titlu="Niciun anunț în starea asta"
            descriere="Avizierul are anunțuri, dar niciunul nu intră în segmentul ales."
            actiune={{ eticheta: "Arată toate anunțurile", href: "/anunturi" }}
          />
        )
      ) : (
        <div className="space-y-6">
          {fixate.length === 0 ? null : (
            <section className="space-y-2">
              <AntetGrupa>Fixate</AntetGrupa>
              <ul className="space-y-2">
                {fixate.map(({ anunt, stare }) => (
                  <CardAnunt
                    key={anunt.id}
                    anunt={anunt}
                    stare={stare}
                    necitit={stare === "activ" && propriaFisaId !== null && !citite.has(anunt.id)}
                  />
                ))}
              </ul>
            </section>
          )}

          {restul.length === 0 ? null : (
            <section className="space-y-2">
              {/* Antetul celei de-a doua grupe apare doar dacă există o primă
                  grupă de care să o despartă. Singur, ar fi o etichetă pusă
                  peste tot ce e pe ecran — adică pe nimic. */}
              {fixate.length === 0 ? null : <AntetGrupa>Restul anunțurilor</AntetGrupa>}
              <ul className="space-y-2">
                {restul.map(({ anunt, stare }) => (
                  <CardAnunt
                    key={anunt.id}
                    anunt={anunt}
                    stare={stare}
                    necitit={stare === "activ" && propriaFisaId !== null && !citite.has(anunt.id)}
                  />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {trunchiat ? (
        <p role="status" className="text-muted-foreground text-nota">
          Lista se oprește la {LIMITA_ANUNTURI} de anunțuri, cele mai recente. Avizierul mai are și
          altele, mai vechi, care nu apar aici.
        </p>
      ) : null}
    </div>
  );
}
