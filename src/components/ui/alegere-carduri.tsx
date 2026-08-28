// src/components/ui/alegere-carduri.tsx
import type { LucideIcon } from "lucide-react";
import type { ReactElement } from "react";

import { cn } from "@/lib/ui/cn";

/**
 * O alegere dintr-un set, desenată ca rând de carduri în locul unui `<select>`.
 *
 * ── CÂND MERITĂ, ȘI CÂND NU ───────────────────────────────────────────────
 * Merită când alegerea RAMIFICĂ restul ecranului și fiecare opțiune are nevoie
 * de o explicație proprie — „ce fel de material?", „cum se dovedește
 * parcurgerea?". Într-un `<select>`, explicația poate sta doar sub control, deci
 * omul o vede DUPĂ ce a ales, pentru opțiunea pe care a ales-o. Aici le vede pe
 * toate deodată, înainte.
 *
 * NU merită pentru o listă lungă, pentru o alegere fără consecințe, sau când
 * opțiunile n-au ce explica. Acolo `<select>` cu `ajutor` e mai mic și mai bun.
 *
 * ── DE CE `<input type="radio">` ȘI NU BUTOANE ────────────────────────────
 * Același argument ca la `ScalaNotare` din `components/evaluari`, de unde e
 * scalat tiparul: nativ, un grup de radio aduce gratuit navigarea cu săgețile
 * în interiorul grupului, un singur `Tab` pentru tot grupul, anunțarea „2 din 4"
 * și asocierea automată la formular. Un grup de `<button role="radio">` ar fi
 * cerut `tabindex` mobil scris de mână — iar varianta scrisă de mână e cea care
 * se strică prima.
 *
 * Intrarea e ascunsă vizual (`sr-only`), iar `<label>` poartă tot desenul.
 * Focusul se ia de la intrare prin `has-[:focus-visible]`, ca inelul global din
 * `globals.css` să apară pe cardul vizibil, nu pe un element de 0 px.
 *
 * ── CONTROLATĂ SAU NU ─────────────────────────────────────────────────────
 * Aceeași convenție ca `Combobox`: cu `valoare` e controlată, fără ea e
 * necontrolată și pleacă în `FormData` sub `nume`.
 */

export type OptiuneCard = Readonly<{
  valoare: string;
  eticheta: string;
  /** O propoziție. Se vede în card, nu într-un `ajutor` de sub control. */
  descriere: string;
  pictograma?: LucideIcon;
}> &
  /**
   * Uniune discriminată: o opțiune stinsă FĂRĂ motivul ei nu compilează.
   *
   * Al doilea de tipul ăsta din proiect, după `IncarcareFisier`. Răspunsul
   * mecanic la defectul care se repetă: șapte butoane `disabled` în modulul de
   * cursuri, niciunul cu motivul scris lângă el.
   */
  (Readonly<{ indisponibil?: false }> | Readonly<{ indisponibil: true; motiv: string }>);

export type PropsAlegereCarduri = Readonly<{
  nume: string;
  /** Numele grupului pentru cititoarele de ecran. */
  eticheta: string;
  optiuni: readonly OptiuneCard[];
  /** Prezent ⇒ controlată. */
  valoare?: string;
  valoareInitiala?: string;
  laSchimbare?: (valoare: string) => void;
  /** Câte carduri pe rând de la `sm` în sus. Sub `sm` sunt mereu pe verticală. */
  coloane?: 2 | 3 | 4;
  className?: string;
}>;

const COLOANE: Readonly<Record<2 | 3 | 4, string>> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

export function AlegereCarduri({
  nume,
  eticheta,
  optiuni,
  valoare,
  valoareInitiala,
  laSchimbare,
  coloane = 3,
  className,
}: PropsAlegereCarduri): ReactElement {
  const controlata = valoare !== undefined;

  return (
    <div
      role="group"
      aria-label={eticheta}
      className={cn("grid gap-3", COLOANE[coloane], className)}
    >
      {optiuni.map((optiune) => {
        const stinsa = optiune.indisponibil === true;
        const selectata = controlata ? valoare === optiune.valoare : undefined;
        const Pictograma = optiune.pictograma;

        return (
          <label
            key={optiune.valoare}
            className={cn(
              "rounded-panou flex cursor-pointer flex-col gap-1 border p-4 transition-colors",
              "has-[:focus-visible]:outline-ring has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2",
              // Starea selectată se citește și fără culoare: chenar mai gros și
              // fundal propriu. La imprimantă și la daltonism, culoarea singură
              // n-ar spune nimic.
              "has-[:checked]:border-primary has-[:checked]:bg-surface has-[:checked]:ring-primary has-[:checked]:ring-1",
              stinsa
                ? "border-border cursor-default opacity-60"
                : "border-border hover:bg-surface active:bg-border",
            )}
          >
            <input
              type="radio"
              name={nume}
              value={optiune.valoare}
              className="sr-only"
              disabled={stinsa}
              {...(controlata
                ? { checked: selectata === true }
                : { defaultChecked: valoareInitiala === optiune.valoare })}
              onChange={() => {
                laSchimbare?.(optiune.valoare);
              }}
            />

            <span className="flex items-center gap-2 font-medium">
              {Pictograma === undefined ? null : (
                <Pictograma className="size-5 shrink-0" aria-hidden="true" />
              )}
              {optiune.eticheta}
            </span>

            <span className="text-muted-foreground text-nota">{optiune.descriere}</span>

            {/*
              Motivul indisponibilității, VIZIBIL. Într-un `<select>`, o opțiune
              `disabled` e gri și nefocalizabilă — pe iOS practic invizibilă —
              iar explicația nu ajunge la cine are nevoie de ea.
            */}
            {optiune.indisponibil === true ? (
              <span className="text-nota text-warning">{optiune.motiv}</span>
            ) : null}
          </label>
        );
      })}
    </div>
  );
}
