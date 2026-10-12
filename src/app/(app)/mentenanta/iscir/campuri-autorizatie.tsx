"use client";

import { useState, type ReactElement } from "react";

import { Camp } from "@/components/ui/camp";
import type { StareFormular } from "@/components/ui/formular";
import {
  ETICHETE_REGIM_ISCIR,
  ETICHETE_TIP_ISCIR,
  REGIMURI_ISCIR,
  TIPURI_ISCIR,
  esteTipIscir,
} from "@/domain/maintenance/iscir";

/**
 * Câmpurile autorizației ISCIR (M7, 0211), comune casetei „Autorizație ISCIR
 * nouă” și casetei „Corectează”.
 *
 * ── REGIMUL (cazul 42) ────────────────────────────────────────────────────
 * Un echipament sub pragul de înregistrare stă doar în evidența RSVTI și n-are
 * număr ISCIR. Regimul e singura stare a câmpurilor: decide dacă numărul e
 * obligatoriu și ce scrie sub el. Restul rămân `defaultValue`, ca
 * `valoriTrimise` să le poată repune după un refuz.
 *
 * ── TIPUL RĂMÂNE TEXT ─────────────────────────────────────────────────────
 * Lista vine din `TIPURI_ISCIR`. O autorizație dinainte de 0211 are tipul scris
 * liber („Macara capră 5t”): la corectare, valoarea veche apare ca opțiune
 * proprie, ca salvarea să n-o schimbe pe tăcute.
 */
export function CampuriAutorizatie({
  stare,
  idc,
  existenta,
}: Readonly<{
  stare: StareFormular<unknown>;
  idc: (nume: string) => string;
  /** Valorile curente, ca text, la corectare; lipsă la înregistrare. */
  existenta?: Readonly<Record<string, string>>;
}>): ReactElement {
  const trimise: Readonly<Record<string, string>> = stare.data === null ? stare.valoriTrimise : {};
  const valoare = (cheie: string, implicit = ""): string =>
    trimise[cheie] ?? existenta?.[cheie] ?? implicit;

  const [regim, setRegim] = useState<string>(valoare("regim", "inregistrat"));
  const evidentaRsvti = regim === "neinregistrat_rsvti";
  const tipCurent = valoare("tip");
  const tipLiber = tipCurent !== "" && !esteTipIscir(tipCurent);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Camp
        nume="regim"
        id={idc("regim")}
        eticheta="Regim"
        fel="select"
        className="sm:col-span-2 lg:col-span-1"
        erori={stare.erori["regim"] ?? []}
      >
        {(a) => (
          <select
            {...a}
            value={regim}
            onChange={(e) => {
              setRegim(e.target.value);
            }}
          >
            {REGIMURI_ISCIR.map((r) => (
              <option key={r} value={r}>
                {ETICHETE_REGIM_ISCIR[r]}
              </option>
            ))}
          </select>
        )}
      </Camp>

      <Camp
        nume="numar"
        id={idc("numar")}
        eticheta="Număr de înregistrare ISCIR"
        obligatoriu={!evidentaRsvti}
        {...(evidentaRsvti
          ? { ajutor: "Echipamentul nu e înregistrat la ISCIR, deci numărul poate lipsi." }
          : {})}
        erori={stare.erori["numar"] ?? []}
      >
        {(a) => <input {...a} maxLength={80} defaultValue={valoare("numar")} />}
      </Camp>

      <Camp
        nume="tip"
        id={idc("tip")}
        eticheta="Tipul echipamentului"
        fel="select"
        obligatoriu
        erori={stare.erori["tip"] ?? []}
      >
        {(a) => (
          <select {...a} defaultValue={tipCurent}>
            <option value="">Alegeți tipul</option>
            {tipLiber ? <option value={tipCurent}>{tipCurent} (scris liber)</option> : null}
            {TIPURI_ISCIR.map((t) => (
              <option key={t} value={t}>
                {ETICHETE_TIP_ISCIR[t]}
              </option>
            ))}
          </select>
        )}
      </Camp>

      <Camp
        nume="emitent"
        id={idc("emitent")}
        eticheta="Emitent"
        erori={stare.erori["emitent"] ?? []}
      >
        {(a) => <input {...a} maxLength={120} defaultValue={valoare("emitent", "ISCIR")} />}
      </Camp>

      <Camp
        nume="emis_la"
        id={idc("emis-la")}
        eticheta="Emisă la"
        ajutor="De la ea se măsoară maximul legal până la următoarea verificare."
        erori={stare.erori["emis_la"] ?? []}
      >
        {(a) => <input {...a} type="date" defaultValue={valoare("emis_la")} />}
      </Camp>

      <Camp
        nume="valabil_pana"
        id={idc("valabil-pana")}
        eticheta="Valabilă până la"
        obligatoriu
        erori={stare.erori["valabil_pana"] ?? []}
      >
        {(a) => <input {...a} type="date" defaultValue={valoare("valabil_pana")} />}
      </Camp>

      <Camp
        nume="scadenta_verificare_tehnica"
        id={idc("scadenta-verificare")}
        eticheta="Următoarea verificare tehnică (VTP)"
        ajutor="Data scrisă de inspector în procesul-verbal. Ea are prioritate față de orice calcul."
        erori={stare.erori["scadenta_verificare_tehnica"] ?? []}
      >
        {(a) => <input {...a} type="date" defaultValue={valoare("scadenta_verificare_tehnica")} />}
      </Camp>

      <Camp
        nume="conditii"
        id={idc("conditii")}
        eticheta="Condiții impuse"
        fel="textarea"
        className="sm:col-span-2 lg:col-span-3"
        erori={stare.erori["conditii"] ?? []}
      >
        {(a) => <textarea {...a} rows={2} maxLength={1000} defaultValue={valoare("conditii")} />}
      </Camp>
    </div>
  );
}
