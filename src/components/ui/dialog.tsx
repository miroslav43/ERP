// src/components/ui/dialog.tsx
"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from "react";

import { cn } from "@/lib/ui/cn";

import { Buton } from "./buton";
import { Camp } from "./camp";

/**
 * Dialogul, pe `<dialog>` NATIV cu `showModal()`.
 *
 * De ce nu o bibliotecă: `showModal()` dă gratuit exact ce se implementează
 * greșit de obicei — capcană de focus, închidere pe Escape, inertizarea
 * restului paginii și `::backdrop`. Tiparul e deja folosit corect în două
 * locuri din depozit (`command-palette.tsx`, `pontaj/celula-zi.tsx`), deci nu e
 * o pariere pe ceva nou.
 *
 * Ce trebuie ținut minte: elementul intră în TOP LAYER, deasupra oricărui
 * `z-index`. De aceea notificările (`toast.tsx`) folosesc API-ul `popover` —
 * altfel „Anulează" dintr-o confirmare n-ar fi vizibil niciodată.
 *
 * ── DE CE FOAIE PE TELEFON, CASETĂ PE DESKTOP ─────────────────────────────
 * Caseta n-avea NICIO limită de înălțime și nicio zonă de derulare. Pe desktop
 * nu se vedea, fiindcă toate cele opt dialoguri din aplicație au corpul scurt.
 * Pe un telefon însă, un formular cu cinci câmpuri plus lista de autocomplete a
 * codului COR depășește ecranul, iar `<dialog>` centrat prin margini automate
 * NU derulează: crește în ambele direcții deodată, deci antetul iese pe sus și
 * subsolul pe jos. Butonul „Salvează" devenea de neatins — fără nicio eroare,
 * fără nimic de apucat cu degetul.
 *
 * Sub `md` caseta devine foaie lipită de marginea de jos: acolo ajunge degetul,
 * și acolo NU ajunge tastatura virtuală. Peste `md` rămâne exact ce era.
 *
 * `md`, nu `sm`, fiindcă ăsta e pragul mobil al depozitului: `tabel.tsx` comută
 * tabel/carduri la 768px, iar `bara-actiuni.tsx` se lipește jos cu `max-md`. Un
 * al doilea prag ar fi însemnat o bandă de lățimi în care dialogul e casetă,
 * dar bara lui de acțiuni se poartă ca pe telefon.
 *
 * Intrarea și ieșirea se animă din `globals.css`, pe selectorul de ELEMENT.
 * Obiecția care ținea animația afară era corectă și rămâne scrisă: un singur
 * component cu mișcare proprie e mai prost decât opt fără. Răspunsul nu e s-o
 * scrii aici, ci o dată, global — atunci se mișcă toate opt, inclusiv cele trei
 * care își cheamă `showModal()` de mână. Aici nu se adaugă nicio clasă de
 * tranziție; singurul cârlig e `data-panou="lateral"`, care spune din ce parte
 * intră panoul.
 */
export type PropsDialog = Readonly<{
  deschis: boolean;
  laInchidere: () => void;
  titlu: string;
  descriere?: string;
  children?: ReactNode;
  subsol?: ReactNode;
  marime?: keyof typeof LATIME;
  /**
   * Caseta capătă mânerul nativ de redimensionare, din colțul de jos-dreapta.
   *
   * ── DE CE NU PE TOATE CELE OPT ────────────────────────────────────────────
   * `resize` nu are NICIUN efect pe `overflow: visible`, deci opțiunea aduce
   * obligatoriu cu ea `overflow-hidden` pe `<dialog>`. Iar asta taie orice
   * derulant poziționat absolut care iese din casetă — lista de autocomplete a
   * codului COR din formularul de angajat e exact așa. Casetele care au un
   * asemenea derulant nu pot fi redimensionabile fără să fie întâi rescrise, iar
   * o confirmare de trei rânduri n-are ce să facă cu un mâner. Deci se cere
   * explicit, per casetă, nu se moștenește.
   *
   * ── CE SE SCHIMBĂ ÎN CALCULUL LĂȚIMII ────────────────────────────────────
   * Implicit, `marime` e un PLAFON (`max-w-*`) peste o lățime de „cât încape"
   * (`md:w-[calc(100vw-2rem)]`). Un plafon nu se poate depăși trăgând de mâner:
   * mânerul scrie `width`, iar `max-width` îl retează mai departe — mâna trage
   * și nu se întâmplă nimic. Redimensionabilă, caseta pornește de la lățimea lui
   * `marime` și primește ca plafon fereastra, deci treapta devine punctul de
   * PORNIRE, nu tavanul.
   *
   * ── CINE PRIMEȘTE MÂNERUL ────────────────────────────────────────────────
   * Cine are indicator FIN — mouse, trackpad, stylus — indiferent de lățimea
   * ferestrei. Pe atingere nu se schimbă nimic: caseta rămâne foaia lipită de
   * marginea de jos, iar mânerul ar fi o țintă de 16 px peste butoane, la
   * degete. Condiția e pe `pointer`, nu pe `md`, fiindcă lățimea ferestrei nu
   * spune nimic despre ce ai în mână — vezi nota lungă de la clase.
   *
   * Dimensiunea NU se ține minte între deschideri: `FormularDialog` demontează
   * caseta la închidere, deci a doua deschidere pornește iar de la `marime`.
   */
  redimensionabil?: boolean;
}>;

