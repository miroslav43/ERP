// src/components/ui/formular-dialog.tsx
"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import type { ActionResult } from "@/lib/actions/types";

import { BaraActiuni } from "./bara-actiuni";
import { Buton, type VariantaButon } from "./buton";
import { Dialog, type PropsDialog } from "./dialog";
import { Formular, type StareFormular } from "./formular";

/**
 * Un formular care se deschide într-o casetă, dintr-un buton.
 *
 * ── DE CE EXISTĂ ──────────────────────────────────────────────────────────
 * Aplicația avea 27 de formulare care se DESFĂCEAU ÎN PAGINĂ: „Departament
 * nou" împingea nomenclatorul în jos, fișa echipamentului ținea PATRU
 * formulare deschise simultan — unul cu 15 câmpuri — iar ecranul era mai mult
 * formular gol decât conținut. Cine voia să vadă ce coduri sunt deja luate,
 * exact întrebarea de dinaintea completării câmpului „Cod", trebuia să închidă
 * formularul, să se uite, și să-l redeschidă gol.
 *
 * `functii/formular-functie-noua.tsx` rezolvase deja cazul, corect, de mână.
 * Componenta asta e acel fișier fără câmpurile lui — ca următoarele 26 să nu
 * rescrie de fiecare dată cele patruzeci de linii de `useState` / `useCallback`
 * / `useRouter` / randare condiționată, și mai ales ca să nu rescrie cele două
 * capcane de dedesubt.
 *
 * ── CAPCANA 1: BUTOANELE STAU ÎN `<form>`, NU ÎN `subsol` ─────────────────
 * `subsol`-ul lui `Dialog` e FRATE cu `<form>` în DOM. Un buton pus acolo nu
 * poate nici să trimită, nici să citească `stare.inCurs` — adică se pierde „Se
 * creează…", singurul semn că apăsarea a fost înregistrată. `BaraActiuni` face
 * aceeași treabă din interior: `aliniere="final"` e documentat exact ca footer
 * de dialog, iar `lipitaPeTelefon` ține butoanele la îndemână sub `md`, peste
 * `env(safe-area-inset-bottom)`.
 *
 * (`Formular` are prop-ul `id` tocmai pentru cazul invers, când butonul chiar
 * trebuie scos afară. Aici nu e nevoie și n-o folosim.)
 *
 * ── CAPCANA 2: CASETA SE RANDEAZĂ, NU SE ASCUNDE ──────────────────────────
 * `{deschis ? <Dialog … /> : null}`, nu un dialog permanent cu `deschis={…}`.
 * Altfel copiii se montează la prima randare a paginii: `CautaCor` ar ține
 * nomenclatorul de 4422 de ocupații filtrat în memorie pentru un formular pe
 * care poate nimeni nu-l deschide. Montarea la deschidere îl golește și de
 * valorile rămase dintr-o încercare anterioară.
 *
 * ── CASETA NU SE ÎNCHIDE LA REFUZ ─────────────────────────────────────────
 * Doar `laReusita` o închide. Cu `<form action={fn}>` și câmpuri necontrolate,
 * React 19 RESETEAZĂ formularul după ce acțiunea se încheie — inclusiv când a
 * eșuat; `Formular` repară asta prin `valoriTrimise`. Dacă am închide caseta pe
 * eroare, am pierde exact ce a scris omul, cu un gest în plus față de resetul
 * de dinainte.
 */
