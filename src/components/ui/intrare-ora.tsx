"use client";

import { useRef, useState, type ReactElement } from "react";

import { clasaControl } from "@/components/ui/camp";
import {
  formatOre,
  mascheazaDurata,
  mascheazaOraZi,
  normalizeazaOraZi,
  parseOre,
  plafoneazaMinutele,
} from "@/lib/format/ore";
import { cn } from "@/lib/ui/cn";

/**
 * Cele două câmpuri de timp ale produsului, amândouă pe ceas de 24 de ore.
 *
 * ── DE CE NU `<input type="time">` ────────────────────────────────────────
 * Fiindcă formatul lui nu se poate impune. Chrome îl alege după limba
 * INTERFEȚEI browserului, nu după `lang`-ul documentului, așa că pe un Chrome
 * în engleză câmpul scria `05:30 PM` într-o aplicație românească — iar
 * `lang="ro-RO"`, pus pe câmpuri de la început, nu schimba nimic (numai
 * Firefox îl citește). Nu există atribut, CSS sau opțiune care să forțeze 24
 * de ore. Singura garanție e să nu mai folosim controlul nativ.
 *
 * Ce se pierde: selectorul de oră al browserului și săgețile sus/jos. Ce se
 * câștigă: același ecran pentru toți, plus o mască de tastare care pune singură
 * două punctele — se scriu `830` și în câmp apare `08:30`, fără nicio tastă în
 * plus. Nimeni nu tastează `:` într-un câmp de oră din produsul ăsta.
 *
 * ── DE CE DOUĂ COMPONENTE ─────────────────────────────────────────────────
 * `IntrareOra` e un MOMENT din zi (`ora_inceput`, `ora_producerii`) și merge
 * în bază ca `time`, deci valoarea lui e chiar șirul `"HH:MM"`.
 * `IntrareDurata` e o CANTITATE de timp (`ore_lucrate`, `ore_pe_zi`) și merge
 * în bază ca `numeric`, fiindcă salarizarea o înmulțește cu tariful orar. Se
 * scrie tot `8:30`, dar se trimite `8.5` — conversia e ascunsă în câmp, ca
 * zecimala să nu mai ajungă niciodată pe ecran.
 *
 * ── DE CE NU EXISTĂ NICIUN `useEffect` AICI ───────────────────────────────
 * Un câmp controlat care ține și textul tastat pare să ceară un efect de
 * sincronizare cu proprietatea. Nu cere. Starea proprie e doar CIORNA — ce se
 * tastează chiar acum — și trăiește până la ieșirea din câmp; restul timpului
 * e `null`, iar câmpul afișează direct valoarea venită din părinte. Așa,
 * o sugestie recalculată de părinte (orele derivate din interval, în
 * `celula-zi.tsx`) apare imediat, fără randare în cascadă.
 */

/** Atributele pe care le dă `<Camp>` prin funcția de randare, toate opționale aici. */
type AtributeComune = Readonly<{
  id?: string | undefined;
  name?: string | undefined;
  className?: string | undefined;
  required?: boolean | undefined;
  disabled?: boolean | undefined;
  "aria-invalid"?: true | undefined;
  "aria-describedby"?: string | undefined;
}>;

/**
 * Filtrul câmpului de DURATĂ. (Ora zilei n-are nevoie de el: masca îi lasă
 * oricum doar cifre, deci literele din `AM`/`PM` n-au pe unde intra.)
 *
 * Durata nu poate primi aceeași mască ca ora din zi, fiindcă ora ei nu e
 * plafonată la 23: norma săptămânală e `40:00`, maximul legal `48:00`. Are
 * masca ei — `mascheazaDurata`, două punctele pe a doua cifră — dar filtrul
 * rămâne, fiindcă masca lasă dinadins să treacă ce nu e cifră.
 *
 * Virgula și punctul RĂMÂN în câmp. Ar fi fost mai simplu să le tăiem, dar
 * atunci `8,5` ar deveni tăcut `85` — optzeci și cinci de ore, o cifră perfect
 * plauzibilă într-un total săptămânal. Lăsate pe ecran, sunt respinse vizibil
 * de `parseOre`, iar omul vede DE CE.
 */
function filtreaza(brut: string): string {
  return brut.replace(/[^\d:.,h ]/giu, "").slice(0, 6);
}

function clase(propriu: string | undefined, invalid: boolean): string {
  return cn(clasaControl({ fel: "input" }), "tabular-nums", invalid && "border-danger", propriu);
}

/** Lungimea unei ore complete, `"08:30"` — pragul de la care câmpul e plin. */
const ORA_COMPLETA = 5;

const FOCUSABIL = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Trece la câmpul următor, ca după un Tab.
 *
 * `Tabel` randează fiecare celulă de DOUĂ ori — o dată în tabelul de peste
 * `md`, o dată în lista de carduri de sub el — și ascunde una din CSS. Fără
 * filtrul de vizibilitate, „următorul” ar fi geamănul ascuns al câmpului
 * curent, iar focusul ar dispărea din ecran.
 *
 * `checkVisibility` nu există în jsdom, unde oricum nu se calculează layout;
 * acolo trec toate, ceea ce e exact ce trebuie într-un test.
 */