/**
 * `lucru` e treapta pentru dialogurile care nu sunt un formular, ci un ATELIER:
 * o listă editabilă într-o coloană și rezultatul ei în cealaltă. Constructorul
 * de șabloane de evaluare e primul. Sub `lg` cele două coloane se stivuiesc, la
 * fel ca la orice altă mărime, deci lățimea nu schimbă nimic pe telefon.
 */
const LATIME = {
  mic: "max-w-sm",
  mediu: "max-w-lg",
  mare: "max-w-2xl",
  lucru: "max-w-5xl",
} as const;

/**
 * Aceleași patru trepte, dar ca `width` de pornire, pentru `redimensionabil`.
 *
 * Valorile sunt cele din spatele lui `max-w-sm|lg|2xl|5xl` — scrise explicit,
 * nu prin `w-sm`, fiindcă scara de lățimi pe numele containerelor e o adăugire
 * de Tailwind v4 și un nume greșit n-ar da eroare, ci o clasă care nu emite
 * nimic: caseta ar rămâne la `w-full` și ar umple fereastra.
 */
const LATIME_PORNIRE = {
  mic: "pointer-fine:w-[24rem]",
  mediu: "pointer-fine:w-[32rem]",
  mare: "pointer-fine:w-[42rem]",
  lucru: "pointer-fine:w-[64rem]",
} as const;

