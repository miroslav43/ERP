"use client";

import { useId } from "react";

import { Formular } from "@/components/ui/formular";
import { actiuneDemo } from "@/demo/actiune";
import { TIPURI } from "@/demo/lume";

export type CerereDemo = Readonly<{
  employeeId: string;
  deLa: string;
  panaLa: string;
  tipId: string;
}>;

/**
 * Formularul demonstrației.
 *
 * `Formular` e componenta REALĂ, iar `actiune` e propul prin care scrierea se
 * abate spre memorie. Nu există `"use server"` pe drumul ăsta și niciun apel de
 * rețea: cerința „datele trăiesc doar în sesiunea de browser" e o proprietate a
 * construcției, nu o promisiune.
 */
export function FormularCerereDemo({
  angajatId,
  primaZi,
  ultimaZi,
  laAdaugare,
}: {
  readonly angajatId: string;
  /** Prima zi a lunii DESENATE (ISO). Vezi nota despre `min`/`max` de mai jos. */
  readonly primaZi: string;
  /** Ultima zi a lunii desenate (ISO). */
  readonly ultimaZi: string;
  readonly laAdaugare: (cerere: CerereDemo) => void;
}) {
  const idDeLa = useId();
  const idPanaLa = useId();
  const idTip = useId();

  const trimite = actiuneDemo<CerereDemo>((date) => {
    const deLa = String(date.get("data_inceput") ?? "");
    const panaLa = String(date.get("data_sfarsit") ?? "");
    const lipsa: Record<string, readonly string[]> = {};
    if (deLa === "") lipsa["data_inceput"] = ["Alegeți ziua de început."];
    if (panaLa === "") lipsa["data_sfarsit"] = ["Alegeți ziua de sfârșit."];
    if (panaLa !== "" && deLa !== "" && panaLa < deLa) {
      lipsa["data_sfarsit"] = ["Ziua de sfârșit e înaintea celei de început."];
    }
    /*
     * Marginile se verifică ȘI aici, nu doar prin `min`/`max` pe câmp.
     * Atributele opresc selectorul nativ, dar nu și o valoare pusă din
     * devtools sau o autocompletare exotică — iar o cerere în afara lunii
     * desenate se scrie în depozit și NU APARE nicăieri pe grilă: toast de
     * reușită, calendar neschimbat. Exact clasa de defect tăcut pe care o
     * vânează demonstrația. Mai bine un refuz care spune de ce.
     */
    for (const [camp, valoare] of [
      ["data_inceput", deLa],
      ["data_sfarsit", panaLa],
    ] as const) {
      if (valoare !== "" && (valoare < primaZi || valoare > ultimaZi)) {
        lipsa[camp] = ["Demonstrația arată o singură lună — alegeți o zi din luna afișată."];
      }
    }
    if (Object.keys(lipsa).length > 0) {
      return { refuz: "Cererea nu e completă.", campuri: lipsa };
    }

    const cerere: CerereDemo = {
      employeeId: angajatId,
      deLa,
      panaLa,
      tipId: String(date.get("leave_type_id") ?? TIPURI[0]?.id ?? ""),
    };
    return cerere;
  });

  // ATENȚIE la contractul lui `Formular` (`src/components/ui/formular.tsx:44-76`):
  // `children` e RENDER PROP — primește `StareFormular<TData>` și întoarce
  // marcaj. Nu e `ReactNode`. Iar propul de confirmare se numește
  // `mesajReusita`, nu `mesajSucces`.
  //
  // ── DE CE `laAdaugare` MERGE PRIN `laReusita`, NU CHEMAT DIN `scrie` ──────
  // `Formular` cheamă `arataToast(...)` ȘI `laReusita?.(...)` din PROPRIUL lui
  // efect, DUPĂ ce a înregistrat rezultatul (`formular.tsx:106-118`) — toastul
  // înainte de callback, în aceeași funcție. Un apel `laAdaugare(cerere)` scris
  // direct în `scrie` ar rula ÎNAINTE ca `useActionState` să apuce să seteze
  // `rezultat`, deci `VitrinaConcedii` ar închide caseta (⇒ demontează
  // `Formular`) chiar în timpul acțiunii — efectul care arată toastul n-ar mai
  // apuca să ruleze niciodată. Verificat empiric: exact asta se întâmpla.
  return (
    <Formular
      actiune={trimite}
      mesajReusita="Cerere înregistrată în demonstrație."
      laReusita={laAdaugare}
    >
      {({ inCurs, erori, valoriTrimise }) => (
        <div className="space-y-3">
          {/*
            ── DE CE `min`/`max` NU SUNT OPȚIONALE ─────────────────────────
            Selectorul nativ de dată se deschide pe luna CURENTĂ a sistemului,
            iar grila din spate desenează o singură lună. Fără margini,
            vizitatorul putea alege liniștit o zi din luna următoare: cererea
            intra în depozit, toastul confirma „Cerere înregistrată", și pe
            calendar nu apărea NIMIC — nicio eroare, niciun indiciu. Un demo
            care pare rupt e mai rău decât unul absent.

            Marginile îl țin pe vizitator în luna desenată; validarea din
            `trimite` prinde ce trece pe lângă atribute.
          */}
          <div>
            <label htmlFor={idDeLa}>De la</label>
            <input
              id={idDeLa}
              name="data_inceput"
              type="date"
              required
              min={primaZi}
              max={ultimaZi}
              defaultValue={valoriTrimise["data_inceput"] ?? ""}
              aria-invalid={erori["data_inceput"] !== undefined}
            />
            {erori["data_inceput"]?.map((e) => (
              <p key={e} className="text-corp text-destructive">
                {e}
              </p>
            ))}
          </div>

          <div>
            <label htmlFor={idPanaLa}>Până la</label>
            <input
              id={idPanaLa}
              name="data_sfarsit"
              type="date"
              required
              min={primaZi}
              max={ultimaZi}
              defaultValue={valoriTrimise["data_sfarsit"] ?? ""}
              aria-invalid={erori["data_sfarsit"] !== undefined}
            />
            {erori["data_sfarsit"]?.map((e) => (
              <p key={e} className="text-corp text-destructive">
                {e}
              </p>
            ))}
          </div>

          <div>
            <label htmlFor={idTip}>Tip</label>
            <select id={idTip} name="leave_type_id" defaultValue={TIPURI[0]?.id}>
              {TIPURI.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.denumire}
                </option>
              ))}
            </select>
          </div>

          <button type="submit" disabled={inCurs}>
            {inCurs ? "Se trimite…" : "Trimite cererea"}
          </button>
        </div>
      )}
    </Formular>
  );
}
