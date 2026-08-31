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
  type RefObject,
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
  /**
   * Butonul care deschide caseta.
   *
   * Uniunea de la coadă e aceeași ca a lui `Buton`, din același motiv: un buton
   * doar-iconiță fără `aria-label` e mut pentru cititorul de ecran, iar într-un
   * tabel cu cinci rânduri identice „Modifică" fără complement nici nu spune
   * CE se modifică. La `marime="iconita"`, `eticheta` rămâne pictograma.
   */
  declansator: Readonly<{
    eticheta: ReactNode;
    varianta?: VariantaButon;
    /** Pictograma din stânga etichetei, deja randată: `<Plus className="size-4" />`. */
    pictograma?: ReactNode;
    disabled?: boolean;
    className?: string;
  }> &
    (Readonly<{ marime?: "implicit" }> | Readonly<{ marime: "iconita"; "aria-label": string }>);
  titlu: string;
  descriere?: string;
  marime?: PropsDialog["marime"];
  /**
   * Caseta pornește deschisă. Implicit `false`.
   *
   * Pentru rutele care AU DISPĂRUT în favoarea ei: `/flota?vehicul=nou` trebuie
   * să ducă unde ducea `/flota/nou`, altfel un link vechi sau butonul dintr-o
   * stare goală aterizează într-o listă tăcută, iar omul trebuie să ghicească ce
   * voia să facă.
   *
   * Se citește O SINGURĂ DATĂ, la montare — e sămânța unui `useState`, nu o
   * proprietate controlată. Ca să se redeschidă după o navigare care schimbă
   * doar parametrul (aceeași rută!), apelantul dă componentei un `key` care se
   * schimbă odată cu el; altfel React păstrează starea și caseta rămâne închisă.
   */
  deschisInitial?: boolean;
  actiune: (date: FormData) => Promise<ActionResult<TData>>;
  /** Textul notificării de confirmare. */
  mesajReusita?: string;
  /** Eticheta butonului de trimitere — „Creează departamentul". */
  etichetaTrimite: string;
  /**
   * Varianta butonului de trimitere. Implicit `primar`.
   *
   * `distructiv` e pentru scrierile care închid ceva — încetarea unui contract,
   * retragerea unui document din dosar. Butonul e CONTURAT, nu plin, și se
   * inversează la hover: vezi `buton.tsx`, unde varianta plină lipsește
   * deliberat fiindcă opacitatea peste crem deschide culoarea și ar da semnal
   * invers exact la apăsarea finală.
   */
  variantaTrimite?: VariantaButon;
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
   * Golirea stării pe care apelantul o ține ÎN AFARA casetei, chemată ori de
   * câte ori caseta se închide — și după reușită, și după renunțare.
   *
   * Câmpurile obișnuite n-au nevoie de asta: `{deschis ? <Dialog>… : null}`
   * remontează tot interiorul, deci fiecare `defaultValue` se reia singur. Are
   * nevoie doar starea pe care apelantul e OBLIGAT s-o țină mai sus — de
   * exemplu `dialog-returnare.tsx`, unde `mesajReusita` diferă după ce s-a ales
   * și trebuie citită din afara lui `children`. Fără golire, alegerea unei
   * vizite abandonate supraviețuia în notificarea următoarei.
   *
   * NU trebuie memorat de apelant — vezi comentariul de la `refCallback`.
   */
  laResetare?: () => void;
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

/**
 * Copiază `inCurs` într-o referință din afara dialogului. Randează `null`.
 *
 * Scrierea se face în efect, nu în timpul randării: un `ref.current = …` pus
 * direct în corpul componentei ar fi un efect secundar într-o fază pe care
 * React o poate relua sau abandona. Efectul rulează după commit, adică înainte
 * ca omul să apuce să apese Escape.
 */
function OglindaInCurs({
  inCurs,
  oglindaRef,
}: {
  readonly inCurs: boolean;
  readonly oglindaRef: RefObject<boolean>;
}): null {
  useEffect(() => {
    oglindaRef.current = inCurs;
  }, [inCurs, oglindaRef]);
  return null;
}

export function FormularDialog<TData>({
  declansator,
  titlu,
  descriere,
  marime = "mare",
  deschisInitial = false,
  actiune,
  mesajReusita,
  etichetaTrimite,
  variantaTrimite = "primar",
  textInCurs,
  etichetaRenuntare = "Renunță",
  laReusita,
  laResetare,
  faraReimprospatare,
  children,
}: PropsFormularDialog<TData>): ReactElement {
  const router = useRouter();
  const [deschis, setDeschis] = useState(deschisInitial);
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

  const refResetare = useRef(laResetare);
  useEffect(() => {
    refResetare.current = laResetare;
  }, [laResetare]);

  /**
   * `inCurs` trăiește în `Formular`, adică ÎNĂUNTRUL dialogului. Oglinda asta îl
   * ridică până aici, unde se decide închiderea.
   *
   * Butonul „Renunță" era deja păzit (`disabled={stare.inCurs}`), dar Escape,
   * clicul pe `::backdrop` și X-ul din antet ajung direct la `laInchidere` —
   * niciunul nu trecea pe lângă poarta aceea. Caseta se demonta cu o trimitere
   * în zbor: la întoarcerea răspunsului nu mai exista nici toast-ul de eroare,
   * nici `router.refresh()`, nici `laReusita`. Omul credea că a anulat, deși
   * cererea plecase și putea foarte bine să reușească.
   */
  const refInCurs = useRef(false);

  const inchide = useCallback((): void => {
    if (refInCurs.current) return;
    setDeschis(false);
    refResetare.current?.();
  }, []);

  const laReusitaInterna = useCallback(
    (data: TData): void => {
      setDeschis(false);
      if (faraReimprospatare !== true) router.refresh();
      refCallback.current?.(data);
      refResetare.current?.();
    },
    [router, faraReimprospatare],
  );

  return (
    <>
      {declansator.marime === "iconita" ? (
        <Buton
          varianta={declansator.varianta ?? "primar"}
          marime="iconita"
          aria-label={declansator["aria-label"]}
          disabled={declansator.disabled ?? false}
          {...(declansator.className === undefined ? {} : { className: declansator.className })}
          onClick={() => {
            setDeschis(true);
          }}
        >
          {declansator.pictograma}
          {declansator.eticheta}
        </Buton>
      ) : (
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
      )}

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
                <OglindaInCurs inCurs={stare.inCurs} oglindaRef={refInCurs} />
                {children(stare, idc)}
                <BaraActiuni aliniere="final" separata lipitaPeTelefon>
                  <Buton varianta="secundar" onClick={inchide} disabled={stare.inCurs}>
                    {etichetaRenuntare}
                  </Buton>
                  <Buton
                    type="submit"
                    varianta={variantaTrimite}
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
