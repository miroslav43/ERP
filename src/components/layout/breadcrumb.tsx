// src/components/layout/breadcrumb.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { NAV_ITEMS } from "@/config/navigation";

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
  anomalii: "Anomalii",
  aprobare: "Aprobare",
  aprobari: "Aprobări",
  audit: "Jurnal de audit",
  autorizatii: "Autorizații",
  calendar: "Calendar",
  coada: "Coada echipei",
  componente: "Sporuri și prime",
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
  sabloane: "Șabloane",
  saptamana: "Săptămână",
  sesizari: "Sesizări",
  setari: "Setări",
  sold: "Soldul zilelor",
  stingatoare: "Stingătoare",
};

/**
 * Rutele despre care ȘTIM că au pagină, deci care pot fi linkuri.
 *
 * `NAV_ITEMS` e sursa (părinți + copii), plus cele două ecrane la care se
 * ajunge din antet, nu din meniu. Orice alt prefix se randează ca TEXT.
 *
 * Motivul e concret, nu de principiu: `/setari` e un prefix din `(app)` fără
 * `page.tsx`, parcurs zilnic, fiindcă `href`-ul lui de meniu e
 * `/setari/organizatie`. Firimitura „Setări" era link către `/setari`, adică un
 * 404 garantat — și, cum `(app)` n-are `not-found.tsx`, un 404 care iese cu
 * totul din învelișul navy.
 *
 * `/evaluari` era al doilea astfel de prefix. Are pagină acum, iar `href`-ul lui
 * de meniu o arată, deci intră aici prin `NAV_ITEMS` ca orice altă rută. Lista
 * nu s-a scurtat cu o excepție scrisă de mână; s-a scurtat fiindcă excepția a
 * dispărut.
 */
const RUTE_CU_PAGINA: ReadonlySet<string> = new Set<string>([
  "/profil",
  "/notificari",
  ...NAV_ITEMS.flatMap((item) => [item.href, ...(item.children ?? []).map((copil) => copil.href)]),
]);

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
export function Breadcrumb() {
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
          // Un segment de detaliu (`/angajati/<uuid>`) e o pagină reală în tot
          // proiectul, dar numai sub un modul care e el însuși o rută cunoscută.
          const parinte = `/${segmente.slice(0, indice).join("/")}`;
          const esteLink =
            RUTE_CU_PAGINA.has(href) || (TIPAR_UUID.test(segment) && RUTE_CU_PAGINA.has(parinte));
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
