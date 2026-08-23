// src/components/ui/combobox.tsx
"use client";

import { Check, ChevronDown } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
} from "react";

import { cheieCautare } from "@/lib/text/diacritice";
import { cn } from "@/lib/ui/cn";

import { clasaControl, type AtributeControl } from "./camp";

/**
 * Selectul cu căutare. Înlocuiește `<select>`-ul nativ acolo unde lista e
 * lungă și omul știe deja ce caută.
 *
 * Măsurat în depozit: 174 de `<select>` în 87 de fișiere, dintre care 36
 * enumeră angajați, vehicule, departamente sau funcții — 21 doar angajați —
 * răspândite prin 27 de fișiere: deplasări, pontaj, inventar, SSM, flotă,
 * mentenanță, salarizare, onboarding. Într-un `<select>` nativ cu trei sute de
 * angajați singura căutare e tastarea rapidă a primelor litere, care se
 * resetează după o secundă și NU trece peste diacritice: cine tastează
 * „stanescu” nu ajunge niciodată la „Stănescu”.
 *
 * ── DE CE `"use client"` ──────────────────────────────────────────────────
 * Restul primitivelor din `src/components/ui/` sunt deliberat fără directivă,
 * ca să rămână *partajate* — se compilează în graful care le importă, deci o
 * funcție din props nu traversează nicio graniță. Aici nu se poate: lista
 * deschisă, textul din casetă și indicele rândului activ sunt stare care
 * trăiește între două apăsări de tastă, iar `onKeyDown`, `onMouseDown` și
 * `useEffect`-ul care aduce rândul activ în cadru rulează în browser. Nu
 * există variantă fără JavaScript pentru filtrarea unei liste pe măsură ce se
 * scrie.
 *
 * ── DE CE VALOAREA STĂ ÎNTR-UN `<input type="hidden">` ────────────────────
 * Asta e bucata fără de care primitiva ar fi decorativă. Tiparul dominant al
 * proiectului e `<form action>` + `FormData` — sunt 105 fișiere cu `<form`, iar
 * react-hook-form apare în 4 din 118. Un combobox care ține alegerea NUMAI în
 * `useState` nu apare în `FormData`, deci acțiunea primește `null` pe câmp și
 * răspunde „câmp obligatoriu” peste o alegere pe care omul chiar a făcut-o.
 * Câmpul ascuns face alegerea să se trimită exact ca un `<select name=…>`,
 * fără ca ecranul consumator să știe ceva despre asta.
 *
 * Corolarul, la fel de important: **caseta vizibilă NU are `name`.** Dacă ar
 * avea, `FormData` ar purta sub aceeași cheie și eticheta („Ionescu Maria”), și
 * identificatorul — iar serverul, care așteaptă un `uuid`, ar primi un nume de
 * om. `formData.get()` întoarce prima valoare, deci defectul ar fi tăcut.
 *
 * ── ARIA: CURSORUL NU E FOCUSUL ───────────────────────────────────────────
 * Săgețile mută `aria-activedescendant`, nu focusul. Dacă focusul ar sări pe
 * `<li>`, caseta ar pierde focusul la prima săgeată, iar tastarea următoare
 * n-ar mai ajunge nicăieri — și `aria-invalid`/`aria-describedby` primite de la
 * `Camp` ar descrie un element pe care nimeni nu-l mai are sub deget.
 *
 * `aria-selected` marchează alegerea COMISĂ, nu rândul activ: sunt două
 * informații diferite („ce e ales acum” vs. „unde e cursorul”), iar dacă
 * `aria-selected` ar urma cursorul, cititorul de ecran ar anunța ca selectat
 * fiecare rând peste care trece săgeata. Vizual, alegerea comisă poartă o
 * bifă, nu doar o culoare (WCAG 1.4.1), iar rândul activ are și o bară pe
 * muchia de început, nu doar fundal.
 *
 * ── DE CE `Escape` OPREȘTE EVENIMENTUL ────────────────────────────────────
 * Comboboxul ajunge în `Dialog` și în `PanouLateral`, amândouă pe `<dialog>`
 * nativ cu `showModal()`. Escape acolo e o „cerere de închidere” a browserului,
 * iar specificația spune că ea NU se procesează dacă `keydown` a fost anulat.
 * Fără `preventDefault()`, prima apăsare de Escape ar închide tot dialogul, cu
 * formularul completat cu tot, în loc să închidă lista. Când lista e deja
 * închisă, evenimentul e lăsat să treacă — atunci Escape chiar înseamnă
 * „renunț la dialog”.
 *
 * ── DIACRITICELE ──────────────────────────────────────────────────────────
 * Normalizarea NU e scrisă aici. `normalize("NFD")` apărea de cincisprezece
 * ori, în treisprezece fișiere, cu trei regexuri diferite; a paisprezecea copie
 * ar fi fost tocmai într-o primitivă `ui/`, adică exact cea pe care ar fi
 * importat-o toate celelalte. Funcția canonică, cu motivele și cu echivalența
 * celor trei regexuri verificată prin rulare, stă în `src/lib/text/diacritice.ts`.
 * ── CE NU FACE ────────────────────────────────────────────────────────────
 * Nu taie lista la N rezultate. Trunchierea tăcută e defectul pe care proiectul
 * îl are deja o dată (`max_rows = 1000` în stratul de citiri), iar un „primele
 * 50” nespus într-un selector de angajați înseamnă că omul caută pe cineva care
 * există și nu-l găsește niciodată.
 *
 * ── CUM SE LEAGĂ LA `Camp` ────────────────────────────────────────────────
 * Props-urile acceptă exact forma pe care `Camp` o dă funcției de randare, deci
 * legătura ARIA vine întreagă dintr-o singură împrăștiere:
 *
 *   <Camp nume="employee_id" eticheta="Angajat" erori={erori.employee_id} obligatoriu>
 *     {(a) => (
 *       <Combobox {...a} optiuni={angajati} textFaraRezultate="Niciun angajat găsit." />
 *     )}
 *   </Camp>
 *
 * Se folosește cu `fel` implicit (`input`), NU cu `fel="select"`: comboboxul își
 * desenează propria săgeată, iar `Camp` ar mai desena una peste ea.
 *
 * Opțiunea „nimic ales” nu e un mecanism aparte: e o opțiune obișnuită cu
 * `valoare: ""`, exact ca cele 75 de `<option value="">` din depozit („Nealocat”,
 * „Eu însumi”, „—”). Cât timp valoarea e goală, caseta arată `placeholder`-ul,
 * deci `required` se comportă ca la un `<select required>` cu opțiune goală.
 */

