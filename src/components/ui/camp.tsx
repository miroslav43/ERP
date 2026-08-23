// src/components/ui/camp.tsx
import { cva } from "class-variance-authority";
import { AlertCircle, ChevronDown } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

import { cn } from "@/lib/ui/cn";

/**
 * Câmpul de formular. Înlocuiește ~419 apariții ale chenarului de control și
 * cele patru constante `CLASA_CAMP` divergente scrise prin fișiere.
 *
 * ── DE CE E O COMPONENTĂ, NU O CONSTANTĂ ──────────────────────────────────
 * Argumentul nu e economia de cod, ci **imposibilitatea uitării**. Serverul
 * construiește deja `fieldErrors` la fiecare acțiune (`create-action.ts`), și
 * doar ~7 din 99 de formulare le citesc; restul afișează un singur `<p>` roșu
 * la baza formularului, la sute de pixeli de câmpul vinovat. Aici, un câmp NU
 * se poate randa fără să treacă prin locul care leagă `aria-invalid` de
 * `aria-describedby` — deci mesajul ajunge lângă câmp prin construcție.
 *
 * ── DE CE `nume` ȘI NU `useId()` ──────────────────────────────────────────
 * `useId` e un hook, deci ar face din `Camp` o componentă de client. Cum
 * `children` e o funcție de randare, iar o funcție NU traversează granița
 * server→client, orice pagină din `(app)` — toate 94 sunt Server Components —
 * ar fi picat la runtime.
 *
 * Fără hook, fișierul n-are `"use client"` și devine **partajat**: se compilează
 * în graful care îl importă, deci funcția de randare se creează și se consumă
 * de aceeași parte a graniței. Regula ține pentru tot `src/components/ui/`:
 * nicio primitivă nu primește `"use client"` decât dacă are nevoie de stare
 * proprie.
 *
 * Identificatorii se derivă din `nume`, care e oricum unic într-un formular.
 * Două formulare pe același ecran cu același nume de câmp: se dă `id` explicit.
 *
 * ── CUM SE FOLOSEȘTE CU react-hook-form ───────────────────────────────────
 * `register()` întoarce `{ name, onChange, onBlur, ref }`. Se împrăștie DUPĂ
 * atributele primite de la `Camp`, ca ref-ul să ajungă la element:
 *
 *   <Camp nume="cnp" eticheta="CNP" erori={erori.cnp}>
 *     {(a) => <input {...a} {...register("cnp")} />}
 *   </Camp>
 *
 * `className`, `aria-invalid` și `aria-describedby` nu apar în `register()`,
 * deci supraviețuiesc împrăștierii.
 */

const controlBaza = cn(
  "rounded-control border-foreground/60 bg-background w-full border",
  "text-corp text-foreground px-3 transition-colors",
  "placeholder:text-muted-foreground",
  "hover:border-foreground",
  // Focusul vine EXCLUSIV din regula globală `:focus-visible` din globals.css.
  "disabled:border-border disabled:bg-surface disabled:text-muted-foreground disabled:cursor-not-allowed",
  "read-only:border-border read-only:bg-surface",
  "aria-invalid:border-danger",
);

const varianteControl = cva(controlBaza, {
  variants: {
    fel: {
      input: "h-9 pointer-coarse:h-11",
      // `<select>` nativ: săgeata proprie a browserului nu se poate colora, deci
      // se ascunde și se desenează una din paletă. `[&>option]` repară lista de
      // opțiuni, care altfel moștenește culorile sistemului.
      select: cn(
        "h-9 cursor-pointer appearance-none pr-9 pointer-coarse:h-11",
        "[&>option]:bg-background [&>option]:text-foreground",
      ),
      textarea: "min-h-20 py-2",
    },
  },
  defaultVariants: { fel: "input" },
});

export type FelControl = "input" | "select" | "textarea";

/** Clasele unui control, pentru cazurile care nu trec prin `<Camp>`. */
export function clasaControl(optiuni: Readonly<{ fel?: FelControl }> = {}): string {
  return cn(varianteControl(optiuni));
}

/** Bifa și radioul: `accent-primary` le dă culoarea firmei, nu albastrul sistemului. */
export const clasaBifa = "size-4 shrink-0 rounded-xs border-foreground/60 accent-primary";

export type AtributeControl = Readonly<{
  id: string;
  name: string;
  className: string;
  required: boolean | undefined;
  "aria-invalid": true | undefined;
  "aria-describedby": string | undefined;
}>;

export type PropsCamp = Readonly<{
  /** Numele câmpului din `FormData`. Din el se derivă și identificatorii. */
  nume: string;
  eticheta: string;
  /** Suprascrie identificatorul derivat — necesar doar la două formulare pe un ecran. */
  id?: string;
  fel?: FelControl;
  ajutor?: string;
  /** Mesajele venite din `ActionResult.fieldErrors` sau din validarea de client. */
  erori?: readonly string[];
  obligatoriu?: boolean;
  className?: string;
  children: (atribute: AtributeControl) => ReactNode;
}>;

export function Camp({
  nume,
  eticheta,
  id,
  fel = "input",
  ajutor,
  erori,
  obligatoriu,
  className,
  children,
}: PropsCamp): ReactElement {
  const idCamp = id ?? `camp-${nume}`;
  const idAjutor = `${idCamp}-ajutor`;
  const idEroare = `${idCamp}-eroare`;
  const areEroare = erori !== undefined && erori.length > 0;

  // Ordinea contează pentru cititorul de ecran: întâi ce e greșit, apoi ce se
  // aștepta. Un om care aude „format aaaa-ll-zz” după „data e obligatorie”
  // primește explicația imediat după problemă.
  const descrieri = [areEroare ? idEroare : null, ajutor !== undefined ? idAjutor : null]
    .filter((v): v is string => v !== null)
    .join(" ");

  const control = children({
    id: idCamp,
    name: nume,
    className: clasaControl({ fel }),
    required: obligatoriu === true ? true : undefined,
    "aria-invalid": areEroare ? true : undefined,
    "aria-describedby": descrieri === "" ? undefined : descrieri,
  });

  return (
    <div className={cn("flex flex-col", className)}>
      <label htmlFor={idCamp} className="text-foreground text-corp mb-1 block font-medium">
        {eticheta}
        {obligatoriu === true ? (
          <>
            {" "}
            <span className="text-danger" aria-hidden="true">
              *
            </span>
            <span className="sr-only">(obligatoriu)</span>
          </>
        ) : null}
      </label>

      {fel === "select" ? (
        <span className="relative block">
          {control}
          <ChevronDown
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
          />
        </span>
      ) : (
        control
      )}

      {areEroare ? (
        <p
          id={idEroare}
          role="alert"
          className="text-danger text-nota mt-1 flex items-start gap-1.5"
        >
          <AlertCircle aria-hidden="true" className="size-3.5 shrink-0 translate-y-px" />
          <span>{erori.join(" ")}</span>
        </p>
      ) : null}

      {ajutor !== undefined ? (
        <p id={idAjutor} className="text-muted-foreground text-nota mt-1">
          {ajutor}
        </p>
      ) : null}
    </div>
  );
}
