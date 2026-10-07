"use client";
// src/app/(app)/pontaj/camp-sediu.tsx

import type { SediuPontaj } from "@/lib/queries/attendance";

/**
 * Alegerea sediului (0163).
 *
 * Prima opțiune e VALOAREA GOALĂ, iar eticheta ei numește sediul din contract:
 * omul vede „precompletat" sediul lui obișnuit, dar în bază rămâne `null`, adică
 * „cel din contract" — nu o declarație pe care n-a făcut-o. Sediul din contract
 * nu se repetă mai jos: ar fi două opțiuni cu același înțeles.
 */
export function CampSediu({
  id,
  sedii,
  valoare,
  onSchimba,
  clasaEticheta,
  clasa,
}: {
  readonly id: string;
  readonly sedii: readonly SediuPontaj[];
  readonly valoare: string;
  readonly onSchimba: (sediu: string) => void;
  readonly clasaEticheta: string;
  readonly clasa: string;
}) {
  const dinContract = sedii.find((s) => s.din_contract) ?? null;
  return (
    <div>
      <label htmlFor={id} className={clasaEticheta}>
        Sediul
      </label>
      <select
        id={id}
        value={valoare}
        onChange={(e) => {
          onSchimba(e.target.value);
        }}
        className={clasa}
      >
        <option value="">
          {dinContract === null ? "Sediul din contract" : `${dinContract.denumire} (din contract)`}
        </option>
        {sedii
          .filter((s) => !s.din_contract)
          .map((s) => (
            <option key={s.id} value={s.id}>
              {s.denumire}
            </option>
          ))}
      </select>
    </div>
  );
}
