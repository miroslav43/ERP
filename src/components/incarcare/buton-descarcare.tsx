// src/components/incarcare/buton-descarcare.tsx
"use client";

import { useState, type ReactElement, type ReactNode } from "react";

import { useSemnalIncarcare } from "./use-incarcare";
import { Buton, type VariantaButon } from "@/components/ui/buton";
import { arataToast } from "@/components/ui/toast";

/**
 * Descărcarea unui export, cu stare — în locul unui `<a href>` brut.
 *
 * Trei defecte distincte, toate rezolvate de faptul că cererea trece prin
 * `fetch` în loc de navigare:
 *
 * 1. TĂCEREA. Rutele de export fac zeci de interogări (statul de plată citește
 *    per angajat). Un `<a>` nu are stare: butonul rămâne identic, iar omul
 *    apasă a doua și a treia oară, pornind încă două generări.
 *
 * 2. REFUZUL ÎNLOCUIA ECRANUL. Rutele răspund la lipsa dreptului cu
 *    `text/plain` (`d112/route.ts:41`). Printr-o navigare, asta însemna că
 *    ecranul de salarizare era înlocuit cu o pagină albă cu o propoziție, fără
 *    drum înapoi decât butonul browserului. Prin `fetch`, rămâi pe pagină și
 *    primești o notificare.
 *
 * 3. CIFRELE DE CONTROL NU AJUNGEAU LA NIMENI. `bancar/route.ts:161-167` pune
 *    în antete `x-plati-incluse`, `x-suma-control` și `x-fara-iban` — „ce NU a
 *    intrat în fișier, ca omul să afle fără să deschidă XML-ul și să numere".
 *    O descărcare prin `<a>` nu arată niciodată un antet HTTP. Aici se citesc
 *    și intră în notificarea de reușită, care e chiar locul unde omul se uită.
 */

const ANTETE_CONTROL: ReadonlyArray<readonly [string, string]> = [
  ["x-plati-incluse", "plăți"],
  ["x-suma-control", "sumă de control"],
  ["x-fara-iban", "fără IBAN"],
  ["x-angajati-inclusi", "angajați"],
  ["x-randuri", "rânduri"],
];

/** `attachment; filename="salarii-2026-08.xml"` → `salarii-2026-08.xml`. */
function numeDinAntet(dispozitie: string | null, implicit: string): string {
  if (dispozitie === null) return implicit;
  const potrivire = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(dispozitie);
  return potrivire?.[1] ?? implicit;
}

export function ButonDescarcare({
  href,
  children,
  eticheta,
  numeImplicit = "export",
  varianta = "secundar",
  className,
}: Readonly<{
  href: string;
  children: ReactNode;
  /** Ce se pregătește, pentru voalul global: „fișierul bancar". */
  eticheta: string;
  numeImplicit?: string | undefined;
  varianta?: VariantaButon | undefined;
  className?: string | undefined;
}>): ReactElement {
  const [inCurs, setInCurs] = useState(false);
  useSemnalIncarcare(inCurs, eticheta);

  async function descarca(): Promise<void> {
    if (inCurs) return;
    setInCurs(true);
    try {
      const raspuns = await fetch(href);

      if (!raspuns.ok) {
        // Rutele răspund cu `text/plain`, nu cu JSON — vezi docblock-ul.
        const motiv = (await raspuns.text()).trim();
        arataToast({
          fel: "eroare",
          text: motiv.length > 0 ? motiv : `Exportul a eșuat (${String(raspuns.status)}).`,
        });
        return;
      }

      const nume = numeDinAntet(raspuns.headers.get("content-disposition"), numeImplicit);
      const continut = await raspuns.blob();

      const adresa = URL.createObjectURL(continut);
      const ancora = document.createElement("a");
      ancora.href = adresa;
      ancora.download = nume;
      document.body.append(ancora);
      ancora.click();
      ancora.remove();
      // Revocarea imediată taie descărcarea în unele browsere; un tick e destul.
      setTimeout(() => {
        URL.revokeObjectURL(adresa);
      }, 0);

      const control = ANTETE_CONTROL.flatMap(([antet, nume_]) => {
        const valoare = raspuns.headers.get(antet);
        return valoare === null ? [] : [`${nume_}: ${valoare}`];
      });

      arataToast({
        fel: "reusita",
        text: control.length > 0 ? `${nume} · ${control.join(" · ")}` : `S-a descărcat ${nume}.`,
      });
    } catch {
      // Rețea căzută sau descărcare oprită de browser. Fără `catch`, butonul ar
      // rămâne blocat pe „Se pregătește…" la nesfârșit.
      arataToast({ fel: "eroare", text: "Descărcarea nu a putut fi pornită. Încercați din nou." });
    } finally {
      setInCurs(false);
    }
  }

  return (
    <Buton
      type="button"
      varianta={varianta}
      onClick={() => void descarca()}
      inCurs={inCurs}
      textInCurs="Se pregătește…"
      {...(className === undefined ? {} : { className })}
    >
      {children}
    </Buton>
  );
}