export type OptiuneCombobox = Readonly<{
  /** Ce se trimite în `FormData`. `""` înseamnă „nimic ales”. */
  valoare: string;
  eticheta: string;
  /** Al doilea rând, mărunt și căutabil: marca, numărul de înmatriculare, codul. */
  secundar?: string;
}>;

/**
 * Toate cuvintele din interogare trebuie găsite, în etichetă sau în textul
 * secundar. Exportată ca să poată fi verificată direct, fără DOM.
 */
export function filtreazaOptiuni(
  optiuni: readonly OptiuneCombobox[],
  interogare: string,
): readonly OptiuneCombobox[] {
  const cuvinte = cheieCautare(interogare).split(/\s+/).filter(Boolean);
  if (cuvinte.length === 0) return optiuni;
  return optiuni.filter((o) => {
    const caut = cheieCautare(`${o.eticheta} ${o.secundar ?? ""}`);
    return cuvinte.every((c) => caut.includes(c));
  });
}

export type PropsCombobox = Omit<Partial<AtributeControl>, "name"> &
  Readonly<{
    /** Cheia din `FormData`. Fără ea alegerea nu s-ar trimite nicăieri. */
    name: string;
    optiuni: readonly OptiuneCombobox[];
    /** Textul stării „zero rezultate”. Vine ca prop — primitivele n-au șiruri proprii. */
    textFaraRezultate: string;
    placeholder?: string;
    /** Prezentă = combobox controlat. Absentă = își ține singur alegerea. */
    valoare?: string;
    /** Alegerea de pornire în modul necontrolat; la ea se întoarce și după `reset`. */
    valoareInitiala?: string;
    /**
     * Perechea valoare→etichetă a alegerii DEJA COMISE, când s-ar putea să nu
     * se afle în `optiuni`.
     *
     * Cazul e cel mai obișnuit ecran de editare din produs: lista se filtrează
     * la angajații activi, dar înregistrarea trimite la unul inactiv. Fără
     * asta, caseta arăta GOL în timp ce câmpul ascuns purta id-ul — iar cu
     * `required` formularul refuza să se trimită pe un câmp care AVEA valoare.
     * Nicio eroare, nicăieri.
     *
     * Opțiunea intră și în listă, la început, ca alegerea curentă să fie
     * vizibilă și reselectabilă.
     */
    optiuneAleasa?: OptiuneCombobox;
    /**
     * Mesajul arătat de browser când `required` e pus și nu s-a ales nimic.
     *
     * Fără el, paza cade pe `validity.valueMissing` al casetei de căutare, a
     * cărei valoare e textul tastat — deci un text scris fără să se aleagă
     * nimic o mulțumește. Fereastra e îngustă (ieșirea din câmp golește
     * textul), dar un `form.requestSubmit()` programatic o deschide.
     */
    textAlegereObligatorie?: string;
    laSchimbare?: (valoare: string) => void;
    dezactivat?: boolean;
  }>;

