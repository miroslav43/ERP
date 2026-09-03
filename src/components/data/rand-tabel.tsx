// src/components/data/rand-tabel.tsx
"use client";

import { useRouter } from "next/navigation";
import { useTransition, type MouseEvent, type ReactNode } from "react";

import { useSemnalIncarcare } from "@/components/incarcare/use-incarcare";

/**
 * Rândul întreg navighează la `href`, nu doar coloana cu numele — la cererea
 * explicită de a putea apăsa oriunde pe linie. Linkul accesibil pe nume rămâne
 * neatins pentru tastatură/cititor de ecran; acesta e strict o comoditate de
 * mouse suplimentară.
 *
 * Click-urile pe orice element interactiv din interiorul rândului (linkul de
 * pe nume, un buton de acțiune secundară, un checkbox) NU declanșează
 * navigarea dublă — `closest()` le lasă să-și facă treaba lor.
 *
 * DE CE O TRANZIȚIE, ȘI DE CE DOUĂ SEMNE
 * `router.push` gol nu spunea nimănui nimic: pe cele 22 de rute care folosesc
 * tabelul, apăsarea nu schimba niciun pixel până sosea pagina nouă, la peste o
 * secundă. Tranziția dă două lucruri diferite:
 *   - sursa din depozitar aprinde voalul GLOBAL, dar abia la `PRAG_VOAL`
 *     (400 ms, pragul Doherty — sub el un indicator e clipire, nu informație);
 *   - `aria-busy` + estomparea se văd în același cadru cu clicul și spun PE CARE
 *     rând s-a apăsat, singura informație pe care un voal peste tot ecranul nu
 *     o poate da pe o listă de rânduri identice.
 */
export function RandTabel({
  href,
  children,
  className = "",
}: {
  /** `null` când rândul nu are nicio destinație (ex. entitatea legată e ascunsă de RLS) — rândul rămâne un `<tr>` simplu, fără click. */
  readonly href: string | null;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  const router = useRouter();
  // Cele două hook-uri stau ÎNAINTEA ieșirii devreme de mai jos. `href === null`
  // e un caz real, nu teoretic — apare ori de câte ori RLS ascunde entitatea
  // legată — iar sub acea ramură Rules of Hooks ar fi încălcată la primul astfel
  // de rând, adică exact pe ecranele cu drepturi parțiale.
  const [inCurs, porneste] = useTransition();
  useSemnalIncarcare(inCurs);

  if (href === null) {
    return <tr className={className}>{children}</tr>;
  }
  const destinatie = href;

  function gestioneazaClick(evenimet: MouseEvent<HTMLTableRowElement>): void {
    const tinta = evenimet.target as HTMLElement;
    if (tinta.closest("a, button, input, select, textarea, label")) return;
    // Al doilea clic cât timp primul încă navighează ar pune o a doua sursă în
    // depozitar, iar componenta e demontată de chiar navigarea pe care a
    // pornit-o: a doua ar rămâne aprinsă până la `PLAFON_TARE`, 30 de secunde.
    if (inCurs) return;
    // Corp-EXPRESIE, nu bloc: `router.push` întoarce `void` în aplicație, dar
    // React 19 ține tranziția deschisă dacă i se întoarce o promisiune. Forma
    // asta rămâne corectă dacă Next ajunge vreodată să întoarcă una.
    porneste(() => router.push(destinatie));
  }

  const claseStare = inCurs ? "opacity-60 cursor-wait" : "cursor-pointer";

  return (
    // `hover:bg-background` era `bg-background` peste `bg-background`: DELTA
    // ZERO. Rândul avea `cursor-pointer` și niciun răspuns vizual la trecerea
    // mouse-ului. `surface` (#f2ede1) pe `background` (#faf7f0) se vede.
    <tr
      onClick={gestioneazaClick}
      aria-busy={inCurs || undefined}
      className={`hover:bg-surface ${claseStare} ${className}`}
    >
      {children}
    </tr>
  );
}
