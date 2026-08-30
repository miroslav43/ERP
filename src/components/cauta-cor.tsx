// src/components/cauta-cor.tsx
"use client";

import { useId, useMemo, useState } from "react";

import { clasaControl } from "@/components/ui/camp";
import { cautaOcupatii, ocupatiaDupaCod, type CodCor } from "@/domain/hr/cor-nomenclator";

/**
 * Căutarea codului COR, cu autocomplete.
 *
 * Nomenclatorul are 4422 de ocupații și e IMPORTAT ÎN CLIENT, deliberat: 200 KB
 * de text care se comprimă bine, în schimbul unei căutări instantanee la
 * fiecare tastă, fără drum la server. Alternativa — o Server Action per tastă —
 * ar fi însemnat o cerere la fiecare literă pentru un nomenclator care se
 * schimbă o dată la câțiva ani.
 *
 * Câmpul rămâne un `<input name="cod_cor">` obișnuit, ca formularul-părinte să
 * citească valoarea din `FormData` fără să știe nimic despre componenta asta.
 *
 * Mutată aici din `app/(app)/functii/` când migrarea 0110 a desființat
 * nomenclatorul: acum o folosesc fișa angajatului, asistentul de înrolare,
 * formularul de contract și cele patru ecrane de reguli.
 *
 * `invalid` și `descrisDe` vin din `<Camp>`: `codCorOptional` respinge un cod
 * care nu există în nomenclator, iar mesajul acela trebuie să ajungă LÂNGĂ
 * câmpul de căutare, nu sub buton. Fără ele, singurul câmp care poate cădea pe
 * o regulă de business era și singurul fără marcaj de invaliditate.
 */
export function CautaCor({
  idInput,
  valoareInitiala = "",
  invalid = false,
  descrisDe,
  laAlegere,
  laText,
}: {
  readonly idInput: string;
  readonly valoareInitiala?: string;
  readonly invalid?: boolean;
  readonly descrisDe?: string | undefined;
  /**
   * Chemat când omul alege o ocupație din listă, cu ocupația întreagă — cod ȘI
   * denumire.
   *
   * Există pentru fișa angajatului, unde denumirea funcției e un al doilea câmp:
   * alegerea codului o completează dacă e goală. Componenta nu decide singură
   * asta — scrierea peste un titlu intern („Sudor MAG, schimbul 2") ar fi exact
   * genul de gest pe care omul nu l-a cerut.
   */
  readonly laAlegere?: (ocupatie: CodCor) => void;
  /**
   * Chemat la FIECARE schimbare a textului, inclusiv tastare liberă.
   *
   * Necesar pentru formularele cu stare controlată, care nu citesc din
   * `FormData`: acolo, fără el, un cod tastat de mână — fără a-l alege din
   * listă — s-ar pierde tăcut la salvare, iar regula s-ar scrie cu codul gol.
   */
  readonly laText?: (valoare: string) => void;
}) {
  const [interogare, setInterogare] = useState(valoareInitiala);
  const [deschis, setDeschis] = useState(false);
  const idLista = useId();

  const rezultate = useMemo(() => cautaOcupatii(interogare, 12), [interogare]);
  const alesa = useMemo(() => ocupatiaDupaCod(interogare), [interogare]);

  return (
    <div className="relative">
      <input
        id={idInput}
        name="cod_cor"
        type="text"
        value={interogare}
        maxLength={160}
        autoComplete="off"
        role="combobox"
        aria-expanded={deschis && rezultate.length > 0}
        aria-controls={idLista}
        aria-autocomplete="list"
        aria-invalid={invalid ? true : undefined}
        aria-describedby={descrisDe}
        placeholder="Caută ocupația: „sudor”, „inginer”, sau codul 251401"
        onChange={(eveniment) => {
          setInterogare(eveniment.target.value);
          setDeschis(true);
          laText?.(eveniment.target.value);
        }}
        onFocus={() => {
          setDeschis(true);
        }}
        // `onBlur` cu întârziere: fără ea, clicul pe un rezultat închide lista
        // înainte ca `onMouseDown` să apuce să se declanșeze, iar selecția nu se
        // face niciodată.
        onBlur={() => {
          window.setTimeout(() => {
            setDeschis(false);
          }, 150);
        }}
        className={clasaControl()}
      />

      {alesa !== null ? (
        <p className="text-muted-foreground text-nota mt-1">
          <span className="font-mono">{alesa.cod}</span> — {alesa.denumire}
        </p>
      ) : interogare.trim().length > 0 ? (
        <p className="text-muted-foreground text-nota mt-1">
          Alegeți o ocupație din listă. Codul trebuie să existe în Clasificarea Ocupațiilor din
          România — REVISAL îl refuză altfel.
        </p>
      ) : null}

      {deschis && rezultate.length > 0 ? (
        <ul
          id={idLista}
          role="listbox"
          className="border-border bg-surface rounded-control shadow-plutitor absolute z-10 mt-1 max-h-64 w-full overflow-auto border"
        >
          {rezultate.map((ocupatie) => (
            <li key={ocupatie.cod}>
              <button
                type="button"
                role="option"
                aria-selected={ocupatie.cod === interogare}
                onMouseDown={() => {
                  setInterogare(ocupatie.cod);
                  setDeschis(false);
                  laText?.(ocupatie.cod);
                  laAlegere?.(ocupatie);
                }}
                className="hover:bg-background text-corp flex w-full gap-2 px-3 py-2 text-left"
              >
                <span className="text-muted-foreground text-nota shrink-0 font-mono">
                  {ocupatie.cod}
                </span>
                <span className="min-w-0">{ocupatie.denumire}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
