// src/app/(app)/functii/cauta-cor.tsx
"use client";

import { useId, useMemo, useState } from "react";

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
 */
export function CautaCor({
  idInput,
  valoareInitiala = "",
}: {
  readonly idInput: string;
  readonly valoareInitiala?: string;
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
        className="border-foreground/60 w-full rounded-md border px-3 py-2 text-sm"
      />

      {alesa !== null ? (
        <p className="text-muted-foreground mt-1 text-xs">
          <span className="font-mono">{alesa.cod}</span> — {alesa.denumire}
        </p>
      ) : interogare.trim().length > 0 ? (
        <p className="text-muted-foreground mt-1 text-xs">
          Alegeți o ocupație din listă. Codul trebuie să existe în Clasificarea Ocupațiilor din
          România — REVISAL îl refuză altfel.
        </p>
      ) : null}

      {deschis && rezultate.length > 0 ? (
        <ul
          id={idLista}
          role="listbox"
          className="border-border bg-surface absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border shadow-lg"
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
                className="hover:bg-background flex w-full gap-2 px-3 py-2 text-left text-sm"
              >
                <span className="text-muted-foreground shrink-0 font-mono text-xs">
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