export function Dialog({
  deschis,
  laInchidere,
  titlu,
  descriere,
  children,
  subsol,
  marime = "mediu",
  redimensionabil = false,
}: PropsDialog): ReactElement {
  const ref = useRef<HTMLDialogElement | null>(null);
  const idTitlu = useId();
  const idDescriere = useId();

  /**
   * Apăsarea a început pe `::backdrop`, nu pe casetă?
   *
   * ── DE CE NU E DE AJUNS `e.target === dialog` PE CLIC ─────────────────────
   * Verificarea aceea a fost corectă cât timp `<dialog>` n-avea nicio parte
   * proprie pe care să poți apuca: caseta are `p-0`, deci tot ce se vede
   * înăuntru e un COPIL, iar orice clic cu ținta pe elementul însuși venea de pe
   * fundal. Mânerul de redimensionare rupe presupunerea — e desenat de browser
   * în colțul casetei și ține de ELEMENT, nu de vreun copil. Măsurat în browser:
   * trăgeai de colț și caseta se închidea, cu tot ce scriseseși în ea.
   *
   * ── DE CE LA `pointerdown`, ȘI NU DUPĂ COORDONATELE CLICULUI ─────────────
   * O verificare geometrică făcută pe `click` n-ar fi ajutat: la capătul unei
   * trageri, degetul e aproape întotdeauna în AFARA casetei (dacă ai micșorat-o)
   * sau lângă marginea ei mutată de recentrare. Ce distinge cu adevărat un clic
   * pe fundal de o tragere de mâner e UNDE A ÎNCEPUT apăsarea. Bonus, aceeași
   * schimbare repară un defect mai vechi și mai greu de povestit: selectezi text
   * în casetă, ridici degetul pe fundal — până acum caseta se închidea.
   *
   * Tastatura nu trece pe aici: un „clic" venit din Enter pe un buton nu emite
   * `pointerdown`, deci steagul rămâne stins.
   */
  const apasatPeFundal = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    if (deschis && !el.open) el.showModal();
    if (!deschis && el.open) el.close();
  }, [deschis]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitlu}
      aria-describedby={descriere === undefined ? undefined : idDescriere}
      // `cancel` e evenimentul pentru Escape. Fără el, dialogul s-ar închide în
      // DOM iar starea din React ar rămâne „deschis" — a doua deschidere n-ar
      // mai face nimic, fiindcă `deschis` nu s-ar fi schimbat.
      onCancel={(e) => {
        e.preventDefault();
        laInchidere();
      }}
      // Începutul apăsării decide, nu sfârșitul ei. Vezi `apasatPeFundal`.
      onPointerDown={(e) => {
        const el = ref.current;
        if (el === null || e.target !== el) {
          apasatPeFundal.current = false;
          return;
        }
        const cutie = el.getBoundingClientRect();
        apasatPeFundal.current =
          e.clientX < cutie.left ||
          e.clientX > cutie.right ||
          e.clientY < cutie.top ||
          e.clientY > cutie.bottom;
      }}
      onClick={() => {
        if (!apasatPeFundal.current) return;
        apasatPeFundal.current = false;
        laInchidere();
      }}
      className={cn(
        "bg-background text-foreground shadow-plutitor border-border border p-0",
        "backdrop:bg-foreground/50",
        // Coloană cu înălțime mărginită: antetul și subsolul rămân pe loc,
        // corpul derulează. Fără `min-h-0` pe corp, un copil mai înalt decât
        // ecranul ar împinge subsolul în afara casetei — implicitul flexbox
        // `min-height: auto` refuză să lase elementul să se micșoreze.
        //
        // `hidden … open:flex`, NU `flex` simplu — vezi nota din
        // `command-palette.tsx` și poarta din `dialog-inchis.test.ts`. Un
        // `display` necondiționat aici bate regula `dialog:not([open]) {
        // display: none }` a browserului, iar dialogul închis rămâne o cutie
        // așezată în flux.
        "hidden flex-col open:flex",
        // ── SUB `md`: FOAIE LIPITĂ DE MARGINEA DE JOS ───────────────────────
        // `mb-0` peste `m-auto`: `<dialog>` se centrează prin marginile
        // automate, iar anulând-o doar pe cea de jos caseta cade la baza
        // ecranului fără poziționare absolută. Degetul ajunge la butoane, iar
        // tastatura virtuală nu mai acoperă câmpul activ.
        // ── DE CE ARE ȘI O PODEA, NU DOAR UN PLAFON ────────────────────────
        // Antetul e `shrink-0`, corpul e `flex-1 min-h-0`, iar înălțimea casetei
        // vine din conținut. Nimic nu garanta deci corpului vreo înălțime: pe un
        // ecran scund, sau cu o descriere de un rând întreg, antetul lua tot, iar
        // sub el rămâneau câțiva pixeli în care primul câmp era tăiat pe
        // jumătate. Caseta părea o bandă, nu o fereastră.
        //
        // `min()`, nu o valoare fixă: podeaua nu are voie să depășească plafonul.
        // Un `min-h-96` simplu ar fi ieșit din ecran pe o fereastră de 300px —
        // adică ar fi mutat aceeași problemă mai jos, unde nici măcar butoanele
        // nu se mai văd.
        "rounded-t-panou m-auto mb-0 max-h-[92dvh] min-h-[min(24rem,92dvh)] w-full max-w-none rounded-b-none",
        // ── FEREASTRĂ SCUNDĂ: SE DERULEAZĂ TOT, CA UN ÎNTREG ───────────────
        // Împărțirea antet-fix / corp-derulabil e bună cât timp există spațiu.
        // Sub un prag, se întoarce împotriva ei: antetul are ~85px și NU se
        // comprimă, deci pe o fereastră de 150px rămân 51px de corp — un câmp
        // tăiat pe jumătate, cu derulare într-o fantă. Măsurat pe aplicația
        // reală, nu presupus.
        //
        // Sub 26rem înălțime de fereastră, caseta redevine un singur bloc
        // derulabil: titlul iese din ecran când derulezi, exact ca într-o
        // pagină obișnuită, iar tot spațiul disponibil ajunge la conținut.
        // Pragul e sub cel la care apare derularea (~220px), deci ecranele
        // normale nu-l ating niciodată.
        // `open:` și aici, nu doar pe `flex` de sus: fără el, sub 26rem înălțime
        // de fereastră un dialog ÎNCHIS ar redeveni o cutie în flux — același
        // defect, doar cu o condiție mai îngustă, adică exact felul care scapă.
        "[@media(max-height:26rem)]:overflow-y-auto [@media(max-height:26rem)]:open:block",
        // `dvh`, nu `vh`: pe iOS Safari `100vh` include bara de adrese care se
        // retrage, deci subsolul ar sta sub linia vizibilă exact cât timp bara
        // e afișată — adică fix când omul deschide dialogul.
        "md:rounded-panou md:m-auto md:max-h-[calc(100dvh-4rem)]",
        // ── MÂNERUL DE REDIMENSIONARE ─────────────────────────────────────
        // Cele două ramuri se EXCLUD, nu se suprascriu una pe alta. Varianta în
        // care lățimea fixă stătea deasupra și cea redimensionabilă o „bătea"
        // dedesubt a fost scrisă și aruncată: ar fi pus lățimea să depindă de
        // ordinea în care Tailwind așază `md:` față de `pointer-fine:` în foaia
        // de stil — o ordine pe care n-o garantează nimic și care, dacă se
        // schimbă, nu dă nicio eroare, doar o casetă care refuză să se lărgească.
        //
        // ── DE CE `pointer-fine`, ȘI NU `md` ─────────────────────────────
        // Prima livrare a pus mânerul pe `md:`, adică pe LĂȚIMEA ferestrei, ca
        // aproximare pentru „are mouse". Aproximarea cade exact la omul care are
        // cea mai mare nevoie de o casetă mai mare: la zoom 200% pe un ecran de
        // 1512 px, fereastra CSS are 756 px, adică SUB prag — mânerul dispărea
        // tăcut, iar caseta redevenea o foaie îngustă. Ce decide dacă o țintă de
        // 16 px se poate apuca e FELUL indicatorului, nu câți pixeli are
        // fereastra. Simetricul, `pointer-coarse:`, e deja folosit în depozit.
        //
        // De aceea ramura redimensionabilă își rescrie și geometria — `m-auto`
        // pe amândouă axele și colțurile rotunde — altfel, pe o fereastră
        // îngustă, mânerul ar fi apărut pe foaia lipită de marginea de jos, unde
        // nu se poate trage: marginea de sus e singura liberă, iar colțul de
        // jos-dreapta stă fix în pragul ferestrei.
        redimensionabil
          ? cn(
              LATIME_PORNIRE[marime],
              "pointer-fine:rounded-panou pointer-fine:m-auto pointer-fine:mb-auto",
              "pointer-fine:max-h-[calc(100dvh-4rem)] pointer-fine:max-w-[calc(100vw-2rem)]",
              "pointer-fine:resize pointer-fine:overflow-hidden",
            )
          : cn("md:w-[calc(100vw-2rem)]", LATIME[marime]),
      )}
    >
      <div className="border-border flex shrink-0 items-start justify-between gap-4 border-b p-4">
        <div className="min-w-0">
          <h2 id={idTitlu} className="text-sectiune font-semibold text-balance">
            {titlu}
          </h2>
          {descriere === undefined ? null : (
            <p id={idDescriere} className="text-muted-foreground text-corp mt-1 text-pretty">
              {descriere}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={laInchidere}
          aria-label="Închide"
          className="text-muted-foreground hover:bg-surface hover:text-foreground rounded-control -m-1 shrink-0 p-1 transition-colors"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>

      {children === undefined ? null : (
        // `overflow-visible` sub prag: altfel ar rămâne un derulator imbricat
        // în interiorul celui al casetei, iar degetul ar prinde când unul, când
        // celălalt.
        <div className="min-h-0 flex-1 overflow-y-auto p-4 [@media(max-height:26rem)]:overflow-visible">
          {children}
        </div>
      )}
      {subsol === undefined ? null : (
        <div className="border-border bg-surface flex shrink-0 flex-wrap justify-end gap-2 border-t p-4">
          {subsol}
        </div>
      )}
    </dialog>
  );
}

