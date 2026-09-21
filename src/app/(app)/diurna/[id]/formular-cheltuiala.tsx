"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";
import { IntrareData } from "@/components/ui/intrare-data";
import { formatLei } from "@/lib/format/money";
import { TIPURI_CHELTUIALA } from "@/schemas/per-diem";

import { adaugaCheltuiala } from "../actions";
import { ETICHETE_TIP_CHELTUIALA } from "../etichete";

type Erori = Readonly<Record<string, readonly string[]>>;

/** Monedele în care se plătesc de obicei cheltuielile unei deplasări. */
const MONEDE = ["RON", "EUR", "USD", "GBP", "CHF", "HUF", "PLN", "CZK", "BGN"] as const;

/**
 * Adaugă o cheltuială decontabilă (`trip_expenses`).
 *
 * `curs_valutar` e OBLIGATORIU în bază (NOT NULL, > 0) — se cere explicit
 * aici, nu se deduce. Conversia se afișează live: sumă × curs. Pe RON câmpul
 * nu apare deloc — un leu n-are curs față de lei — și se trimite 1.
 *
 * Aceleași primitive ca formularul de etapă de deasupra — `Camp`,
 * `IntrareData` — ca cele două casete să arate și să se poarte la fel, inclusiv
 * eroarea înroșită pe câmpul vinovat.
 */