function treciLaUrmatorul(de: HTMLElement): void {
  const candidati = [...de.ownerDocument.querySelectorAll<HTMLElement>(FOCUSABIL)].filter(
    (el) => el === de || typeof el.checkVisibility !== "function" || el.checkVisibility(),
  );
  const urmator = candidati[candidati.indexOf(de) + 1];
  if (urmator === undefined) return;
  urmator.focus();
  // Conținutul se selectează, ca următoarele patru cifre să-l înlocuiască în
  // loc să se lipească de el: câmpul următor are aproape întotdeauna deja o
  // oră în el, copiată de pe ziua de dinainte.
  if (urmator instanceof HTMLInputElement) urmator.select();
}

export type PropsIntrareOra = AtributeComune &
  Readonly<{
    /** Controlat: `"HH:MM"` sau șir gol. */
    valoare?: string | undefined;
    /** Necontrolat: valoarea de pornire. Acceptă și `"08:30:00"` din Postgres. */
    implicit?: string | undefined;
    /** Primește `"HH:MM"` canonic, sau șir gol când câmpul a fost golit. */
    onSchimba?: ((valoare: string) => void) | undefined;
  }>;

/**
 * Un moment din zi, pe 24 de ore. `08:30`, `17:30` — niciodată `5:30 PM`.
 *
 * Două punctele le pune masca, la fiecare tastă. Completarea la oră întreagă
 * rămâne pe ieșirea din câmp: `1` nu trebuie să devină `01:00` înainte ca omul
 * să apuce să scrie `7`.
 */
export function IntrareOra({
  valoare,
  implicit,
  onSchimba,
  name,
  className,
  ...atribute
}: PropsIntrareOra): ReactElement {
  const [ciorna, setCiorna] = useState<string | null>(null);
  const [propriu, setPropriu] = useState(() => normalizeazaOraZi(implicit ?? "") ?? "");
  const [atins, setAtins] = useState(false);
  /*
    Ora s-a predat deja, pe ultima tastă, iar focusul a plecat singur mai
    departe. Blurul care urmează imediat nu mai are ce adăuga — și NU are voie
    să încerce: el vede `text` din randarea dinainte de ultima cifră, adică
    `08:3`, și ar scrie peste `08:30` un `08:03`.
  */
  const predatDeja = useRef(false);

  const dinParinte = valoare === undefined ? propriu : (normalizeazaOraZi(valoare) ?? "");
  const text = ciorna ?? dinParinte;
  const canonic = normalizeazaOraZi(text);
  const invalid = atins && text.length > 0 && canonic === null;

  /** Predă valoarea în sus. Primește textul explicit, ca să nu depindă de închidere. */
  function preda(brut: string): void {
    setAtins(true);
    if (brut.trim().length === 0) {
      setCiorna(null);
      setPropriu("");
      onSchimba?.("");
      return;
    }
    /*
      Minutul peste 59 se PLAFONEAZĂ, nu se refuză: `17:75` devine `17:59`.

      Refuzul pur părea prudent — masca lasă dinadins pe ecran ce s-a tastat —
      dar aici se termina prost. Câmpul ascuns de mai jos rămâne gol cât timp
      ora nu e validă, deci în planul săptămânii intervalul pleca spre server ca
      `null`: omul completa ora, apăsa „Trimite” și ziua ajungea cu zero ore, cu
      chenarul roșu rămas într-o pagină pe care n-o mai privea. Fiindcă
      plafonarea se întâmplă pe a patra cifră (acolo ora se închide și `preda`
      e chemat de saltul automat), corectura e VIZIBILĂ în clipa tastării, nu
      descoperită mai târziu.

      Ora peste 23 rămâne respinsă — vezi `plafoneazaMinutele`.
    */
    const curat = normalizeazaOraZi(brut) ?? plafoneazaMinutele(brut);
    // Ciorna rămâne pe ecran cât timp nu e o oră nici după plafonare: altfel
    // dispare fără ca omul să vadă ce a scris greșit.
    if (curat === null) return;
    setCiorna(null);
    setPropriu(curat);
    onSchimba?.(curat);
  }

  return (
    <>
      <input
        {...atribute}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="08:30"
        aria-invalid={atribute["aria-invalid"] ?? (invalid ? true : undefined)}
        value={text}
        onChange={(e) => {
          predatDeja.current = false;
          const brut = e.target.value;
          let cifre = brut.replace(/\D/gu, "");
          /*
            Backspace peste două puncte: omul șterge `:` din `08:`, cifrele
            rămân `08`, iar masca l-ar pune imediat la loc — tasta n-ar face
            nimic, la nesfârșit. Când ștergerea n-a schimbat rezultatul măștii,
            se șterge cifra de dinaintea separatorului.
          */
          if (brut.length < text.length && mascheazaOraZi(cifre) === text) {
            cifre = cifre.slice(0, -1);
          }
          const dupa = mascheazaOraZi(cifre);
          setCiorna(dupa);

          /*
            A patra cifră închide ora — nu mai are ce urma în câmpul ăsta, deci
            focusul pleacă singur, ca după un Tab. Pe grila săptămânii asta
            înseamnă opt cifre la rând pentru o zi întreagă, fără nicio tastă de
            navigare între ele.

            `text.length < ORA_COMPLETA` ține saltul legat de tasta care a
            COMPLETAT ora: fără el, orice corecție într-o oră deja plină ar
            arunca focusul mai departe la fiecare apăsare.
          */
          if (dupa.length === ORA_COMPLETA && text.length < ORA_COMPLETA) {
            preda(dupa);
            predatDeja.current = true;
            treciLaUrmatorul(e.currentTarget);
          }
        }}
        onBlur={() => {
          if (predatDeja.current) {
            predatDeja.current = false;
            return;
          }
          preda(text);
        }}
        className={clase(className, invalid)}
      />
      {name === undefined ? null : <input type="hidden" name={name} value={canonic ?? ""} />}
    </>
  );
}