/**
 * Confirmarea unei acțiuni ireversibile.
 *
 * Sunt ~30 în aplicație, în 14 module, și niciuna nu întreabă nimic: aprobarea
 * unei perioade de salarizare, aprobarea în bloc a pontajului (fără acțiune
 * inversă în `actions.ts`), blocarea lunii, „Marchează decontată" (din care nu
 * se mai iese, prin trigger), casarea unui obiect de inventar, dezactivarea
 * unei grile de concediu care schimbă dreptul anual al zecilor de angajați, și
 * ștergerea unui pas de șablon aflată la 4 px de butonul de editare.
 *
 * ── DE CE `consecinta` E OBLIGATORIE ──────────────────────────────────────
 * „Sigur doriți să continuați?" nu e o confirmare, e o formalitate — omul dă
 * clic pe „Da" fără s-o citească. Ce oprește greșeala e propoziția care spune
 * CE se întâmplă și pe CÂȚI îi atinge. De aceea `consecinta` e obligatorie și
 * `cifre` există: „48 de angajați își schimbă dreptul anual" e o frână, „Sigur?"
 * nu e.
 *
 * ── `cereTastare` ─────────────────────────────────────────────────────────
 * Pentru ireversibilul peste bani. Cere scrierea unui cuvânt înainte de a
 * debloca butonul. Nu se folosește peste tot: dacă apare la fiecare confirmare,
 * devine tot un reflex.
 */
