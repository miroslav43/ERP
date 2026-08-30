// src/app/(app)/functii/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Briefcase } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { Schelet } from "@/components/ui/schelet";
import { StareGoala } from "@/components/ui/stare-goala";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { scrieSortare } from "@/lib/queries/cursor";
import { listeazaFunctii, type FunctieListata } from "@/lib/queries/job-positions";
import { angajatiPentruAtribuire } from "@/lib/queries/employees";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { filtreFunctiiSchema } from "@/schemas/job-position";

import { ActiuniFunctie } from "./actiuni-functie";
import { FiltreFunctii } from "./filtre-functii";
import { FormularFunctieNoua } from "./formular-functie-noua";

export const metadata: Metadata = { title: "Funcții" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface ProprietatiTabel {
  readonly organizationId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
  readonly poateEdita: boolean;
  readonly poateAtribui: boolean;
  readonly poateNumaraAngajati: boolean;
}

async function TabelFunctii({
  organizationId,
  parametri,
  poateEdita,
  poateAtribui,
  poateNumaraAngajati,
}: ProprietatiTabel) {
  const filtre = filtreDinUrl(filtreFunctiiSchema, parametri);
  const [{ randuri, totalNefiltrat, faraCor, trunchiat, sortare }, angajati] = await Promise.all([
    listeazaFunctii(organizationId, filtre, poateNumaraAngajati),
    // Fișele se citesc doar pentru cine poate și atribui: fără drept, caseta de
    // bife nu se randează, deci lista ar fi un drum la bază pentru nimic.
    poateAtribui ? angajatiPentruAtribuire(organizationId) : [],
  ]);

  /*
   * Denumirile funcțiilor, ca să scrie „acum: Sudor" lângă cine deține deja
   * alta. Se construiește din rândurile DEJA citite, nu dintr-o a doua
   * interogare — dar tocmai de aceea e parțială: lista e filtrată, deci un om
   * poate deține o funcție care nu trece de filtrul curent. Caseta cade atunci
   * pe „altă funcție", ceea ce e adevărat și suficient: bifa mută pe cineva,
   * iar asta se vede, chiar dacă nu se poate numi de pe unde.
   */
  const denumiriFunctii = Object.fromEntries(randuri.map((rand) => [rand.id, rand.denumire]));

  const areFiltre = filtre.q !== null || filtre.stare !== null || filtre.cor !== null;

  /**
   * Adresele se construiesc din parametrii EXISTENȚI, nu dintr-un obiect gol:
   * altfel o sortare ar șterge filtrele alese.
   */
  function adresa(schimba: (p: URLSearchParams) => void): string {
    const p = new URLSearchParams();
    for (const [cheie, valoare] of Object.entries(parametri)) {
      if (typeof valoare === "string" && valoare !== "") p.set(cheie, valoare);
    }
    schimba(p);
    return p.size === 0 ? "/functii" : `/functii?${p.toString()}`;
  }

  const coloane: readonly Coloana<FunctieListata>[] = [
    {
      cheie: "denumire",
      antet: "Funcție",
      sortabil: true,
      peTelefon: "titlu",
      // Numai `<span>`-uri: pe telefon celula asta e randată în slotul de titlu
      // al cardului, care e el însuși un `<span>`. Un `<div>` acolo ar fi
      // conținut invalid într-un element de frază.
      celula: (rand) => (
        <span className="block min-w-0">
          <span className="font-medium">{rand.denumire}</span>
          {rand.descriere === null ? null : (
            // Descrierea nu merită o coloană — e liberă și lungă — dar nici nu
            // trebuie pierdută: stă sub denumire, pe un rând, tăiată. `max-w-md`
            // e necesar, nu decorativ: `truncate` fără lățime mărginită nu taie
            // nimic într-o celulă de tabel, doar lățește coloana.
            <span className="text-muted-foreground text-nota block max-w-md truncate max-md:hidden">
              {rand.descriere}
            </span>
          )}
        </span>
      ),
    },
    {
      cheie: "cod",
      antet: "Cod intern",
      sortabil: true,
      latime: "ingusta",
      peTelefon: "meta",
      celula: (rand) => <span className="font-mono">{rand.cod}</span>,
    },
    {
      cheie: "cor",
      antet: "Cod COR",
      sortabil: true,
      peTelefon: "meta",
      celula: (rand) =>
        rand.cod_cor === null ? (
          // Fără insignă de avertisment pe rând: lipsa e semnalată o dată, în
          // calloutul de sus, cu tot cu numărul ei și cu drumul către listă.
          // Repetată pe fiecare rând, ar face dintr-o listă de lucru un zid roșu.
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="font-mono">{rand.cod_cor}</span>
            {rand.ocupatie === null ? (
              // Fără `cuAvertisment`: docblocul lui `badge.tsx` rezervă
              // pictograma stării „Expirat”. Reutilizată aici, ar slăbi exact
              // semnalul pe care îl păzește.
              <Badge ton="atentie">Cod inexistent în COR</Badge>
            ) : (
              <span className="text-muted-foreground">{rand.ocupatie}</span>
            )}
          </span>
        ),
    },
    {
      cheie: "nivel_studii",
      antet: "Studii",
      latime: "ingusta",
      peTelefon: "meta",
      celula: (rand) => rand.nivel_studii ?? <span className="text-muted-foreground">—</span>,
    },
    ...(poateNumaraAngajati
      ? [
          {
            cheie: "angajati",
            antet: "Angajați",
            sortabil: true,
            numeric: true,
            latime: "ingusta",
            peTelefon: "meta",
            // Cifra duce la lista DEJA FILTRATĂ — tiparul din `indicator.tsx`:
            // „o cifră fără drum e o fundătură”. Zero n-are unde duce.
            celula: (rand: FunctieListata) =>
              rand.numarAngajati === null || rand.numarAngajati === 0 ? (
                <span className="text-muted-foreground">0</span>
              ) : (
                <Link
                  href={`/angajati?job_position_id=${rand.id}`}
                  className="hover:text-primary underline underline-offset-2"
                >
                  {rand.numarAngajati}
                  <span className="sr-only"> angajați pe funcția {rand.denumire}</span>
                </Link>
              ),
          } satisfies Coloana<FunctieListata>,
        ]
      : []),
    {
      cheie: "stare",
      antet: "Stare",
      latime: "ingusta",
      peTelefon: "insigna",
      // Insigna apare NUMAI pentru funcțiile dezactivate. Într-un nomenclator
      // aproape tot e activ, iar o pastilă „Activă” pe fiecare rând ar fi
      // zgomot care ascunde exact excepția pe care omul o caută.
      celula: (rand) => (rand.activ ? null : <Badge ton="neutru">Inactivă</Badge>),
    },
    ...(poateEdita || poateAtribui
      ? [
          {
            cheie: "actiuni",
            antet: "Acțiuni",
            antetAscuns: true,
            latime: "ingusta",
            // „insignă”, nu „meta”: `ActiuniFunctie` randează un `<div>`, iar
            // rândul mărunt al cardului e un `<p>` — browserul l-ar închide
            // devreme și hidratarea ar cădea. Vezi `pontaj/perioade/page.tsx`.
            peTelefon: "insigna",
            celula: (rand: FunctieListata) => (
              <ActiuniFunctie
                functie={rand}
                poateEdita={poateEdita}
                poateAtribui={poateAtribui}
                angajati={angajati}
                denumiriFunctii={denumiriFunctii}
              />
            ),
          } satisfies Coloana<FunctieListata>,
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      {faraCor > 0 && filtre.cor === null ? (
        <Callout
          fel="atentie"
          titlu={
            faraCor === 1 ? "O funcție nu are cod COR" : `${String(faraCor)} funcții nu au cod COR`
          }
          actiune={
            <Link
              href={adresa((p) => {
                p.set("cor", "lipsa");
              })}
              className="text-corp font-medium underline underline-offset-2"
            >
              Arată-le
            </Link>
          }
        >
          Contractul individual de muncă și exportul REVISAL cer codul ocupației. Fără el, funcția
          nu poate fi pusă pe un contract nou.
        </Callout>
      ) : null}

      <FiltreFunctii filtre={filtre} />

      <Tabel
        caption="Nomenclatorul de funcții al organizației"
        coloane={coloane}
        randuri={randuri}
        cheieRand={(rand) => rand.id}
        sortare={sortare}
        hrefSortare={(s) =>
          adresa((p) => {
            p.set("sort", scrieSortare(s));
          })
        }
        densitate="confortabil"
        trunchiat={trunchiat}
        gol={
          totalNefiltrat === 0 ? (
            <StareGoala
              fel="initiala"
              pictograma={Briefcase}
              titlu="Nicio funcție înregistrată"
              descriere="Adăugați prima funcție — codul intern, denumirea și codul din Clasificarea Ocupațiilor din România."
            />
          ) : (
            <StareGoala
              fel="filtrata"
              pictograma={Briefcase}
              titlu="Nicio funcție nu corespunde filtrelor"
              descriere="Nomenclatorul are funcții, dar niciuna nu trece de filtrele alese. Ștergeți-le sau căutați altceva."
              {...(areFiltre ? { actiune: { eticheta: "Șterge filtrele", href: "/functii" } } : {})}
            />
          )
        }
      />
    </div>
  );
}

export default async function PaginaFunctii({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "nucleu");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  /**
   * Poarta repetă EXACT ce spune `job_positions_select` (`0005_hr_rls.sql:147`):
   * nomenclatorul se deschide și cui are `departments:read`, și cui are
   * `employees:read`. Un `manager` n-are niciun rând `departments` în
   * `role_permissions`, dar are `employees:read = team` — și are nevoie de
   * nomenclator, fiindcă oamenii lui au funcții.
   *
   * Verificarea de dinainte era `scopeFor(…, "departments:read") !== "none"`.
   * Pentru un rol fără NICIUN rând pe resursă, `scopeFor` întoarce `null`, nu
   * `"none"` — deci trecea. Rezultatul era același, dar din întâmplare: dacă
   * cineva ar fi adăugat vreodată un rând explicit `('manager','departments',
   * 'none', …)`, pagina ar fi început să refuze un rol pe care baza îl lasă să
   * citească. `can()` cu pragul implicit `own` spune ce trebuie: „are vreun
   * drept, oricare”.
   */
  const vedeNomenclatorul =
    can(permisiuni, "departments:read") || can(permisiuni, "employees:read");

  if (!vedeNomenclatorul) {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta nomenclatorul de funcții." />;
  }

  const poateCrea = can(permisiuni, "departments:create", "all");
  const poateEdita = can(permisiuni, "departments:update", "all");
  /*
   * Atribuirea scrie în `employees`, deci cere `employees:update`, NU
   * `departments:update` ca restul modulului. Azi cele două se suprapun exact
   * (org_admin, hr, super_admin — verificat în `role_permissions`), dar sunt
   * rânduri distincte în seed: legate una de alta, o despărțire viitoare ar
   * ascunde butonul de la cineva care are dreptul, tăcut.
   */
  const poateAtribui = can(permisiuni, "employees:update", "all");

  /**
   * Numărătoarea de angajați cere `employees:read = all` EXACT.
   *
   * Cu `team` sau `own`, aceleași politici RLS care deschid nomenclatorul ar
   * lăsa să treacă doar o parte din angajați, iar rândul ar scrie „Sudor · 1
   * angajat” acolo unde sunt nouă. O cifră lipsă se vede; una parțială nu.
   */
  const poateNumaraAngajati = can(permisiuni, "employees:read", "all");

  const parametri = await searchParams;

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Funcții"
        descriere="Nomenclatorul de funcții al companiei. Codul COR (Clasificarea Ocupațiilor din România) e necesar pentru contract și pentru exportul REVISAL."
        {...(poateCrea ? { actiuni: <FormularFunctieNoua /> } : {})}
      />

      {/* `key` pe parametri: fără el, Suspense ar refolosi conținutul vechi la o
          schimbare de filtru, deci scheletul n-ar mai apărea și ecranul ar părea
          înghețat până sosesc rândurile noi. */}
      <Suspense
        key={JSON.stringify(parametri)}
        // Numărul de coloane al scheletului urmează coloanele REALE, care
        // depind de permisiuni: patru fixe + starea, plus angajații și
        // acțiunile, dacă rolul le are. Un schelet cu alt număr de coloane
        // produce exact saltul de layout pe care ar trebui să-l acopere.
        fallback={
          <Schelet
            forma="tabel"
            coloane={5 + (poateNumaraAngajati ? 1 : 0) + (poateEdita || poateAtribui ? 1 : 0)}
          />
        }
      >
        <TabelFunctii
          organizationId={tenant.organizationId}
          parametri={parametri}
          poateEdita={poateEdita}
          poateAtribui={poateAtribui}
          poateNumaraAngajati={poateNumaraAngajati}
        />
      </Suspense>
    </div>
  );
}
