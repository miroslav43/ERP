// src/components/ui/buton.tsx
import { cva } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactElement } from "react";

import { cn } from "@/lib/ui/cn";

/**
 * Butonul aplicației. Înlocuiește ~200 de apariții ale aceluiași șir de clase,
 * răspândite în 172 de fișiere.
 *
 * Trei lucruri intră aici o singură dată și dispar prin construcție din tot
 * restul codului:
 *
 * 1. **Starea dezactivată.** Erau 90 de `disabled:opacity-50` și
 *    `disabled:opacity-60` în cod. Amândouă pică WCAG — 3,22:1 și 4,34:1,
 *    calculat, nu estimat (`docs/design/stari-de-interactiune.md`). Setul
 *    corect e în bază, deci nu mai există loc unde să fie scris greșit.
 *
 * 2. **Butonul distructiv nu are variantă plină.** La hover se INVERSEAZĂ —
 *    6,11:1 în ambele stări, iar semnalul merge spre închis. Opacitatea peste
 *    crem DESCHIDE, deci ar da semnal invers exact la confirmarea finală.
 *
 * 3. **Focusul nu se scrie niciodată local.** Regula globală `:focus-visible`
 *    din `globals.css` acoperă tot. Erau 155 de `focus-visible:outline-*`
 *    scrise de mână, dintre care unele o ANULAU prin `outline-none`.
 *
 * Ținta tactilă folosește `pointer-coarse:`, nu un prag de lățime: o tabletă
 * în peisaj are peste 768px și tot cu degetul se apasă.
 */
export type VariantaButon = "primar" | "secundar" | "distructiv" | "tertiar" | "link";

const varianteButon = cva(
  cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-control border border-transparent font-medium",
    "text-corp h-9 px-4 pointer-coarse:h-11",
    "transition-colors active:translate-y-px",
    "aria-busy:cursor-progress",
    "disabled:translate-y-0 disabled:cursor-not-allowed",
    "disabled:border-border disabled:bg-surface disabled:text-muted-foreground",
  ),
  {
    variants: {
      varianta: {
        primar:
          "bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active",
        secundar:
          "border-foreground/60 bg-background text-foreground hover:bg-surface active:bg-border",
        // Conturat, niciodată plin. Inversare la hover, nu diluare.
        distructiv: cn(
          "border-danger bg-background text-danger",
          "hover:bg-danger hover:text-danger-foreground",
          "active:bg-danger active:text-danger-foreground",
        ),
        tertiar: "text-foreground hover:bg-surface active:bg-border",
        // Un link nu are înălțime de buton, nici chenar, nici umplutură.
        link: cn(
          "h-auto border-0 px-0 pointer-coarse:h-auto",
          "text-primary underline decoration-1 underline-offset-4",
          "hover:decoration-2",
          "disabled:text-muted-foreground disabled:bg-transparent disabled:no-underline",
        ),
      },
      marime: {
        implicit: "",
        iconita: "size-9 gap-0 px-0 pointer-coarse:size-11",
      },
    },
    defaultVariants: { varianta: "secundar", marime: "implicit" },
  },
);

/**
 * Clasele butonului, pentru elementele care NU sunt `<button>` — mai ales
 * `<Link>`. Trec prin `cn`, deci variantele care contrazic baza (linkul, care
 * n-are înălțime) o suprascriu curat în loc să se adune lângă ea.
 */
export function buton(
  optiuni: Readonly<{ varianta?: VariantaButon; marime?: "implicit" | "iconita" }> = {},
): string {
  return cn(varianteButon(optiuni));
}

type PropsComune = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> &
  Readonly<{
    varianta?: VariantaButon;
    className?: string;
    /** Adaugă rotița, marchează `aria-busy` și blochează butonul. */
    inCurs?: boolean;
    /** Textul care ÎNLOCUIEȘTE conținutul cât timp `inCurs` — „Se salvează…”. */
    textInCurs?: string;
  }>;

/**
 * Uniune discriminată, nu un `marime?` liber: un buton doar-iconiță fără
 * `aria-label` **nu compilează**. Regula era scrisă în specificație și
 * respectată inconsecvent; acum o ține compilatorul, nu memoria.
 */
export type PropsButon = PropsComune &
  (Readonly<{ marime?: "implicit" }> | Readonly<{ marime: "iconita"; "aria-label": string }>);

export function Buton({
  varianta = "secundar",
  className,
  inCurs = false,
  textInCurs,
  children,
  disabled,
  type = "button",
  ...rest
}: PropsButon): ReactElement {
  const marime = "marime" in rest && rest.marime === "iconita" ? "iconita" : "implicit";
  const { marime: _marime, ...atribute } = rest as typeof rest & { marime?: unknown };

  return (
    <button
      {...atribute}
      type={type}
      disabled={disabled === true || inCurs}
      aria-busy={inCurs ? true : undefined}
      className={cn(varianteButon({ varianta, marime }), className)}
    >
      {inCurs ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
      {inCurs && textInCurs !== undefined ? textInCurs : children}
    </button>
  );
}
