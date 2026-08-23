"use client";

import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
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
  /** `true` după ce prefill-ul din QR s-a terminat FĂRĂ să găsească echipamentul. */
  const [prefillEsuat, setPrefillEsuat] = useState(false);
  /** `null` cât timp nu s-a căutat nimic încă; altfel termenul deja căutat. */
  const [termenCautat, setTermenCautat] = useState<string | null>(null);
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

  /*
   * Prefill din QR: caută exact echipamentul indicat, o singură dată.
   *
   * Ramura de eșec e partea care lipsea. `cautaEchipament` filtrează
   * `.neq("status","casat")`, deci un autocolant vechi, un utilaj casat sau
   * unul șters cădeau în tăcere: efectul nu făcea nimic, iar omul primea exact
   * ecranul de căutare gol al unei vizite obișnuite — ca și cum n-ar fi scanat.
   * Într-o hală, cu mănuși, asta se citește ca „aplicația nu merge”.
   */
  useEffect(() => {
    if (echipamentIdPrefill === null || prefillTratat.current) return;
    prefillTratat.current = true;
    porniCautare(async () => {
      const rezultat = await cautaEchipament({ q: echipamentIdPrefill });
      const gasit = rezultat.ok ? rezultat.data[0] : undefined;
      if (gasit === undefined) {
        setPrefillEsuat(true);
        return;
      }
      setEchipamentSelectat(gasit);
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
        const termen = interogare.trim();
        const rezultat = await cautaEchipament({ q: termen });
        setRezultate(rezultat.ok ? rezultat.data : []);
        // Se reține TERMENUL căutat, nu doar un boolean: mesajul de zero
        // rezultate trebuie să citeze ce s-a căutat, iar `interogare` se poate
        // fi schimbat deja între pornirea căutării și întoarcerea ei.
        setTermenCautat(termen);
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
      {prefillEsuat ? (
        <Callout fel="atentie" titlu="Codul QR scanat nu a dus la niciun echipament activ">
          Autocolantul poate fi vechi, iar utilajul scos din evidență sau casat. Căutați-l mai jos
          după cod, sau anunțați șeful de tură.
        </Callout>
      ) : null}

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
            <div aria-live="polite">
              {inCautare ? <p className="text-muted-foreground text-nota mt-1">Se caută…</p> : null}
              {/* Zero rezultate nu spunea nimic: după ce „Se caută…” dispărea,
                  ecranul arăta identic cu cel dinainte de a scrie.

                  Condiția cere ca termenul CĂUTAT să fie exact cel din casetă.
                  Altfel mesajul ar minți de două ori: după „Schimbă” (caseta se
                  golește, dar ultimul termen căutat rămâne) și în timpul
                  tastării unui termen nou, cât timp răspunsul vechi e încă cel
                  din stare. */}
              {!inCautare &&
              termenCautat !== null &&
              termenCautat === interogare.trim() &&
              interogare.trim().length >= 2 &&
              rezultate.length === 0 ? (
                <p className="text-foreground text-nota mt-1">
                  Niciun echipament pentru „{termenCautat}”. Verificați codul de pe plăcuță, sau
                  scanați codul QR de pe utilaj.
                </p>
              ) : null}
            </div>
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
                        // Banda de QR eșuat și-a făcut treaba: omul a găsit
                        // utilajul de mână. Lăsată pe ecran, ar contrazice
                        // cardul de confirmare de deasupra ei.
                        setPrefillEsuat(false);
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
        {eroare === null ? null : <Callout fel="eroare">{eroare}</Callout>}
      </div>

      <Buton type="submit" varianta="primar" inCurs={inCurs} textInCurs="Se trimite…">
        Trimite sesizarea
      </Buton>
    </form>
  );
}
