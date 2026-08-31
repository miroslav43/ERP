// src/components/ui/toast.tsx
"use client";

import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactElement } from "react";

import { cn } from "@/lib/ui/cn";

/**
 * Confirmarea unei scrieri. Nu exista deloc: `grep -rni 'toast' src` întorcea
 * un singur rezultat, într-un document de plan.
 *
 * Ce făcea aplicația în locul ei, în ~150 de locuri: ba un redirect mut, ba un
 * `<p role="status">` care rămânea pe ecran la nesfârșit, ba un `<p>` demontat
 * chiar de `router.refresh()`-ul care îl urma (REVISAL), ba nimic. Omul apăsa
 * „Salvează", ceva se întâmpla pe server, și ecranul nu spunea nimic.
 *
 * ── DE CE STRATUL DE DEASUPRA ─────────────────────────────────────────────
 * `Dialog` folosește `<dialog>` nativ cu `showModal()`, care intră în TOP
 * LAYER — deasupra oricărui `z-index`, oricât de mare. O notificare pe un
 * `z-index` obișnuit ar fi fost invizibilă exact în cazul pentru care există:
 * confirmarea unei acțiuni ireversibile, cu „Anulează" în ea.
 *
 * Soluția e API-ul `popover`, singurul care urcă în același strat fără să
 * captureze focusul. Dacă browserul nu-l are, elementul rămâne unde e, pe
 * `--z-plutitor` — degradare, nu cădere.
 *
 * ── DE CE NU EXISTĂ PROVIDER ──────────────────────────────────────────────
 * Depozitarul de mai jos trăiește la nivel de modul, nu într-un context React.
 * Motivul e concret: `(app)/layout.tsx` e Server Component. Un provider l-ar fi
 * transformat în client, iar cu el tot arborele de deasupra paginilor. Așa,
 * `ZonaToast` se montează o dată ca frunză, iar `arataToast()` se poate chema
 * de oriunde, inclusiv din afara React.
 */
export type FelToast = "reusita" | "eroare" | "informativ";

export type Toast = Readonly<{
  fel: FelToast;
  text: string;
  /** „Anulează" pentru operațiunile reversibile. Ține notificarea deschisă. */
  actiune?: Readonly<{ eticheta: string; onClick: () => void }>;
}>;

type ToastAfisat = Toast & { readonly id: number };

/** Reușita se stinge singură; eroarea NU — omul trebuie să apuce s-o citească. */
const DURATA_MS = 6000;

let urmatorulId = 1;
const ascultatori = new Set<(lista: readonly ToastAfisat[]) => void>();
let coada: readonly ToastAfisat[] = [];

function publica(): void {
  for (const a of ascultatori) a(coada);
}

export function arataToast(toast: Toast): void {
  const cu = { ...toast, id: urmatorulId++ };
  coada = [...coada, cu];
  publica();
}

export function inchideToast(id: number): void {
  coada = coada.filter((t) => t.id !== id);
  publica();
}

/**
 * Golește coada.
 *
 * Depozitarul trăiește la nivel de modul, nu într-un context React, tocmai ca
 * `arataToast()` să se poată chema fără provider. Prețul e că starea
 * supraviețuiește demontării lui `ZonaToast` — ceea ce e corect în aplicație,
 * unde zona stă în layout și nu se demontează niciodată, dar e o scurgere în
 * două locuri: la deconectare, unde o notificare a utilizatorului precedent
 * n-are ce căuta pe ecranul următorului, și între teste.
 */
export function golesteToasturi(): void {
  coada = [];
  publica();
}

/** Zahăr sintactic pentru componentele care preferă un hook. */
export function useToast(): Readonly<{ arata: (t: Toast) => void }> {
  return { arata: arataToast };
}

const PICTOGRAMA = { reusita: CheckCircle2, eroare: TriangleAlert, informativ: Info } as const;

const CULOARE: Readonly<Record<FelToast, string>> = {
  reusita: "text-success",
  eroare: "text-danger",
  informativ: "text-muted-foreground",
};

/**
 * Cât spațiu se lasă liber sub bandă, pe telefon.
 *
 * Colțul din dreapta-jos e împărțit cu bula asistentului, iar bula stă la
 * înălțimi diferite în cele două zone: în portal e ridicată peste bara de
 * navigație de jos. Un singur număr n-ar fi mers pentru amândouă — ar fi
 * acoperit bula într-una dintre ele, iar un toast de eroare nu se stinge
 * singur, deci ar fi blocat-o până îl închide cineva.
 *
 * Ridicarea e necondiționată de prezența asistentului: în portal, banda trecea
 * oricum peste bara de jos, fiindcă popover-ul o pune în top layer, deasupra
 * lui `z-20`. Deci decalajul repară două lucruri deodată.
 */
