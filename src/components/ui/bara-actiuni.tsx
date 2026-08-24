// src/components/ui/bara-actiuni.tsx
import type { ReactElement, ReactNode } from "react";

import { cn } from "@/lib/ui/cn";

/**
 * Bara de acțiuni — locul unde se termină un formular sau un ecran.
 *
 * ── CE ÎNLOCUIEȘTE, MĂSURAT ───────────────────────────────────────────────
 * 75 de rânduri de acțiuni (un `<div class="flex … gap-…">` cu cel puțin două
 * butoane), în 49 de fișiere. Numărate, nu estimate:
 *
 * · **Distanța**: `gap-2` de 35 de ori, `gap-3` de 29, plus `gap-1`, `gap-4` și
 *   `gap-6`. Cinci distanțe pentru același obiect.
 * · **Alinierea**: doar 2 din cele 75 sunt la dreapta. Dar cele două footere de
 *   dialog (`dialog.tsx:102` și `:298`) sunt `justify-end` — deci același
 *   produs pune „Salvează” în stânga pe pagină și în dreapta în dialog.
 * · **Ordinea**: acțiunea primară e PRIMA în 48 de rânduri și ultima în 3.
 *   `angajati/[id]/sectiune-dependenti.tsx:166` scrie „Salvează”, apoi
 *   „Renunță”; `pontaj/celula-zi.tsx:392` scrie „Renunță”, apoi „Salvează”.
 *   Bara păstrează ordinea dominantă, fiindcă e cea pe care a învățat-o omul.
 * · **Distructiva**: 26 din cele 75 conțin un buton distructiv lipit de restul,
 *   la aceiași 8–12 px. `pontaj/celula-zi.tsx:392` e cazul complet — „Șterge
 *   ziua”, „Renunță” și „Salvează” umăr la umăr, cu `gap-2`.
 *
 * Distanța implicită e `gap-3` (12 px), nu `gap-2`: 8 px e exact ce a pus
 * „Șterge ziua” lângă „Salvează”, iar `dialog.tsx` se plânge deja, în propriul
 * docblock, de „ștergerea unui pas de șablon aflată la 4 px de butonul de
 * editare”.
 *
 * ── DE CE `children`, NU UN TABLOU DE DESCRIERI ───────────────────────────
 * Bara ARANJEAZĂ butoane deja randate. Un API de forma
 * `actiuni={[{ eticheta, onClick }]}` ar trimite o FUNCȚIE peste granița
 * server→client și ar cădea la runtime în oricare din cele 94 de pagini din
 * `(app)`, care sunt toate Server Components — același raționament, scris pe
 * larg, e în `tabel.tsx`.
 *
 * Fără `"use client"`, fișierul e *partajat*: se compilează în graful care îl
 * importă, deci un formular client îi dă butoane cu `onClick` fără nicio
 * graniță la mijloc, iar o pagină server îi dă `<Link>`-uri.
 *
 * Consecință deliberată: bara nu știe care buton e „primarul” și nu-l
 * redefinește. `buton.tsx` are deja variantele — inclusiv distructivul
 * conturat, care se INVERSEAZĂ la hover — și uniunea discriminată care obligă
 * `aria-label` la butoanele doar-iconiță.
 *
 * ── ORDINEA DIN DOM = ORDINEA DE PE ECRAN ─────────────────────────────────
 * Nicăieri `flex-row-reverse`, `flex-col-reverse` sau `order-*`. Toate trei
 * mută pixelii fără să miște DOM-ul: omul vede „Renunță | Salvează”, apasă Tab
 * și ajunge invers. Alinierea se face cu `justify-*` și cu o margine automată —
 * amândouă mută GRUPUL, nu elementele din el.
 *
 * ── DISTRUCTIVA ───────────────────────────────────────────────────────────
 * Ultima în DOM, la capătul opus al barei, împinsă de `ms-auto`, cu o riglă
 * între ea și rest. Fiecare din cele trei repară altceva:
 *
 * · `ms-auto` singur se strânge la zero când bara e îngustă sau se rupe pe două
 *   rânduri — atunci „Șterge” ajunge din nou la 12 px de „Salvează”. Rigla e
 *   distanța GARANTATĂ, nu cea rămasă din spațiul liber.
 * · Ultima în DOM înseamnă ultima la tabulare: cine vine din câmpuri apasă Tab
 *   și cade pe acțiunea principală, nu pe cea care șterge.
 * · `ms-`/`border-s` sunt logice, nu `ml-`/`border-l`: aceeași bară ține și
 *   într-un sens de citire inversat, fără o a doua listă de clase.
 *
 * Cu o distructivă prezentă, `aliniere` nu mai are efect: o margine automată
 * absoarbe spațiul liber ÎNAINTE ca `justify-content` să-l împartă, deci grupul
 * principal rămâne la început. E scris aici fiindcă altfel pare un defect.
 *
 * ── DE CE `role="group"` ȘI NU `role="toolbar"` ───────────────────────────
 * `toolbar` PROMITE navigare cu săgeți și o singură oprire de tabulare pentru
 * tot grupul (roving tabindex). Nu o implementăm, iar o promisiune ARIA
 * neonorată e mai rea decât tăcerea: omul apasă săgeata și nu se întâmplă
 * nimic, dar tabularea prin butoane i-a fost deja luată.
 *
 * Rolul apare NUMAI împreună cu `eticheta`. Un grup fără nume accesibil adaugă
 * un „intrare în grup / ieșire din grup” la fiecare formular, fără nicio
 * informație în plus.
 *
 * ── LIPITĂ JOS PE TELEFON ─────────────────────────────────────────────────
 * `sticky`, nu `fixed`: bara rămâne în flux, deci nu acoperă ultimul câmp al
 * formularului și nu cere o umplutură de jos compensatorie pe pagină.
 *
 * `pb-[max(0.75rem,env(safe-area-inset-bottom))]` e exact tiparul din
 * `toast.tsx:125`. Fără el, pe iPhone butonul „Salvează” stă sub indicatorul de
 * gesturi: `layout.tsx` declară `viewportFit: "cover"`, deci `bottom: 0`
 * înseamnă marginea fizică a ecranului, nu marginea zonei sigure. `max()`, nu
 * doar `env()`, fiindcă pe un telefon fără crestătură inset-ul e 0 și bara ar
 * rămâne fără nicio umplutură de jos.
 *
 * Nivelul de stivuire e `z-antet` (40), NU `z-plutitor` (70). Bara trebuie să
 * stea peste antetul lipit al unui tabel lung (`z-antet-tabel`, 20), dar SUB
 * sertarul mobil și fundalul lui întunecat (`z-scrim` 50 și `z-sertar` 60 —
 * `sidebar.tsx:95` și `:105`, care sunt `z-index` obișnuit, nu strat superior)
 * și sub notificări (`z-plutitor`, `toast.tsx:125`). Pe `z-plutitor`, butonul
 * „Salvează” ar pluti peste meniul deschis și ar putea fi apăsat prin el.
 * `z-antet` e nivelul cadrului propriu al aplicației, iar antetul e la marginea
 * de sus și bara la cea de jos: nu se întâlnesc niciodată.
 */
