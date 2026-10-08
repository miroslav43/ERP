// src/components/layout/breadcrumb.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { NAV_ITEMS } from "@/config/navigation";
import { tiparulCaii } from "@/config/porti-ruta";

/**
 * Etichetele segmentelor care NU sunt destinații de meniu.
 *
 * Ce e în meniu vine din `NAV_ITEMS` (vezi mai jos): o singură sursă, deja
 * diacritizată corect, care nu poate ieși din acord cu railul. Aici rămân doar
 * segmentele intermediare și de acțiune — cele care nu apar nicăieri în meniu.
 *
 * Lista e completă față de arborele de rute din `(app)`, verificată mecanic:
 * `find "src/app/(app)" -type d | tr '/' '\n' | sort -u`. Nu e o listă „cu ce
 * mi-a venit în minte": fallback-ul de dedesubt garanta text GREȘIT, nu
 * aproximativ — `anunturi` devenea „Anunturi", `mentenanta` devenea
 * „Mentenanta", `ssm` devenea „Ssm", iar CLAUDE.md cere ș/ț cu virgulă în tot
 * ce e de domeniu.
 */
const SEGMENTE: Readonly<Record<string, string>> = {
  accidente: "Accidente",
  adeverinta: "Adeverință",
  anomalii: "Anomalii",
  aprobare: "Aprobare",
  aprobari: "Aprobări",
  atribuire: "Atribuire",
  audit: "Jurnal de audit",
  autorizatii: "Autorizații",
  biblioteca: "Bibliotecă",
  calendar: "Calendar",
  coada: "Coada echipei",
  componente: "Sporuri și prime",
  conformitate: "Conformitate",
  cursuri: "Cursuri",
  "cursurile-mele": "Cursurile mele",
  declaratie: "Declarație",
  decont: "Decont",
  documente: "Documente",
  dovada: "Dovadă",
  echipamente: "Echipamente",
  editeaza: "Editare",
  eip: "Echipament de protecție",
  evaluari: "Evaluări",
  foi: "Foi de parcurs",
  import: "Import",
  "in-primire": "Ce am în primire",
  inrolari: "Înrolări",
  instruiri: "Instruiri",
  interventii: "Intervenții",
  "istoric-venituri": "Istoric de venituri",
  "medicina-muncii": "Medicina muncii",
  membri: "Membri și invitații",
  notificari: "Notificări",
  nou: "Adăugare",
  noua: "Adăugare",
  organizatie: "Organizație",
  perioade: "Perioade",
  permisiuni: "Permisiuni",
  planuri: "Planuri",
  politica: "Politică",
  popriri: "Popriri",
  profil: "Profilul meu",
  // A ieșit din `NAV_ITEMS` odată cu unificarea REGES într-o singură intrare de
  // meniu: e filă în pagină acum, nu destinație de rail. Fără rândul ăsta,
  // fallback-ul ar fi scris „Propuneri", corect ca ortografie și mut despre
  // ce fel de propuneri.
  propuneri: "Propuneri detașare",
  sabloane: "Șabloane",
  saptamana: "Săptămână",
  sesizari: "Sesizări",
  setari: "Setări",
  sold: "Soldul zilelor",
  stadiu: "Stadiu",
  stingatoare: "Stingătoare",
};

/**
 * Care firimitură e link se decide pe SERVER, din registrul porților de rută
 * (`src/config/porti-ruta.ts`): `Topbar` calculează tiparele pe care rolul
 * curent le poate deschide, cu modulele active, și le dă componentei ca listă.
 * Aici rămâne doar potrivirea căii cu un tipar.
 *
 * Înainte, lista era `NAV_ITEMS` plus două rute scrise de mână, iar un segment
 * UUID devenea link ori de câte ori părintele era rută de meniu. Două defecte
 * ieșeau de aici: `/puncte-lucru/<uuid>` nu are pagină (doar `/afis`), deci
 * firimitura „Detaliu" de pe afiș era un 404 garantat; iar „Parc auto" era link
 * și pentru managerul fără `vehicles:read`, care ateriza în
 * `AccesRestrictionat`. Registrul știe ambele lucruri: ce rute au pagină și ce
 * poartă are fiecare.
 */
/** Eticheta unei rute care e destinație de meniu — scrisă o singură dată, în `NAV_ITEMS`. */
const ETICHETE_RUTA: ReadonlyMap<string, string> = new Map(
  NAV_ITEMS.flatMap((item) => [
    [item.href, item.label] as const,
    ...(item.children ?? []).map((copil) => [copil.href, copil.label] as const),
  ]),
);

const TIPAR_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function tradu(segment: string, href: string): string {
  // Eticheta rutei bate eticheta segmentului: „/concedii/sold" e „Soldul
  // zilelor" fiindcă așa scrie în meniu, nu fiindcă am ghicit din slug.
  const dinMeniu = ETICHETE_RUTA.get(href);
  if (dinMeniu !== undefined) {
    return dinMeniu;
  }
  const cunoscut = SEGMENTE[segment];
  if (cunoscut !== undefined) {
    return cunoscut;
  }
  if (TIPAR_UUID.test(segment)) {
    // Componenta e `"use client"` și citește doar `usePathname()`: numele
    // entității NU poate fi aflat aici. E o limitare structurală, nu o
    // omisiune — numele real cere un breadcrumb randat de pagină, care are
    // entitatea deja încărcată.
    return "Detaliu";
  }
  const curatat = segment.replace(/-/g, " ");
  return curatat.charAt(0).toUpperCase() + curatat.slice(1);
}

/**
 * Firimiturile stau ÎN antetul navy, nu în pagină — deci paleta lor e cea de pe
 * navy, nu cea de pe crem. `text-muted-foreground` (#5b6478) pe #0f1e3d dă
 * 1,52:1: era text practic invizibil.
 *
 * Nivelurile sunt calculate, ca peste tot pe navy: `white/60` dă 6,67:1 pentru
 * segmentele parcurse și pentru separatoare, `white` (14,66:1) pentru pagina
 * curentă. Diferența dintre „unde ai fost" și „unde ești" rămâne vizibilă fără
 * să coboare vreo treaptă sub prag.
 */
export function Breadcrumb({ tiparePermise }: Readonly<{ tiparePermise: readonly string[] }>) {
  const cale = usePathname();
  const segmente = cale.split("/").filter((segment) => segment.length > 0);

  if (segmente.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Firimituri de navigare" className="min-w-0">
      <ol className="text-corp flex min-w-0 items-center gap-1">
        {segmente.map((segment, indice) => {
          const href = `/${segmente.slice(0, indice + 1).join("/")}`;
          const esteUltim = indice === segmente.length - 1;
          // Link doar spre o pagină care există ȘI pe care rolul o poate deschide.
          const esteLink = tiparulCaii(href, tiparePermise) !== null;
          return (
            <li key={href} className="flex min-w-0 items-center gap-1">
              {indice > 0 ? (
                <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-white/60" />
              ) : null}
              {esteUltim ? (
                <span aria-current="page" className="truncate font-medium text-white">
                  {tradu(segment, href)}
                </span>
              ) : esteLink ? (
                <Link
                  href={href}
                  className="truncate text-white/60 transition-colors hover:text-white"
                >
                  {tradu(segment, href)}
                </Link>
              ) : (
                // Fără rută proprie ⇒ text, nu link. Un link mort e mai rău
                // decât o firimitură care doar spune unde ești.
                <span className="truncate text-white/60">{tradu(segment, href)}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