export function Combobox({
  name,
  optiuni,
  textFaraRezultate,
  placeholder,
  valoare,
  valoareInitiala,
  optiuneAleasa,
  textAlegereObligatorie,
  laSchimbare,
  dezactivat,
  id,
  className,
  required,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: PropsCombobox): ReactElement {
  const idAuto = useId();
  const idCamp = id ?? `combobox-${idAuto}`;
  const idLista = `${idCamp}-lista`;
  const idOptiune = (indice: number): string => `${idCamp}-optiune-${indice}`;

  const refRadacina = useRef<HTMLDivElement | null>(null);
  const refInput = useRef<HTMLInputElement | null>(null);
  const refLista = useRef<HTMLUListElement | null>(null);

  const [valoareInterna, setValoareInterna] = useState(valoareInitiala ?? "");
  const [deschis, setDeschis] = useState(false);
  // `null` = omul n-a atins tastatura, deci caseta arată alegerea și lista se
  // răsfoiește întreagă. Un `""` ar însemna „a șters tot”, ceea ce e altceva.
  const [interogare, setInterogare] = useState<string | null>(null);
  const [indiceBrut, setIndiceBrut] = useState(0);

  const valoareAleasa = valoare ?? valoareInterna;

  /*
   * Alegerea comisă intră în listă dacă nu e deja acolo. Vezi `optiuneAleasa`:
   * lista unui ecran de editare e aproape întotdeauna filtrată (doar activi,
   * doar în stoc, doar din departamentul meu), iar valoarea salvată nu e.
   */
  const toateOptiunile = useMemo(() => {
    if (optiuneAleasa === undefined) return optiuni;
    if (optiuni.some((o) => o.valoare === optiuneAleasa.valoare)) return optiuni;
    return [optiuneAleasa, ...optiuni];
  }, [optiuni, optiuneAleasa]);

  /*
   * Ultima plasă: dacă valoarea comisă nu are etichetă NICĂIERI, caseta arată
   * valoarea brută în loc de gol. E urât — un UUID într-un câmp de nume — dar
   * e vizibil, iar golul nu era. Un defect care se vede se repară; unul care
   * arată corect nu se repară niciodată.
   */
  const etichetaAleasa =
    valoareAleasa === ""
      ? ""
      : (toateOptiunile.find((o) => o.valoare === valoareAleasa)?.eticheta ?? valoareAleasa);

  const rezultate = useMemo(
    () => filtreazaOptiuni(toateOptiunile, interogare ?? ""),
    [toateOptiunile, interogare],
  );

  /*
   * `required` stă pe caseta de căutare, dar valoarea care contează e cea din
   * câmpul ascuns. Cele două se despart cât timp lista e deschisă și s-a tastat
   * ceva fără să se aleagă: caseta e plină, alegerea e goală, iar validarea
   * nativă e mulțumită. `setCustomValidity` le leagă la loc.
   */
  useEffect(() => {
    const caseta = refInput.current;
    if (caseta === null) return;
    const lipsesteAlegerea = required === true && valoareAleasa === "";
    caseta.setCustomValidity(
      lipsesteAlegerea && textAlegereObligatorie !== undefined ? textAlegereObligatorie : "",
    );
  }, [required, valoareAleasa, textAlegereObligatorie]);

  // Indicele se ține brut în stare și se strânge la randare: lista se scurtează
  // sub deget pe măsură ce se scrie, iar un indice rămas în afara ei ar face ca
  // `aria-activedescendant` să arate spre un `<li>` care nu mai există.
  const indiceActiv =
    rezultate.length === 0 ? -1 : Math.min(Math.max(indiceBrut, 0), rezultate.length - 1);

  // Rândul activ trebuie să fie în cadru; altfel săgeata îl mută pe unul pe
  // care nimeni nu-l vede și lista pare blocată la primele opt nume.
  useEffect(() => {
    if (!deschis) return;
    const element = refLista.current?.children.item(indiceActiv);
    if (element instanceof HTMLElement && typeof element.scrollIntoView === "function") {
      element.scrollIntoView({ block: "nearest" });
    }
  }, [deschis, indiceActiv]);

  // React 19 resetează formularul după o acțiune reușită, iar `<button type="reset">`
  // face același lucru. Câmpul ascuns e controlat de starea de mai sus, deci ar
  // rămâne singurul câmp plin într-un formular altfel golit — și s-ar retrimite.
  useEffect(() => {
    const formular = refRadacina.current?.closest("form") ?? null;
    if (formular === null) return;
    const laReset = (): void => {
      setValoareInterna(valoareInitiala ?? "");
      setInterogare(null);
      setDeschis(false);
    };
    formular.addEventListener("reset", laReset);
    return () => {
      formular.removeEventListener("reset", laReset);
    };
  }, [valoareInitiala]);

  function deschide(): void {
    if (dezactivat === true) return;
    setDeschis(true);
    setInterogare(null);
    // Se deschide pe alegerea curentă, nu pe primul rând și nici pe ultimul:
    // într-o listă de trei sute de nume, un cursor care aterizează la capăt e
    // dezorientant, iar cel care aterizează pe alegerea de acum e util.
    const indice = toateOptiunile.findIndex((o) => o.valoare === valoareAleasa);
    setIndiceBrut(indice < 0 ? 0 : indice);
  }

  function inchide(): void {
    setDeschis(false);
    setInterogare(null);
  }

  function alege(optiune: OptiuneCombobox): void {
    if (valoare === undefined) setValoareInterna(optiune.valoare);
    laSchimbare?.(optiune.valoare);
    setDeschis(false);
    setInterogare(null);
  }

  function laTasta(eveniment: KeyboardEvent<HTMLInputElement>): void {
    // Tab nu apare nicăieri mai jos, și asta e regula, nu o scăpare: Tab pleacă
    // din câmp fără să aleagă. `onBlur` doar închide lista și pune înapoi în
    // casetă eticheta alegerii comise.
    if (eveniment.key === "ArrowDown" || eveniment.key === "ArrowUp") {
      eveniment.preventDefault();
      if (!deschis) {
        deschide();
        return;
      }
      const pas = eveniment.key === "ArrowDown" ? 1 : -1;
      // Fără ciclare: la capăt lista se oprește. Ciclarea într-o listă lungă
      // face „am ajuns la sfârșit” invizibil, iar omul se învârte prin ea.
      setIndiceBrut(Math.min(Math.max(indiceActiv + pas, 0), rezultate.length - 1));
      return;
    }

    if (eveniment.key === "Home" && deschis) {
      eveniment.preventDefault();
      setIndiceBrut(0);
      return;
    }

    if (eveniment.key === "End" && deschis) {
      eveniment.preventDefault();
      setIndiceBrut(rezultate.length - 1);
      return;
    }

    if (eveniment.key === "Enter") {
      // Lista închisă: Enter e al formularului, nu al comboboxului.
      if (!deschis) return;
      eveniment.preventDefault();
      const activ = indiceActiv < 0 ? undefined : rezultate[indiceActiv];
      if (activ === undefined) {
        inchide();
        return;
      }
      alege(activ);
      return;
    }

    if (eveniment.key === "Escape") {
      if (!deschis) return;
      eveniment.preventDefault();
      eveniment.stopPropagation();
      inchide();
      refInput.current?.focus();
    }
  }

  return (
    <div ref={refRadacina} className="relative">
      {/* Singurul câmp cu `name`. Vezi docblock: caseta vizibilă nu are.
          `disabled` trebuie pus AICI, nu doar pe caseta vizibilă: un câmp
          dezactivat nu se trimite, iar primitiva se dă drept înlocuitor
          cap-la-cap pentru `<select>`. Fără el, un combobox dezactivat își
          trimitea valoarea, spre deosebire de `<select disabled>`. */}
      <input type="hidden" name={name} value={valoareAleasa} disabled={dezactivat} />

      {/* Regiune vie montată permanent: dacă ar apărea odată cu mesajul, o parte
          dintre cititoarele de ecran n-ar anunța niciodată golul. */}
      <span role="status" className="sr-only">
        {deschis && rezultate.length === 0 ? textFaraRezultate : ""}
      </span>

      <input
        ref={refInput}
        id={idCamp}
        type="text"
        role="combobox"
        autoComplete="off"
        spellCheck={false}
        aria-expanded={deschis}
        // Numai cât timp lista există: un `aria-controls` care arată spre un id
        // inexistent trece typecheck, lint și build și nu spune nimic nimănui.
        aria-controls={deschis ? idLista : undefined}
        aria-autocomplete="list"
        aria-activedescendant={deschis && indiceActiv >= 0 ? idOptiune(indiceActiv) : undefined}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        required={required}
        disabled={dezactivat}
        placeholder={placeholder}
        value={interogare ?? etichetaAleasa}
        onChange={(e) => {
          setInterogare(e.target.value);
          setIndiceBrut(0);
          setDeschis(true);
        }}
        onMouseDown={() => {
          if (!deschis) deschide();
        }}
        onKeyDown={laTasta}
        onBlur={inchide}
        // `pr-9` stă ULTIMUL, după `className`: clasa venită de la `Camp` e
        // chiar `clasaControl()`, care conține `px-3`, iar `twMerge` dă câștig
        // ultimei clase în conflict. Scris înainte, spațiul rezervat săgeții
        // s-ar pierde și textul lung ar trece pe sub ea.
        className={cn(clasaControl(), className, "pr-9")}
      />

      <ChevronDown
        aria-hidden="true"
        className={cn(
          // `top-1/2` se raportează la rădăcină, care are exact înălțimea
          // casetei: câmpul ascuns e `display:none`, regiunea vie e `sr-only`
          // (deci absolută), iar lista e absolută. Nimic altceva nu ocupă loc.
          "text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 transition-transform",
          deschis ? "rotate-180" : "",
        )}
      />

      {deschis ? (
        <div className="border-border bg-background rounded-control shadow-plutitor z-meniu absolute inset-x-0 top-full mt-1 overflow-hidden border">
          <ul
            ref={refLista}
            id={idLista}
            role="listbox"
            className={cn("max-h-64 overflow-y-auto", rezultate.length === 0 ? "" : "py-1")}
          >
            {rezultate.map((optiune, indice) => {
              const aleasa = optiune.valoare === valoareAleasa;
              return (
                <li
                  key={optiune.valoare}
                  id={idOptiune(indice)}
                  role="option"
                  aria-selected={aleasa}
                  // Fără asta, apăsarea de mouse scoate focusul din casetă,
                  // `onBlur` închide lista, iar `onClick` nu mai are pe ce cădea.
                  onMouseDown={(e) => {
                    e.preventDefault();
                  }}
                  onClick={() => {
                    alege(optiune);
                  }}
                  className={cn(
                    "text-corp flex cursor-pointer items-baseline gap-2 border-s-2 px-3 py-2",
                    indice === indiceActiv ? "border-primary bg-primary/10" : "border-transparent",
                  )}
                >
                  {/* Bifa, nu culoarea, spune care e alegerea comisă (WCAG 1.4.1).
                      Ascunsă prin `invisible`, nu prin condiție, ca să nu sară
                      textul în lateral când cursorul trece peste rânduri. */}
                  <Check
                    aria-hidden="true"
                    className={cn(
                      "text-primary size-3.5 shrink-0 translate-y-px",
                      aleasa ? "" : "invisible",
                    )}
                  />
                  <span className="text-foreground min-w-0 flex-1 truncate">
                    {optiune.eticheta}
                  </span>
                  {optiune.secundar === undefined ? null : (
                    <span className="text-muted-foreground text-nota shrink-0">
                      {optiune.secundar}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          {rezultate.length === 0 ? (
            // `aria-hidden`: textul e deja anunțat de regiunea vie de mai sus,
            // iar aici ar fi citit a doua oară de cine navighează prin pagină.
            <p aria-hidden="true" className="text-muted-foreground text-corp px-3 py-2">
              {textFaraRezultate}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