const LIPITA = cn(
  "max-md:bg-background max-md:border-border max-md:z-antet max-md:sticky max-md:bottom-0",
  "max-md:border-t max-md:pt-3",
  // `pt-3` + `pb-[…]`, nu `py-3` + `pb-[…]`: `cn` știe că `pb` intră în
  // conflict cu `py` și ar șterge ULTIMA declarație de umplutură de sus.
  "max-md:pb-[max(0.75rem,env(safe-area-inset-bottom))]",
);

const ALINIERE = {
  start: "justify-start",
  final: "justify-end",
} as const satisfies Readonly<Record<string, string>>;

export type AliniereBara = keyof typeof ALINIERE;

export type PropsBaraActiuni = Readonly<{
  /** Butoanele, în ordinea de citire ȘI de tabulare. Acțiunea primară prima. */
  children: ReactNode;
  /** Acțiunea distructivă. Se separă singură de rest — vezi docblock. */
  distructiva?: ReactNode;
  /** `start` (implicit) urmează cele 48 de rânduri din depozit; `final`, footerul de dialog. */
  aliniere?: AliniereBara;
  /** Rigla de sus, pentru barele care încheie un formular lung. */
  separata?: boolean;
  /** Sub `md`, bara se lipește de marginea de jos a ecranului. */
  lipitaPeTelefon?: boolean;
  /** Numele grupului. Fără el nu se emite `role="group"` — vezi docblock. */
  eticheta?: string;
  className?: string;
}>;

export function BaraActiuni({
  children,
  distructiva,
  aliniere = "start",
  separata,
  lipitaPeTelefon,
  eticheta,
  className,
}: PropsBaraActiuni): ReactElement {
  return (
    <div
      {...(eticheta === undefined ? {} : { role: "group", "aria-label": eticheta })}
      className={cn(
        "flex flex-wrap items-center gap-3",
        ALINIERE[aliniere],
        separata === true ? "border-border border-t pt-4" : "",
        lipitaPeTelefon === true ? LIPITA : "",
        className,
      )}
    >
      {children}
      {distructiva === undefined ? null : (
        <span className="border-border ms-auto flex flex-wrap items-center gap-3 border-s ps-3">
          {distructiva}
        </span>
      )}
    </div>
  );
}