export type PropsFormularDialog<TData> = Readonly<{
  /** Butonul care deschide caseta. */
  declansator: Readonly<{
    eticheta: ReactNode;
    varianta?: VariantaButon;
    /** Pictograma din stânga etichetei, deja randată: `<Plus className="size-4" />`. */
    pictograma?: ReactNode;
    disabled?: boolean;
    className?: string;
  }>;
  titlu: string;
  descriere?: string;
  marime?: PropsDialog["marime"];
  actiune: (date: FormData) => Promise<ActionResult<TData>>;
  /** Textul notificării de confirmare. */
  mesajReusita?: string;
  /** Eticheta butonului de trimitere — „Creează departamentul". */
  etichetaTrimite: string;
  /** Ce scrie pe buton cât se trimite — „Se creează…". */
  textInCurs?: string;
  /** Eticheta butonului de renunțare. Implicit „Renunță". */
  etichetaRenuntare?: string;
  /**
   * Ce se mai întâmplă după reușită, pe lângă închidere și `router.refresh()`.
   * Cel mai des: un `router.push` către fișa nou creată.
   *
   * NU trebuie memorat de apelant — vezi comentariul de la `refCallback`.
   */
  laReusita?: (data: TData) => void;
  /**
   * Sare peste `router.refresh()`. Pentru formularele care își duc singure
   * rezultatul mai departe, unde reîmprospătarea rutei curente ar fi muncă
   * aruncată.
   */
  faraReimprospatare?: boolean;
  /**
   * Câmpurile. `idc` prefixează fiecare identificator cu un `useId()` propriu:
   * pe aceeași pagină pot sta N formulare de editare cu EXACT aceleași nume de
   * câmp, iar `Camp` derivă `id` din `nume`. Fără prefix, eticheta celui de-al
   * doilea formular ar trimite focusul în primul.
   */
  children: (stare: StareFormular<TData>, idc: (sufix: string) => string) => ReactNode;
}>;

export function FormularDialog<TData>({
  declansator,
  titlu,
  descriere,
  marime = "mare",
  actiune,
  mesajReusita,
  etichetaTrimite,
  textInCurs,
  etichetaRenuntare = "Renunță",
  laReusita,
  faraReimprospatare,
  children,
}: PropsFormularDialog<TData>): ReactElement {
  const router = useRouter();
  const [deschis, setDeschis] = useState(false);
  const idFormular = useId();

  const idc = useCallback((sufix: string): string => `${idFormular}-${sufix}`, [idFormular]);

  /**
   * Callback-ul apelantului trece printr-o referință, nu prin lista de
   * dependențe.
   *
   * `laReusita` intră în dependențele efectului din `Formular`. O funcție nouă
   * la fiecare randare ar reporni efectul după succes, deci notificarea ar
   * apărea de DOUĂ ori. Cele 27 de locuri de apel ar fi trebuit fiecare să-și
   * amintească de `useCallback`; regula devine imposibil de încălcat dacă
   * stabilitatea o garantează componenta.
   */
  const refCallback = useRef(laReusita);
  useEffect(() => {
    refCallback.current = laReusita;
  }, [laReusita]);

  const inchide = useCallback((): void => {
    setDeschis(false);
  }, []);

  const laReusitaInterna = useCallback(
    (data: TData): void => {
      setDeschis(false);
      if (faraReimprospatare !== true) router.refresh();
      refCallback.current?.(data);
    },
    [router, faraReimprospatare],
  );

  return (
    <>
      <Buton
        varianta={declansator.varianta ?? "primar"}
        disabled={declansator.disabled ?? false}
        {...(declansator.className === undefined ? {} : { className: declansator.className })}
        onClick={() => {
          setDeschis(true);
        }}
      >
        {declansator.pictograma}
        {declansator.eticheta}
      </Buton>

      {deschis ? (
        <Dialog
          deschis
          laInchidere={inchide}
          titlu={titlu}
          marime={marime}
          {...(descriere === undefined ? {} : { descriere })}
        >
          <Formular
            actiune={actiune}
            laReusita={laReusitaInterna}
            {...(mesajReusita === undefined ? {} : { mesajReusita })}
          >
            {(stare) => (
              <>
                {children(stare, idc)}
                <BaraActiuni aliniere="final" separata lipitaPeTelefon>
                  <Buton varianta="secundar" onClick={inchide} disabled={stare.inCurs}>
                    {etichetaRenuntare}
                  </Buton>
                  <Buton
                    type="submit"
                    varianta="primar"
                    inCurs={stare.inCurs}
                    {...(textInCurs === undefined ? {} : { textInCurs })}
                  >
                    {etichetaTrimite}
                  </Buton>
                </BaraActiuni>
              </>
            )}
          </Formular>
        </Dialog>
      ) : null}
    </>
  );
}
