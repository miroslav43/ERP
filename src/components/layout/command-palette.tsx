// src/components/layout/command-palette.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Command, CornerDownLeft, Search } from "lucide-react";

import { comutaOrganizatiaDirect } from "@/app/(app)/actions";
import type { OrganizatieComutator } from "@/components/layout/org-switcher";

export type ElementPaleta = Readonly<{
  id: string;
  eticheta: string;
  grup: string;
  href: string;
}>;

type Rezultat =
  | Readonly<{ tip: "navigare"; id: string; eticheta: string; grup: string; href: string }>
  | Readonly<{ tip: "organizatie"; id: string; eticheta: string; grup: string }>;

function normalizeaza(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

type Props = Readonly<{
  elemente: readonly ElementPaleta[];
  organizatii: readonly OrganizatieComutator[];
}>;

export function CommandPalette({ elemente, organizatii }: Props) {
  /**
   * `<dialog>` se conduce din STARE, nu prin apeluri imperative din handlere.
   *
   * `showModal()` și `close()` există doar pe element, deci reful rămâne
   * necesar — dar este atins EXCLUSIV într-un efect, care sincronizează
   * elementul cu starea. Handlerele doar schimbă starea.
   *
   * Motivul nu e stilistic: o funcție declarată în corpul componentei care
   * citește `ref.current` nu poate fi deosebită de cod rulat la randare, iar
   * refurile citite la randare nu declanșează re-randare — componenta ar putea
   * rămâne pe o stare veche.
   */
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [deschis, setDeschis] = useState(false);
  const router = useRouter();
  const [interogare, setInterogare] = useState("");
  const [indiceActiv, setIndiceActiv] = useState(0);
  const [seComuta, startTransition] = useTransition();

  const toate = useMemo<readonly Rezultat[]>(() => {
    const navigare: Rezultat[] = elemente.map((element) => ({
      tip: "navigare",
      id: element.id,
      eticheta: element.eticheta,
      grup: element.grup,
      href: element.href,
    }));
    // În 1b paleta caută DOAR ce există cu adevărat: meniul permis + organizațiile utilizatorului.
    const orgs: Rezultat[] =
      organizatii.length > 1
        ? organizatii.map((organizatie) => ({
            tip: "organizatie",
            id: organizatie.id,
            eticheta: organizatie.name,
            grup: "Comută organizația",
          }))
        : [];
    return [...navigare, ...orgs];
  }, [elemente, organizatii]);

  const filtrate = useMemo<readonly Rezultat[]>(() => {
    const termen = normalizeaza(interogare.trim());
    if (termen.length === 0) {
      return toate.slice(0, 12);
    }
    return toate
      .filter((rezultat) => normalizeaza(`${rezultat.eticheta} ${rezultat.grup}`).includes(termen))
      .slice(0, 12);
  }, [interogare, toate]);

  const deschide = useCallback(() => {
    setInterogare("");
    setIndiceActiv(0);
    setDeschis(true);
  }, []);

  const inchide = useCallback(() => {
    setDeschis(false);
  }, []);

  // Singurul loc unde se atinge reful.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    if (deschis && !dialog.open) {
      dialog.showModal();
    } else if (!deschis && dialog.open) {
      dialog.close();
    }
  }, [deschis]);

  useEffect(() => {
    function laTasta(eveniment: KeyboardEvent): void {
      if ((eveniment.metaKey || eveniment.ctrlKey) && eveniment.key.toLowerCase() === "k") {
        eveniment.preventDefault();
        setDeschis((precedent) => {
          if (!precedent) {
            setInterogare("");
            setIndiceActiv(0);
          }
          return !precedent;
        });
      }
    }
    window.addEventListener("keydown", laTasta);
    return () => window.removeEventListener("keydown", laTasta);
  }, []);

  /**
   * `useCallback`, nu o funcție simplă: prin `inchide()` se ajunge la
   * `dialogRef.current`, iar o funcție declarată direct în corpul componentei
   * nu poate fi deosebită de cod executat în timpul randării. Refurile citite
   * la randare nu declanșează re-randare, deci componenta ar putea afișa o
   * stare veche — de aceea regula le interzice acolo.
   */
  const activeaza = useCallback(
    (rezultat: Rezultat | undefined): void => {
      if (rezultat === undefined || seComuta) {
        return;
      }
      if (rezultat.tip === "navigare") {
        inchide();
        router.push(rezultat.href);
        return;
      }
      const date = new FormData();
      date.set("organizationId", rezultat.id);
      startTransition(() => {
        void comutaOrganizatiaDirect(date);
      });
    },
    [seComuta, inchide, router],
  );

  function laTastaLista(eveniment: React.KeyboardEvent<HTMLInputElement>): void {
    if (eveniment.key === "ArrowDown") {
      eveniment.preventDefault();
      setIndiceActiv((precedent) =>
        filtrate.length === 0 ? 0 : (precedent + 1) % filtrate.length,
      );
    } else if (eveniment.key === "ArrowUp") {
      eveniment.preventDefault();
      setIndiceActiv((precedent) =>
        filtrate.length === 0 ? 0 : (precedent - 1 + filtrate.length) % filtrate.length,
      );
    } else if (eveniment.key === "Enter") {
      eveniment.preventDefault();
      activeaza(filtrate[indiceActiv]);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={deschide}
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K"
        className="border-border bg-background text-muted-foreground hover:text-foreground focus-visible:ring-ring hidden h-9 items-center gap-2 rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none md:inline-flex"
      >
        <Search aria-hidden="true" className="h-4 w-4" />
        Căutare
        <kbd className="border-border ml-2 inline-flex items-center gap-0.5 rounded border px-1 text-[10px]">
          <Command aria-hidden="true" className="h-3 w-3" />K
        </kbd>
      </button>

      <dialog
        ref={dialogRef}
        aria-label="Căutare globală"
        onClose={() => {
          setDeschis(false);
          setInterogare("");
        }}
        className="border-border bg-surface text-foreground w-full max-w-lg rounded-lg border p-0 backdrop:bg-black/40"
      >
        <div className="border-border flex items-center gap-2 border-b px-3">
          <Search aria-hidden="true" className="text-muted-foreground h-4 w-4" />
          <label htmlFor="paleta-cautare" className="sr-only">
            Căutați în meniu și în organizațiile dumneavoastră
          </label>
          <input
            id="paleta-cautare"
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="paleta-rezultate"
            aria-autocomplete="list"
            autoComplete="off"
            value={interogare}
            onChange={(eveniment) => {
              setInterogare(eveniment.target.value);
              setIndiceActiv(0);
            }}
            onKeyDown={laTastaLista}
            placeholder="Căutați o pagină sau o organizație…"
            className="placeholder:text-muted-foreground h-11 w-full bg-transparent text-sm outline-none"
          />
        </div>

        <ul
          id="paleta-rezultate"
          role="listbox"
          aria-label="Rezultate"
          className="max-h-80 overflow-y-auto p-1"
        >
          {filtrate.length === 0 ? (
            <li className="text-muted-foreground px-3 py-6 text-center text-sm">
              Niciun rezultat pentru „{interogare}”. Paleta caută doar în paginile la care aveți
              acces.
            </li>
          ) : (
            filtrate.map((rezultat, indice) => (
              <li key={`${rezultat.tip}-${rezultat.id}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={indice === indiceActiv}
                  onMouseEnter={() => setIndiceActiv(indice)}
                  onClick={() => activeaza(rezultat)}
                  className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm ${
                    indice === indiceActiv
                      ? "bg-background text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {rezultat.tip === "organizatie" ? (
                    <Building2 aria-hidden="true" className="text-primary h-4 w-4" />
                  ) : (
                    <CornerDownLeft aria-hidden="true" className="h-4 w-4" />
                  )}
                  <span className="text-foreground truncate">{rezultat.eticheta}</span>
                  <span className="ml-auto shrink-0 text-xs">{rezultat.grup}</span>
                </button>
              </li>
            ))
          )}
        </ul>

        <p role="status" aria-live="polite" className="sr-only">
          {seComuta ? "Se comută organizația." : `${filtrate.length} rezultate.`}
        </p>
      </dialog>
    </>
  );
}
