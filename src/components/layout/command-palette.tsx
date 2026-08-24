// src/components/layout/command-palette.tsx
"use client";

import { cheieCautare } from "@/lib/text/diacritice";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Command, CornerDownLeft, Search, X } from "lucide-react";

import { comutaOrganizatiaDirect } from "@/app/(app)/actions";
import type { OrganizatieComutator } from "@/components/layout/meniu-cont";

export type ElementPaleta = Readonly<{
  id: string;
  eticheta: string;
  grup: string;
  href: string;
}>;

type Rezultat =
  | Readonly<{ tip: "navigare"; id: string; eticheta: string; grup: string; href: string }>
  | Readonly<{ tip: "organizatie"; id: string; eticheta: string; grup: string }>;

/** Id stabil per poziție — singura punte între `<input>` și rândul activ. */
function idOptiune(indice: number): string {
  return `paleta-optiune-${indice}`;
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
    const termen = cheieCautare(interogare.trim());
    if (termen.length === 0) {
      return toate.slice(0, 12);
    }
    return toate
      .filter((rezultat) => cheieCautare(`${rezultat.eticheta} ${rezultat.grup}`).includes(termen))
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

  /*
   * O pagină restaurată din bfcache (utilizatorul a plecat de aici și s-a
   * întors cu „Înapoi") își aduce DOM-ul exact cum a rămas la plecare — dacă
   * paleta era deschisă, `<dialog>` revine cu atributul `open` prezent, dar
   * FĂRĂ promovarea reală în top layer: fără `::backdrop`, în afara fluxului
   * ei modal obișnuit. Vizual rămâne o listă „înțepenită" sus în pagină, peste
   * conținut, nedimensionat — și nici Escape, nici clicul din afară nu mai
   * ajung la ea, fiindcă nu mai e cu adevărat modală. Singura reparație sigură
   * e închiderea forțată, direct pe element, la orice revenire din bfcache.
   */
  useEffect(() => {
    function laRevenire(eveniment: PageTransitionEvent): void {
      if (!eveniment.persisted) return;
      dialogRef.current?.close();
      setDeschis(false);
      setInterogare("");
    }
    window.addEventListener("pageshow", laRevenire);
    return () => window.removeEventListener("pageshow", laRevenire);
  }, []);

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
      /*
       * `inchide()` ÎNAINTE de acțiune, ca pe ramura de navigare. Fără el,
       * `<dialog>`-ul modal rămânea deschis peste pagina firmei noi: acțiunea
       * redirectează, dar componenta trăiește în layout și nu se remontează, iar
       * `showModal()` de dinainte ține în continuare `::backdrop` peste tot
       * ecranul. Utilizatorul comuta firma și rămânea blocat în paletă.
       *
       * Eșecul nu e tăcut: `comutaOrganizatiaDirect` redirectează la
       * `/alege-organizatia?eroare=acces`, care e un ecran întreg cu explicație
       * — singura destinație corectă când apartenența a dispărut între randare
       * și clic.
       */
      inchide();
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
      {/*
        Declanșatorul stă în antetul navy; panoul cade pe pânză. De aceea cele
        două jumătăți ale acestei componente au palete diferite, deliberat.

        Și EXISTĂ pe telefon. Era `hidden ... md:inline-flex`, iar `⌘K` nu se
        poate tasta pe un telefon: sub `md` nu exista absolut niciun drum către
        căutare, într-un produs cu 34 de destinații. Acum e o lupă de 44 px
        (ținta tactilă a proiectului), care crește în buton cu etichetă și
        scurtătură de la `md` în sus.
      */}
      <button
        type="button"
        onClick={deschide}
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K"
        className="rounded-control text-corp inline-flex size-11 items-center justify-center text-white/70 transition-colors hover:bg-white/10 hover:text-white md:h-9 md:w-auto md:gap-2 md:border md:border-white/15 md:px-3"
      >
        <Search aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span className="sr-only md:not-sr-only">Căutare</span>
        <kbd className="text-nota ml-2 hidden items-center gap-0.5 rounded-sm border border-white/15 px-1 md:inline-flex">
          <Command aria-hidden="true" className="h-3 w-3" />K
        </kbd>
      </button>

      {/*
        Pe telefon paleta ocupă tot ecranul: un panou de 32 rem centrat pe
        verticală lasă tastatura virtuală să acopere jumătate din rezultate. De
        la `sm` în sus redevine panou și urcă sub antet (`mt-16`), fiindcă un
        dialog centrat pe verticală sare în sus și în jos pe măsură ce lista se
        scurtează la tastare.
      */}
      <dialog
        ref={dialogRef}
        aria-label="Căutare globală"
        onClose={() => {
          setDeschis(false);
          setInterogare("");
        }}
        /*
          Clic pe `::backdrop` nu are propriul nod DOM — un clic care ajunge
          efectiv pe `<dialog>` (nu pe vreun copil din panou) e prin definiție
          un clic ÎN AFARA panoului. Pe telefon `<dialog>` ocupă tot ecranul
          (`h-dvh`), deci nu există zonă de fundal vizibilă acolo — verificarea
          e inofensivă, doar nu se declanșează niciodată sub `sm`.
        */
        onClick={(eveniment) => {
          if (eveniment.target === dialogRef.current) {
            inchide();
          }
        }}
        /*
          `hidden open:flex`, NU `flex` simplu. `dialog:not([open]) { display:
          none }` e stabilit de foaia de stil a browserului — iar CSS-ul
          autorului o bate ÎNTOTDEAUNA, indiferent de specificitate. O clasă
          `flex` necondiționată aici anula acea regulă definitiv: panoul
          rămânea `display: flex` chiar și cu `open === false`, poziționat
          absolut, în afara stivei modale — vizibil pe orice pagină, pentru
          orice utilizator, dus parțial deasupra ecranului. Verificat live cu
          `getComputedStyle`. Varianta `open:flex` din Tailwind leagă randarea
          strict de atributul `open`, exact ca regula UA pe care trebuia s-o
          respecte.
        */
        className="border-border bg-background text-foreground shadow-plutitor z-meniu sm:rounded-panou m-0 hidden h-dvh max-h-none w-full max-w-none flex-col border-0 p-0 backdrop:bg-black/40 open:flex sm:mx-auto sm:mt-16 sm:mb-auto sm:h-auto sm:max-h-[70dvh] sm:max-w-lg sm:border"
      >
        <div className="border-border flex shrink-0 items-center gap-2 border-b px-3">
          <Search aria-hidden="true" className="text-muted-foreground h-4 w-4 shrink-0" />
          <label htmlFor="paleta-cautare" className="sr-only">
            Căutați în meniu și în organizațiile dumneavoastră
          </label>
          <input
            id="paleta-cautare"
            type="text"
            role="combobox"
            /*
              `aria-expanded` calculat, nu literal „true": un listbox gol nu e
              deschis. Iar `aria-activedescendant` LIPSEA cu totul — focusul DOM
              rămâne pe `<input>`, opțiunile primeau `aria-selected`, dar nimic
              nu lega cele două: un cititor de ecran nu afla NICIODATĂ pe ce
              rând ești, deci săgețile nu spuneau nimic.
            */
            aria-expanded={filtrate.length > 0}
            aria-controls="paleta-rezultate"
            aria-activedescendant={
              filtrate[indiceActiv] === undefined ? undefined : idOptiune(indiceActiv)
            }
            aria-autocomplete="list"
            autoComplete="off"
            value={interogare}
            onChange={(eveniment) => {
              setInterogare(eveniment.target.value);
              setIndiceActiv(0);
            }}
            onKeyDown={laTastaLista}
            placeholder="Căutați o pagină sau o organizație…"
            className="placeholder:text-muted-foreground text-corp h-11 w-full bg-transparent"
          />
          {/*
            Ieșirea vizibilă există DOAR pe telefon, și e obligatorie acolo:
            dialogul ocupă tot ecranul, iar tastatura virtuală n-are Escape.
            Fără butonul ăsta, paleta deschisă din greșeală pe telefon era o
            fundătură — `::backdrop` acoperă tot, deci nici clicul „în afară"
            n-are unde să cadă.
          */}
          <button
            type="button"
            onClick={inchide}
            className="text-muted-foreground hover:text-foreground rounded-control -mr-1 inline-flex size-11 shrink-0 items-center justify-center transition-colors sm:hidden"
          >
            <X aria-hidden="true" className="size-5" />
            <span className="sr-only">Închide căutarea</span>
          </button>
        </div>

        {/* Mesajul de gol e FRATE cu lista, nu copil: un `<li>` fără
            `role="option"` e copil invalid de `role="listbox"`, iar unele
            cititoare de ecran ignoră tot ce e înăuntru. */}
        {filtrate.length === 0 ? (
          <p role="status" className="text-muted-foreground text-corp px-3 py-6 text-center">
            Niciun rezultat pentru „{interogare}”. Paleta caută doar în paginile la care aveți
            acces.
          </p>
        ) : null}

        <ul
          id="paleta-rezultate"
          role="listbox"
          aria-label="Rezultate"
          className="min-h-0 flex-1 overflow-y-auto p-1 sm:max-h-80 sm:flex-none"
        >
          {filtrate.map((rezultat, indice) => (
            <li key={`${rezultat.tip}-${rezultat.id}`}>
              <button
                type="button"
                id={idOptiune(indice)}
                role="option"
                aria-selected={indice === indiceActiv}
                onMouseEnter={() => setIndiceActiv(indice)}
                onClick={() => activeaza(rezultat)}
                className={`rounded-control text-corp flex w-full items-center gap-2 px-3 py-2 text-left ${
                  indice === indiceActiv ? "bg-surface text-foreground" : "text-muted-foreground"
                }`}
              >
                {rezultat.tip === "organizatie" ? (
                  <Building2 aria-hidden="true" className="text-primary h-4 w-4" />
                ) : (
                  <CornerDownLeft aria-hidden="true" className="h-4 w-4" />
                )}
                <span className="text-foreground truncate">{rezultat.eticheta}</span>
                <span className="text-nota ml-auto shrink-0">{rezultat.grup}</span>
              </button>
            </li>
          ))}
        </ul>

        <p role="status" aria-live="polite" className="sr-only">
          {seComuta ? "Se comută organizația." : `${filtrate.length} rezultate.`}
        </p>
      </dialog>
    </>
  );
}
