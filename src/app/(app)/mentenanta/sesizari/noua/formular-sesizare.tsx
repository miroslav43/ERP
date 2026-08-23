"use client";

import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { URGENTE_SESIZARE } from "@/schemas/maintenance";
import { ETICHETE_URGENTA_SESIZARE } from "../../etichete";
import { cautaEchipament, creeazaSesizare } from "../../actions";

const PRAG_CAUTARE = 300;

// Redeclarat local, nu importat din `../../actions`: `createAction` nu-și
// poate infera mereu tipul datelor din corpul handler-ului într-un mod care
// să traverseze curat granița server/client — vezi
// `angajati/import/import-client.tsx` pentru același compromis.
interface EchipamentCautat {
  readonly id: string;
  readonly cod: string;
  readonly denumire: string;
  readonly locatie: string | null;
}

/**
 * `caleDupaSalvare` există pentru portal, unde același formular trebuie să ducă
 * înapoi în `/portal/sesizari`. Parametrizare, nu variantă proprie: spre
 * deosebire de cererea de concediu — unde portalul chiar are alt formular, fără
 * selector de angajat și fără câmpul de cale de storage — aici randarea e
 * identică, iar ce ar fi de dublat e partea grea: precompletarea din QR și
 * căutarea cu debounce prin acțiunea cu client admin. Două copii ale acelei
 * logici ar diverge la prima corectură.
 */
