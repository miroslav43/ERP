// src/components/incarcare/zona-incarcare.tsx
"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";

import { PanouIncarcare } from "./panou-incarcare";
import { aboneaza, surseCurente, type Sursa } from "@/lib/incarcare/depozit";
import { DURATA_MINIMA_VOAL, PLAFON_MOALE, PRAG_VOAL } from "@/lib/incarcare/praguri";
import { cn } from "@/lib/ui/cn";

/**
 * Voalul de încărcare — singurul consumator al depozitarului.
 *
 * ── DE CE STĂ ÎN LAYOUT-UL RĂDĂCINĂ ───────────────────────────────────────
 * Golul reclamat e între `/alege-organizatia` și `/panou`, adică între două
 * GRUPURI de rute: layout-ul `(auth)` se demontează, cel `(app)` se montează.
 * Singurul înveliș comun celor două e `src/app/layout.tsx`.
 *
 * Că asta funcționează deloc ține de o propoziție din documentație:
 * `next/dist/docs/01-app/03-api-reference/04-functions/redirect.md:13` —
 * „In a Server Action, `redirect` performs a client-side navigation when
 * JavaScript is available." Deci `comutaOrganizatiaDirect` NU înlocuiește
 * documentul, iar un component client de aici supraviețuiește traversării.
 *
 * Montat în `(app)/layout.tsx` n-ar folosi la nimic: acela e tocmai fișierul
 * care blochează 6-9 valuri de interogări, deci componentul nici n-ar exista
 * încă în intervalul în care trebuie să se vadă.
 *
 * ── DE CE POPOVER, NU `z-plutitor` ────────────────────────────────────────
 * `src/components/ui/dialog.tsx:89` deschide `<dialog>` cu `showModal()`, care
 * intră în TOP LAYER — deasupra oricărui `z-index`, oricât de mare. Acțiunile
 * lungi confirmate prin `ConfirmareActiune` sunt exact cazul pentru care există
 * voalul; pe `z-plutitor` ar fi invizibil sub backdrop-ul dialogului. API-ul
 * `popover` urcă în același strat fără să captureze focusul. Dacă browserul
 * nu-l are, elementul rămâne pe `z-plutitor` — degradare, nu cădere.
 *
 * ── DE CE NU CAPTUREAZĂ FOCUSUL ───────────────────────────────────────────
 * Voalul nu e modal. Navigarea în Next e întreruptibilă prin construcție, iar o
 * capcană de focus ar transforma o așteptare într-o fundătură. Blocăm pointerul
 * ca să nu se trimită de două ori, nu tastatura.
 */
export function ZonaIncarcare(): ReactElement {
  const [surse, setSurse] = useState<readonly Sursa[]>(surseCurente);
  const [vizibil, setVizibil] = useState(false);
  const [inghetat, setInghetat] = useState(false);
  const afisatLa = useRef(0);
  const invelis = useRef<HTMLDivElement | null>(null);

  useEffect(() => aboneaza(setSurse), []);

  const activ = surse.length > 0;

  /*
    Cronometrul de ASCUNDERE, nu de afișare. La aprindere așteptăm `PRAG_VOAL`;
    la stingere așteptăm cât mai lipsește din `DURATA_MINIMA_VOAL`. Fără a doua
    jumătate, o navigare de 410 ms produce o clipire de 10 ms care se citește ca
    defect grafic, nu ca stare.
  */
  useEffect(() => {
    if (activ) {
      if (vizibil) return;
      const t = setTimeout(() => {
        afisatLa.current = Date.now();
        setVizibil(true);
      }, PRAG_VOAL);
      return () => clearTimeout(t);
    }
    if (!vizibil) return;
    const ramas = Math.max(0, DURATA_MINIMA_VOAL - (Date.now() - afisatLa.current));
    const t = setTimeout(() => setVizibil(false), ramas);
    return () => clearTimeout(t);
  }, [activ, vizibil]);

  /*
    Plasa: dacă o sursă s-a scurs, la `PLAFON_MOALE` cel puțin redăm clicurile;
    `PLAFON_TARE` din depozitar stinge sursa de tot ceva mai târziu.

    Resetarea stă în CURĂȚARE, nu în corpul efectului. Nu e stil: regula
    `react-hooks/set-state-in-effect` respinge un `setState` sincron în corp,
    fiindcă produce o a doua randare imediat după prima. În curățare rulează la
    stingerea voalului, exact când trebuie, și fără randarea în cascadă.
  */
  useEffect(() => {
    if (!vizibil) return;
    const t = setTimeout(() => setInghetat(true), PLAFON_MOALE);
    return () => {
      clearTimeout(t);
      setInghetat(false);
    };
  }, [vizibil]);

  useEffect(() => {
    const el = invelis.current;
    if (el === null || typeof el.showPopover !== "function") return;
    try {
      if (vizibil) el.showPopover();
      else el.hidePopover();
    } catch {
      // `showPopover` aruncă dacă elementul e deja în starea cerută. Benign.
    }
  }, [vizibil]);

  return (
    <div
      ref={invelis}
      popover="manual"
      // Învelișul vorbește, formele tac — aceeași regulă ca la `Schelet`.
      role="status"
      aria-live="polite"
      aria-busy={vizibil ? true : undefined}
      className={cn(
        "z-plutitor fixed inset-0 m-0 h-full max-h-none w-full max-w-none border-0 p-4",
        "flex items-center justify-center",
        "bg-foreground/25 backdrop-blur-[2px]",
        "transition-opacity duration-(--durata-lent)",
        vizibil && !inghetat ? "" : "pointer-events-none",
        vizibil ? "opacity-100" : "opacity-0",
      )}
    >
      {vizibil ? (
        <PanouIncarcare
          {...(surse[0]?.eticheta === undefined ? {} : { eticheta: surse[0].eticheta })}
        />
      ) : null}
    </div>
  );
}