export function FormularCheltuiala({ tripId }: { readonly tripId: string }) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const [erori, setErori] = useState<Erori>({});

  const [tip, setTip] = useState<(typeof TIPURI_CHELTUIALA)[number]>("cazare");
  const [descriere, setDescriere] = useState("");
  const [dataCheltuielii, setDataCheltuielii] = useState("");
  const [suma, setSuma] = useState("");
  const [moneda, setMoneda] = useState<string>("RON");
  const [cursValutar, setCursValutar] = useState("1");
  const [documentNumar, setDocumentNumar] = useState("");

  const inLei = moneda === "RON";
  const sumaLei = useMemo(() => {
    const s = Number(suma);
    const c = inLei ? 1 : Number(cursValutar);
    if (!Number.isFinite(s) || !Number.isFinite(c) || s <= 0 || c <= 0) return null;
    return s * c;
  }, [suma, cursValutar, inLei]);

  function curata(camp: string): void {
    setErori((vechi) => {
      if (!(camp in vechi)) return vechi;
      const { [camp]: _, ...rest } = vechi;
      return rest;
    });
  }

  function valideaza(): Erori {
    const gasite: Record<string, string[]> = {};
    if (dataCheltuielii.length === 0) {
      gasite.data_cheltuielii = ["Alegeți data cheltuielii (zz.ll.aaaa)."];
    }
    const sumaNum = Number(suma);
    if (suma.trim() === "" || !Number.isFinite(sumaNum) || sumaNum <= 0) {
      gasite.suma = ["Scrieți suma, mai mare decât zero."];
    }
    const cursNum = Number(cursValutar);
    if (!inLei && (cursValutar.trim() === "" || !Number.isFinite(cursNum) || cursNum <= 0)) {
      gasite.curs_valutar = [`Scrieți cursul BNR: câți lei face 1 ${moneda}.`];
    }
    return gasite;
  }

  function trimite(): void {
    const gasite = valideaza();
    setErori(gasite);
    if (Object.keys(gasite).length > 0) {
      setEroare("Corectați câmpurile marcate.");
      return;
    }
    setEroare(null);
    porneste(async () => {
      const rezultat = await adaugaCheltuiala({
        business_trip_id: tripId,
        tip,
        descriere: descriere.length === 0 ? null : descriere,
        data_cheltuielii: dataCheltuielii,
        suma: Number(suma),
        moneda,
        curs_valutar: inLei ? 1 : Number(cursValutar),
        document_tip: null,
        document_numar: documentNumar.length === 0 ? null : documentNumar,
        document_cale: null,
      });
      if (!rezultat.ok) {
        setErori(rezultat.error.fieldErrors ?? {});
        setEroare(
          rezultat.error.fieldErrors === null
            ? rezultat.error.message
            : "Corectați câmpurile marcate.",
        );
        return;
      }
      setDescriere("");
      setDataCheltuielii("");
      setSuma("");
      setDocumentNumar("");
      router.refresh();
    });
  }

  return (
    <div className="border-border rounded-panou space-y-3 border p-4">
      <p className="text-corp font-medium">Adaugă o cheltuială</p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Camp nume="tip" id="cheltuiala-tip" eticheta="Tip" fel="select" erori={erori["tip"] ?? []}>
          {(a) => (
            <select
              {...a}
              value={tip}
              onChange={(e) => {
                setTip(e.target.value as (typeof TIPURI_CHELTUIALA)[number]);
                curata("tip");
              }}
            >
              {TIPURI_CHELTUIALA.map((t) => (
                <option key={t} value={t}>
                  {ETICHETE_TIP_CHELTUIALA[t]}
                </option>
              ))}
            </select>
          )}
        </Camp>

        <Camp
          nume="data_cheltuielii"
          id="cheltuiala-data"
          eticheta="Data cheltuielii"
          erori={erori["data_cheltuielii"] ?? []}
        >
          {(a) => (
            <IntrareData
              {...a}
              valoare={dataCheltuielii}
              onSchimba={(zi) => {
                setDataCheltuielii(zi);
                curata("data_cheltuielii");
              }}
            />
          )}
        </Camp>

        <Camp
          nume="descriere"
          id="cheltuiala-descriere"
          eticheta="Descriere (opțional)"
          erori={erori["descriere"] ?? []}
        >
          {(a) => (
            <input
              {...a}
              type="text"
              maxLength={500}
              value={descriere}
              onChange={(e) => {
                setDescriere(e.target.value);
                curata("descriere");
              }}
            />
          )}
        </Camp>

        <Camp nume="suma" id="cheltuiala-suma" eticheta="Suma" erori={erori["suma"] ?? []}>
          {(a) => (
            <input
              {...a}
              type="number"
              min="0"
              step="0.01"
              value={suma}
              onChange={(e) => {
                setSuma(e.target.value);
                curata("suma");
              }}
            />
          )}
        </Camp>

        <Camp
          nume="moneda"
          id="cheltuiala-moneda"
          eticheta="Moneda"
          fel="select"
          erori={erori["moneda"] ?? []}
        >
          {(a) => (
            <select
              {...a}
              value={moneda}
              onChange={(e) => {
                setMoneda(e.target.value);
                // Cursul de 1 al leului nu e un punct de plecare pentru altă monedă.
                setCursValutar(e.target.value === "RON" ? "1" : "");
                curata("moneda");
                curata("curs_valutar");
              }}
            >
              {MONEDE.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}
        </Camp>

        {inLei ? null : (
          <Camp
            nume="curs_valutar"
            id="cheltuiala-curs"
            eticheta={`Curs BNR (lei pentru 1 ${moneda})`}
            {...(sumaLei === null ? {} : { ajutor: `${suma} ${moneda} = ${formatLei(sumaLei)}` })}
            erori={erori["curs_valutar"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="number"
                min="0"
                step="0.0001"
                placeholder="ex. 4,9750"
                value={cursValutar}
                onChange={(e) => {
                  setCursValutar(e.target.value);
                  curata("curs_valutar");
                }}
              />
            )}
          </Camp>
        )}

        <Camp
          nume="document_numar"
          id="cheltuiala-document"
          eticheta="Număr document (opțional)"
          erori={erori["document_numar"] ?? []}
        >
          {(a) => (
            <input
              {...a}
              type="text"
              maxLength={60}
              value={documentNumar}
              onChange={(e) => {
                setDocumentNumar(e.target.value);
                curata("document_numar");
              }}
            />
          )}
        </Camp>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Buton varianta="primar" inCurs={inCurs} textInCurs="Se salvează…" onClick={trimite}>
          Adaugă cheltuiala
        </Buton>
        {eroare === null ? null : (
          <p role="alert" className="text-danger text-corp">
            {eroare}
          </p>
        )}
      </div>
    </div>
  );
}
