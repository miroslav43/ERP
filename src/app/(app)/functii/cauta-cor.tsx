// src/app/(app)/functii/cauta-cor.tsx
"use client";

import { useId, useMemo, useState } from "react";

import { clasaControl } from "@/components/ui/camp";
import { cautaOcupatii, ocupatiaDupaCod } from "@/domain/hr/cor-nomenclator";

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
}: {
  readonly idInput: string;
  readonly valoareInitiala?: string;
  readonly invalid?: boolean;
  readonly descrisDe?: string | undefined;
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