export type PropsConfirmare = Readonly<{
  deschis: boolean;
  laInchidere: () => void;
  titlu: string;
  consecinta: string;
  cifre?: readonly Readonly<{ eticheta: string; valoare: string }>[];
  etichetaConfirmare: string;
  distructiv?: boolean;
  /** Cuvântul care trebuie tastat ca să se deblocheze confirmarea. */
  cereTastare?: string;
  inCurs?: boolean;
  laConfirmare: () => void;
}>;

export function ConfirmareActiune({
  deschis,
  laInchidere,
  titlu,
  consecinta,
  cifre,
  etichetaConfirmare,
  distructiv,
  cereTastare,
  inCurs,
  laConfirmare,
}: PropsConfirmare): ReactElement {
  const [tastat, setTastat] = useState("");
  const [deschisPrecedent, setDeschisPrecedent] = useState(deschis);
  const blocat = cereTastare !== undefined && tastat.trim() !== cereTastare;

  // Ajustare de stare la schimbarea unei prop, în timpul randării — tiparul
  // documentat de React pentru cazul ăsta. Un `useEffect` ar fi randat o dată
  // cu textul vechi înainte să-l șteargă, iar dialogul redeschis ar fi arătat
  // pentru o clipă cuvântul tastat data trecută, cu butonul deja deblocat.
  if (deschis !== deschisPrecedent) {
    setDeschisPrecedent(deschis);
    setTastat("");
  }

  return (
    <Dialog
      deschis={deschis}
      laInchidere={laInchidere}
      titlu={titlu}
      descriere={consecinta}
      marime="mic"
      subsol={
        <>
          <Buton varianta="secundar" onClick={laInchidere} disabled={inCurs === true}>
            Renunță
          </Buton>
          <Buton
            varianta={distructiv === true ? "distructiv" : "primar"}
            onClick={laConfirmare}
            disabled={blocat}
            inCurs={inCurs === true}
            textInCurs="Se execută…"
          >
            {etichetaConfirmare}
          </Buton>
        </>
      }
    >
      {cifre === undefined || cifre.length === 0 ? null : (
        <dl className="border-border divide-border rounded-panou divide-y border">
          {cifre.map((c) => (
            <div key={c.eticheta} className="flex items-baseline justify-between gap-4 px-3 py-2">
              <dt className="text-muted-foreground text-corp">{c.eticheta}</dt>
              <dd className="text-foreground text-corp font-mono font-semibold tabular-nums">
                {c.valoare}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {cereTastare === undefined ? null : (
        <div className={cifre === undefined || cifre.length === 0 ? "" : "mt-4"}>
          <Camp
            nume="confirmare"
            eticheta={`Scrieți „${cereTastare}” ca să confirmați`}
            obligatoriu
          >
            {(a) => (
              <input
                {...a}
                type="text"
                autoComplete="off"
                value={tastat}
                onChange={(e) => setTastat(e.target.value)}
              />
            )}
          </Camp>
        </div>
      )}
    </Dialog>
  );
}

/**
 * Panoul lateral, pentru formularele care azi stau permanent deschise în flux.
 *
 * Sunt ~15 în aplicație; fișa echipamentului are PATRU simultan, unul cu 15
 * câmpuri. Efectul pe ecran: pagina e mai mult formular gol decât conținut, iar
 * secțiunile de dedesubt sunt împinse afară din prima privire.
 *
 * Panou, nu dialog, fiindcă multe dintre ele sunt lungi și au nevoie de
 * derulare proprie fără să acopere contextul din stânga.
 */
export function PanouLateral({
  deschis,
  laInchidere,
  titlu,
  descriere,
  children,
  subsol,
}: Omit<PropsDialog, "marime">): ReactElement {
  const ref = useRef<HTMLDialogElement | null>(null);
  const idTitlu = useId();

  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    if (deschis && !el.open) el.showModal();
    if (!deschis && el.open) el.close();
  }, [deschis]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitlu}
      // Citit de `globals.css`: panoul intră dinspre marginea lui, caseta urcă.
      data-panou="lateral"
      onCancel={(e) => {
        e.preventDefault();
        laInchidere();
      }}
      onClick={(e) => {
        if (e.target === ref.current) laInchidere();
      }}
      className={cn(
        "bg-background text-foreground shadow-plutitor border-border ms-auto me-0 h-dvh max-h-dvh w-full max-w-xl border-s p-0",
        "backdrop:bg-foreground/50",
        // ── DE CE `hidden … open:flex`, ȘI NU `flex` ───────────────────────
        // Un `flex` necondiționat bate regula `dialog:not([open]) { display:
        // none }` a foii de stil a browserului — CSS-ul autorului o bate
        // ÎNTOTDEAUNA. Panoul închis rămânea atunci o cutie reală: `position:
        // absolute` (implicitul UA pentru un `<dialog>` nemodal — doar
        // `dialog:modal` e `fixed`), `h-dvh` înaltă și `max-w-xl` lată,
        // așezată la poziția ei statică din flux. Invizibilă, dar numărată în
        // `scrollHeight`: pe `/departamente`, la o fereastră de 1365×969,
        // documentul ieșea 1575px în vizualizarea listă și 1696px în
        // organigramă — între 606 și 727 de pixeli de derulare în gol, sub
        // conținut. Măsurat în browser pe 17 sept 2026; aceeași greșeală era
        // deja prinsă o dată în `command-palette.tsx`.
        //
        // Comutarea lui `display` e și cea pe care o AȘTEAPTĂ `globals.css`:
        // regula de pe `dialog` animă `display` cu `allow-discrete` plus
        // `@starting-style`. Cu `flex` fix, nu era nimic de comutat.
        "hidden flex-col open:flex",
      )}
    >
      <div className="border-border flex shrink-0 items-start justify-between gap-4 border-b p-4">
        <div className="min-w-0">
          <h2 id={idTitlu} className="text-sectiune font-semibold text-balance">
            {titlu}
          </h2>
          {descriere === undefined ? null : (
            <p className="text-muted-foreground text-corp mt-1 text-pretty">{descriere}</p>
          )}
        </div>
        <button
          type="button"
          onClick={laInchidere}
          aria-label="Închide"
          className="text-muted-foreground hover:bg-surface hover:text-foreground rounded-control -m-1 shrink-0 p-1 transition-colors"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>

      {subsol === undefined ? null : (
        <div className="border-border bg-surface flex shrink-0 flex-wrap justify-end gap-2 border-t p-4">
          {subsol}
        </div>
      )}
    </dialog>
  );
}