export function FormularSesizare({
  echipamentIdPrefill,
  caleDupaSalvare = "/mentenanta",
}: {
  readonly echipamentIdPrefill: string | null;
  readonly caleDupaSalvare?: string;
}) {
  const router = useRouter();
  const [echipamentSelectat, setEchipamentSelectat] = useState<EchipamentCautat | null>(null);
  const [interogare, setInterogare] = useState("");
  const [rezultate, setRezultate] = useState<readonly EchipamentCautat[]>([]);
  const [descriere, setDescriere] = useState("");
  const [urgenta, setUrgenta] = useState<(typeof URGENTE_SESIZARE)[number]>("medie");
  const [opresteFunctionarea, setOpresteFunctionarea] = useState(false);
  const [eroare, setEroare] = useState<string | null>(null);
  const [inCautare, porniCautare] = useTransition();
  const [inCurs, porniTrimitere] = useTransition();
  const idDescriere = useId();
  const idUrgenta = useId();
  const idOpreste = useId();
  const idCauta = useId();
  const prefillTratat = useRef(false);

  // Prefill din QR: caută exact echipamentul indicat, o singură dată.
  useEffect(() => {
    if (echipamentIdPrefill === null || prefillTratat.current) return;
    prefillTratat.current = true;
    porniCautare(async () => {
      const rezultat = await cautaEchipament({ q: echipamentIdPrefill });
      if (rezultat.ok && rezultat.data.length > 0) {
        const gasit = rezultat.data[0];
        if (gasit !== undefined) setEchipamentSelectat(gasit);
      }
    });
  }, [echipamentIdPrefill]);

  // Căutare cu debounce, doar cât timp nu e ales încă niciun echipament.
  // Nicio actualizare de stare sincronă în corpul efectului: golirea
  // rezultatelor la selecție nu e necesară — lista nu se randează decât cât
  // timp `echipamentSelectat` e `null`, deci rândurile vechi rămân doar
  // neafișate, nu greșite.
  useEffect(() => {
    if (interogare.trim().length < 2) return;
    const temporizator = setTimeout(() => {
      if (echipamentSelectat !== null) return;
      porniCautare(async () => {
        const rezultat = await cautaEchipament({ q: interogare });
        setRezultate(rezultat.ok ? rezultat.data : []);
      });
    }, PRAG_CAUTARE);
    return () => {
      clearTimeout(temporizator);
    };
  }, [interogare, echipamentSelectat]);

  function trimite(eveniment: FormEvent): void {
    eveniment.preventDefault();
    setEroare(null);
    if (echipamentSelectat === null) {
      setEroare("Selectați echipamentul defect.");
      return;
    }
    if (descriere.trim().length < 10) {
      setEroare("Descrieți defecțiunea în cel puțin 10 caractere.");
      return;
    }

    porniTrimitere(async () => {
      const rezultat = await creeazaSesizare({
        equipment_id: echipamentSelectat.id,
        descriere,
        urgenta,
        opreste_functionarea: opresteFunctionarea,
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.push(caleDupaSalvare);
      router.refresh();
    });
  }

  return (
    <form onSubmit={trimite} className="space-y-6" noValidate>
      <div className="space-y-2">
        <label htmlFor={idCauta} className="text-corp block font-medium">
          Echipament *
        </label>

        {echipamentSelectat !== null ? (
          <div className="border-foreground/60 rounded-control text-corp flex items-center justify-between border px-3 py-2">
            <span>
              <strong>{echipamentSelectat.cod}</strong> — {echipamentSelectat.denumire}
              {echipamentSelectat.locatie !== null ? ` · ${echipamentSelectat.locatie}` : ""}
            </span>
            <Buton
              varianta="link"
              onClick={() => {
                setEchipamentSelectat(null);
                setInterogare("");
              }}
              className="text-nota"
            >
              Schimbă
            </Buton>
          </div>
        ) : (
          <div className="relative">
            <input
              id={idCauta}
              type="search"
              value={interogare}
              onChange={(eveniment) => {
                setInterogare(eveniment.target.value);
              }}
              placeholder="Căutați după cod sau denumire (minimum 2 caractere)"
              autoComplete="off"
              className="border-foreground/60 rounded-control text-corp w-full border px-3 py-2"
            />
            {inCautare ? <p className="text-muted-foreground text-nota mt-1">Se caută…</p> : null}
            {rezultate.length > 0 ? (
              <ul
                role="listbox"
                aria-label="Rezultate căutare echipament"
                className="border-foreground/60 bg-background rounded-control shadow-plutitor absolute z-10 mt-1 w-full border"
              >
                {rezultate.map((echipament) => (
                  <li key={echipament.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => {
                        setEchipamentSelectat(echipament);
                        setRezultate([]);
                      }}
                      className="hover:bg-surface text-corp block w-full px-3 py-2 text-left"
                    >
                      <strong>{echipament.cod}</strong> — {echipament.denumire}
                      {echipament.locatie !== null ? (
                        <span className="text-muted-foreground"> · {echipament.locatie}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
      </div>

      <div>
        <label htmlFor={idDescriere} className="text-corp block font-medium">
          Ce s-a defectat? *
        </label>
        <textarea
          id={idDescriere}
          rows={4}
          required
          minLength={10}
          value={descriere}
          onChange={(eveniment) => {
            setDescriere(eveniment.target.value);
          }}
          placeholder="Descrieți ce ați observat: zgomot, scurgere, oprire neașteptată etc."
          className="border-foreground/60 rounded-control text-corp mt-1 w-full border px-3 py-2"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={idUrgenta} className="text-corp block font-medium">
            Urgență
          </label>
          <select
            id={idUrgenta}
            value={urgenta}
            onChange={(eveniment) => {
              setUrgenta(eveniment.target.value as (typeof URGENTE_SESIZARE)[number]);
            }}
            className="border-foreground/60 rounded-control text-corp mt-1 w-full border px-3 py-2"
          >
            {URGENTE_SESIZARE.map((u) => (
              <option key={u} value={u}>
                {ETICHETE_URGENTA_SESIZARE[u]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 self-end pb-2">
          <input
            id={idOpreste}
            type="checkbox"
            checked={opresteFunctionarea}
            onChange={(eveniment) => {
              setOpresteFunctionarea(eveniment.target.checked);
            }}
            className="size-4"
          />
          <label htmlFor={idOpreste} className="text-corp">
            Defecțiunea oprește funcționarea echipamentului
          </label>
        </div>
      </div>

      <div aria-live="polite">
        {eroare !== null ? (
          <p className="border-danger bg-danger/8 text-danger rounded-control text-corp border p-3">
            {eroare}
          </p>
        ) : null}
      </div>

      <Buton type="submit" varianta="primar" inCurs={inCurs} textInCurs="Se trimite…">
        Trimite sesizarea
      </Buton>
    </form>
  );
}
