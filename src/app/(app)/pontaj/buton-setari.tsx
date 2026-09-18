// src/app/(app)/pontaj/buton-setari.tsx
import Link from "next/link";
import type { ReactElement } from "react";
import { QrCode } from "lucide-react";

import { buton } from "@/components/ui/buton";

/**
 * Butonul de configurare al modulului de pontaj, pentru colțul din dreapta sus
 * al oricărui ecran din `/pontaj`.
 *
 * ── DE CE ÎNAPOI ÎN ANTET, DUPĂ CE FUSESE MUTAT ÎN BANDĂ ──────────────────
 * Configurarea a stat întâi ca buton scris de mână în antetul foii colective,
 * apoi ca filă în banda de navigare. Al doilea pas rezolva o problemă reală —
 * butonul exista pe UN singur ecran, deci dispărea la orice pas în lateral —
 * dar o rezolva mutând lucrul greșit: banda de file e pentru VIZUALIZĂRI ale
 * aceluiași pontaj (prezența, planul, perioadele, aprobarea, arhiva), iar o
 * filă către un ecran de administrare stă în același rând cu ele și se citește
 * ca a șasea vizualizare.
 *
 * Concediile rezolvaseră deja aceeași problemă altfel, și mai bine: o
 * componentă unică, pusă în antetul FIECĂRUI ecran al modulului. Butonul nu mai
 * dispare la schimbarea filei, iar banda rămâne ce spune că e. Pontajul face
 * acum la fel — vezi `concedii/buton-setari.tsx`, geamănul acestui fișier.
 *
 * ── DE CE ȘI UN AL DOILEA LINK, PENTRU CODURI QR ──────────────────────────
 * Fila „Coduri QR" a fost adăugată în setări, iar reclamația a venit înapoi
 * neschimbată: „în pontaj în continuare nu îmi apare nimic de văzut QR-ul".
 * Avea dreptate. Din `/pontaj`, singurul drum era un buton pe care scrie
 * „Setări" — cuvânt care nu promite niciun cod QR — și abia înăuntru, a treia
 * filă. Două clicuri, dintre care primul cere să ghicești.
 *
 * Codul QR nu e o setare care se alege o dată: e un obiect la care te uiți, pe
 * care îl tipărești și pe care îl refaci când a scăpat unde nu trebuia. Merită
 * deci propriul drum din antet, lângă „Setări", nu sub el.
 *
 * Poarta lui e ALTA: `departments:update`, nu `attendance:update`. Cele două
 * chiar se despart — un rol care configurează pontajul fără drept pe structură
 * vede „Setări" și nu vede codurile, iar un buton care l-ar duce la un refuz e
 * mai rău decât niciunul.
 *
 * ── CE NU E ───────────────────────────────────────────────────────────────
 * `poateConfigura` vine din `fileDePontaj`, adică `attendance:update` pe scope
 * `all` — aceeași cheie pe care o cere pagina țintă. Ascunderea butonului NU e
 * bariera: `/pontaj/setari` își verifică din nou permisiunea, iar RLS respinge
 * scrierile chiar dacă cineva tastează ruta direct. Butonul lipsește pentru că
 * unul care se vede și răspunde „nu aveți dreptul" e mai rău decât niciunul.
 */
export function ButonSetariPontaj({
  poateConfigura,
  poateVedeaCoduriQr = false,
}: {
  readonly poateConfigura: boolean;
  /** `departments:update` la `all`. Vezi `FilePontaj.poateVedeaCoduriQr`. */
  readonly poateVedeaCoduriQr?: boolean;
}): ReactElement | null {
  if (!poateConfigura && !poateVedeaCoduriQr) return null;

  return (
    <>
      {poateVedeaCoduriQr ? (
        <Link
          href="/pontaj/setari/coduri-qr"
          className={buton({ varianta: "tertiar" })}
          title="Codul pe care angajații îl scanează la intrare, câte unul pentru fiecare punct de lucru."
        >
          <QrCode aria-hidden="true" className="size-4" />
          Coduri QR
        </Link>
      ) : null}
      {poateConfigura ? (
        <Link href="/pontaj/setari" className={buton({ varianta: "secundar" })}>
          Setări
        </Link>
      ) : null}
    </>
  );
}