const JOS: Readonly<Record<ZonaToastare, string>> = {
  app: "pb-[calc(4.5rem+env(safe-area-inset-bottom))]",
  portal: "pb-[calc(8rem+env(safe-area-inset-bottom))]",
};

export type ZonaToastare = "app" | "portal";

export function ZonaToast({ zona = "app" }: Readonly<{ zona?: ZonaToastare }>): ReactElement {
  const [lista, setLista] = useState<readonly ToastAfisat[]>(coada);
  const invelis = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    ascultatori.add(setLista);
    return () => {
      ascultatori.delete(setLista);
    };
  }, []);

  // Popover-ul se deschide doar cât are ce arăta. Deschis gol, ar rămâne un
  // dreptunghi invizibil în topul stratului, peste care nu se mai poate da clic.
  useEffect(() => {
    const el = invelis.current;
    if (el === null || typeof el.showPopover !== "function") return;
    try {
      if (lista.length > 0) el.showPopover();
      else el.hidePopover();
    } catch {
      // `showPopover` aruncă dacă elementul e deja în starea cerută. Benign.
    }
  }, [lista.length]);

  return (
    <div
      ref={invelis}
      data-tipar="ascunde"
      popover="manual"
      className={cn(
        /*
         * `top-auto` repară o poziționare greșită care exista de dinainte:
         * banda apărea SUS, nu jos.
         *
         * Foaia de stil a browserului dă oricărui popover deschis `inset: 0`,
         * adică și `top: 0`. Cu `top` și `bottom` amândouă fixate și o înălțime
         * definită, `top` câștigă — regula de rezolvare a suprapunerii din CSS.
         * Deci `bottom-0` de mai jos era, pur și simplu, ignorat.
         *
         * Măsurat în headless_shell, pe același element: fără `top-auto` ⇒
         * `y=0`; cu el ⇒ `y=745` pe un ecran de 780. Popover-ul e necesar
         * (altfel un `<dialog>` deschis acoperă banda), deci se anulează doar
         * `top`-ul, nu mecanismul.
         */
        "z-plutitor fixed inset-x-0 top-auto bottom-0 m-0 flex w-full flex-col items-center gap-2 border-0 bg-transparent p-3",
        JOS[zona],
        // Pe desktop bula stă la 24px de margine în ambele zone, deci un
        // singur decalaj ajunge.
        "md:inset-x-auto md:right-0 md:bottom-0 md:w-auto md:items-end md:pb-[5.5rem]",
        lista.length === 0 ? "pointer-events-none" : "",
      )}
    >
      {lista.map((t) => (
        <RandToast key={t.id} toast={t} />
      ))}
    </div>
  );
}

function RandToast({ toast }: { toast: ToastAfisat }): ReactElement {
  const Pictograma = PICTOGRAMA[toast.fel];

  useEffect(() => {
    if (toast.fel === "eroare") return;
    const t = setTimeout(() => inchideToast(toast.id), DURATA_MS);
    return () => clearTimeout(t);
  }, [toast.id, toast.fel]);

  return (
    <div
      // `alert` întrerupe cititorul de ecran, `status` așteaptă o pauză. Doar
      // eroarea merită întreruperea; o confirmare de salvare, nu.
      role={toast.fel === "eroare" ? "alert" : "status"}
      aria-live={toast.fel === "eroare" ? "assertive" : "polite"}
      className={cn(
        "border-border bg-background rounded-panou shadow-plutitor pointer-events-auto",
        "text-corp flex w-full max-w-md items-start gap-3 border p-3",
      )}
    >
      <Pictograma
        aria-hidden="true"
        className={cn("size-4 shrink-0 translate-y-0.5", CULOARE[toast.fel])}
      />
      <p className="text-foreground min-w-0 flex-1">{toast.text}</p>
      {toast.actiune === undefined ? null : (
        <button
          type="button"
          onClick={() => {
            toast.actiune?.onClick();
            inchideToast(toast.id);
          }}
          className="text-primary shrink-0 font-medium underline decoration-1 underline-offset-4 hover:decoration-2"
        >
          {toast.actiune.eticheta}
        </button>
      )}
      <button
        type="button"
        onClick={() => inchideToast(toast.id)}
        aria-label="Închide notificarea"
        className="text-muted-foreground hover:text-foreground rounded-control -m-1 shrink-0 p-1 transition-colors"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
