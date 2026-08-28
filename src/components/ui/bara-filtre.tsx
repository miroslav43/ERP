// src/components/ui/bara-filtre.tsx
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { useTransition, type ReactElement, type ReactNode } from "react";

import { cn } from "@/lib/ui/cn";

import { Buton } from "./buton";

/**
 * Panoul de filtre al unei liste.
 *
 * ── DEFECTUL PE CARE ÎL FACE IMPOSIBIL ────────────────────────────────────
 * Șase module porneau din `new URLSearchParams()` GOL și îl repopulau doar cu
 * cheile pe care le administra formularul lor. Consecința: `department_id`,
 * `echipament` sau `limita` puse în adresă dispăreau la prima apăsare pe
 * „Filtrează" — capacități implementate complet pe server, șterse de client.
 *
 * Aici punctul de plecare e ÎNTOTDEAUNA `useSearchParams()`, iar componenta
 * atinge numai cheile pe care le primește. Restul supraviețuiesc prin
 * construcție, nu prin grija fiecărui autor.
 *
 * ── DE CE PASTILE, NU DOAR CÂMPURI ────────────────────────────────────────
 * O listă filtrată arată exact ca o listă goală. Cinci stări goale din produs
 * recomandau în text „Ștergeți filtrele" fără să existe butonul. Pastilele fac
 * filtrul activ VIZIBIL și îi dau fiecăruia o ieșire proprie.
 */
export type FiltruActiv = Readonly<{
  /** Cheia din query string, ca să se poată șterge exact aceea. */
  cheie: string;
  /** Ce scrie pe pastilă: „Departament: Producție". */
  eticheta: string;
}>;

export type PropsBaraFiltre = Readonly<{
  /**
   * Câmpurile de filtrare. Fiecare are `name` egal cu cheia lui din adresă —
   * de acolo știe bara ce să scrie. Nu au nevoie de `onChange`, de stare, de
   * nimic: formularul e sursa.
   */
  children: ReactNode;
  active: readonly FiltruActiv[];
  /**
   * Cheile pe care le administrează bara. Sunt și cheile citite din formular la
   * trimitere, și cele șterse la „Șterge toate filtrele". O singură listă,
   * fiindcă două s-ar despărți la prima modificare.
   */
  cheiProprii: readonly string[];
  /**
   * Chei care SUNT filtre, dar nu sunt câmpuri în bară — de obicei puse de un
   * link din afară. `echipament`, pus de codul QR de pe utilaj, e cazul viu:
   * lista deschisă de pe telefon arată sesizările unei singure mașini.
   *
   * Sunt șterse de „Șterge toate filtrele", dar NU sunt citite din formular. Cele
   * două liste răspund la întrebări diferite — „ce citesc de la trimitere" și
   * „ce sunt eu în stare să șterg" — și tocmai de asta nu se pot uni: o cheie
   * fără câmp omonim pusă în `cheiProprii` ar fi ȘTEARSĂ la prima trimitere,
   * fiindcă `FormData.get()` întoarce `null` pentru ea.
   */
  cheiExterne?: readonly string[];
  /** Textul butonului de trimitere. */
  textAplica?: string;
  className?: string;
}>;

export function BaraFiltre({
  children,
  active,
  cheiProprii,
  cheiExterne,
  textAplica = "Filtrează",
  className,
}: PropsBaraFiltre): ReactElement {
  const parametri = useSearchParams();
  const cale = usePathname();
  const router = useRouter();
  const [inCurs, porneste] = useTransition();

  function navigheaza(schimba: (p: URLSearchParams) => void): void {
    // Pornim de la parametrii EXISTENȚI, nu de la un obiect gol.
    const p = new URLSearchParams(parametri.toString());
    schimba(p);
    // Cursorul de paginare NU supraviețuiește unei schimbări de filtru: ar
    // continua de la un rând care nu mai e în rezultat.
    p.delete("cursor");
    porneste(() => {
      router.replace(p.size === 0 ? cale : `${cale}?${p.toString()}`);
    });
  }

  /*
   * Trimiterea stă AICI, nu în fiecare bară de filtre.
   *
   * Cele unsprezece componente `filtre-*.tsx` aveau fiecare propriul `aplica()`
   * care pornea din `new URLSearchParams()` gol și repopula doar cheile lui.
   * Una singură își amintea să păstreze `vizualizare`, cu un comentariu care
   * explica de ce — dovada că autorul VĂZUSE problema și o rezolvase pentru un
   * singur parametru. Odată cu sortarea și mărimea de pagină din tabelele noi,
   * defectul s-a agravat: orice filtrare arunca acum și `sort`, și `limita`.
   *
   * Aici cheile necunoscute supraviețuiesc prin construcție. Bara nu poate
   * șterge decât ce i s-a spus că administrează.
   */
  function trimite(formular: FormData): void {
    navigheaza((p) => {
      for (const cheie of cheiProprii) {
        const brut = formular.get(cheie);
        const valoare = typeof brut === "string" ? brut.trim() : "";
        if (valoare.length === 0) p.delete(cheie);
        else p.set(cheie, valoare);
      }
    });
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <form
        action={trimite}
        className="border-border bg-surface rounded-panou flex flex-wrap items-end gap-4 border p-4"
      >
        {children}
        {/*
          `inCurs`, nu `disabled={inCurs}`: `Buton` are deja rotița, `aria-busy`
          și blocarea în prop-ul ăsta (`buton.tsx:120-126`), iar legarea doar pe
          `disabled` producea un buton care se stinge fără să spună de ce. Pe
          cele 17 ecrane cu filtre, omul apăsa „Aplică" și rămânea cu tabelul pe
          datele vechi și cu un buton gri.
        */}
        <Buton type="submit" varianta="secundar" inCurs={inCurs} textInCurs="Se filtrează…">
          {textAplica}
        </Buton>
      </form>

      {active.length === 0 ? null : (
        <div className="flex flex-wrap items-center gap-2" aria-live="polite">
          <span className="text-muted-foreground text-nota">Filtre active:</span>
          {active.map((f) => (
            <button
              key={f.cheie}
              type="button"
              disabled={inCurs}
              onClick={() => navigheaza((p) => p.delete(f.cheie))}
              className="border-foreground/30 text-foreground hover:bg-surface active:bg-border text-nota rounded-full border px-2.5 py-0.5 font-medium transition-colors disabled:cursor-not-allowed"
            >
              <span className="flex items-center gap-1.5">
                {f.eticheta}
                <X aria-hidden="true" className="size-3" />
                <span className="sr-only">Șterge filtrul</span>
              </span>
            </button>
          ))}
          <Buton
            varianta="link"
            disabled={inCurs}
            onClick={() =>
              navigheaza((p) => {
                for (const c of cheiProprii) p.delete(c);
                for (const c of cheiExterne ?? []) p.delete(c);
              })
            }
          >
            Șterge toate filtrele
          </Buton>
        </div>
      )}
    </div>
  );
}