export type PropsIntrareDurata = AtributeComune &
  Readonly<{
    /** Controlat: ore zecimale, cum stau în bază. `8.5` se scrie `8:30`. */
    valoare?: number | null | undefined;
    /** Necontrolat: valoarea de pornire, tot în ore zecimale. */
    implicit?: number | null | undefined;
    /** Primește ore zecimale, sau `null` când câmpul a fost golit. */
    onSchimba?: ((ore: number | null) => void) | undefined;
    /**
     * Exemplul din câmpul gol. Implicit `8:00` — norma zilnică — dar un câmp
     * care cere maximul săptămânal are alt ordin de mărime, iar un exemplu de
     * opt ore acolo sugerează exact cifra greșită.
     */
    placeholder?: string | undefined;
  }>;

/** Ore zecimale → ce se scrie în câmp. Fără grupare: cifra trebuie să se poată tasta la loc. */
function scrieDurata(ore: number | null): string {
  return ore === null ? "" : formatOre(ore, { grupeaza: false });
}

/**
 * O cantitate de timp, scrisă pe ceas: `8:30`, nu `8,5`.
 *
 * Trimite mai departe zecimala — și în `onSchimba`, și în câmpul ascuns care
 * ajunge în `FormData` — fiindcă `ore_lucrate` rămâne `numeric` în bază.
 *
 * Două punctele le pune masca, pe a doua cifră: `0830` → `08:30`, `4800` →
 * `48:00`. Zero-ul din față e prețul pentru că o durată n-are plafon la 23,
 * deci nicio cifră nu spune singură unde se termină orele. Cine tastează `:`
 * cu mâna e lăsat în pace — `8:30` rămâne `8:30`.
 */
export function IntrareDurata({
  valoare,
  implicit,
  onSchimba,
  name,
  className,
  placeholder = "8:00",
  ...atribute
}: PropsIntrareDurata): ReactElement {
  const [ciorna, setCiorna] = useState<string | null>(null);
  const [propriu, setPropriu] = useState(() => scrieDurata(implicit ?? null));
  const [atins, setAtins] = useState(false);

  const dinParinte = valoare === undefined ? propriu : scrieDurata(valoare);
  const text = ciorna ?? dinParinte;
  const zecimal = parseOre(text);
  const invalid = atins && text.trim().length > 0 && zecimal === null;

  function laIesire(): void {
    setAtins(true);
    if (text.trim().length === 0) {
      setCiorna(null);
      setPropriu("");
      onSchimba?.(null);
      return;
    }
    if (zecimal === null) return;
    setCiorna(null);
    setPropriu(scrieDurata(zecimal));
    onSchimba?.(zecimal);
  }

  return (
    <>
      <input
        {...atribute}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        aria-invalid={atribute["aria-invalid"] ?? (invalid ? true : undefined)}
        value={text}
        onBlur={laIesire}
        onChange={(e) => {
          const brut = filtreaza(e.target.value);
          const dupa = mascheazaDurata(brut);
          /*
            Backspace peste două punctele puse de mască: omul șterge `:` din
            `08:`, rămân cifrele `08`, iar masca l-ar pune imediat la loc —
            tasta n-ar face nimic, la nesfârșit. Când ștergerea n-a schimbat
            rezultatul măștii, se șterge cifra de dinaintea separatorului.
            Același tipar ca în `IntrareOra`, din același motiv.
          */
          setCiorna(
            brut.length < text.length && dupa === text ? mascheazaDurata(brut.slice(0, -1)) : dupa,
          );
        }}
        className={clase(className, invalid)}
      />
      {name === undefined ? null : (
        <input type="hidden" name={name} value={zecimal === null ? "" : String(zecimal)} />
      )}
    </>
  );
}
