"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";
import type { Tara } from "@/lib/queries/per-diem";
import { MIJLOACE_TRANSPORT } from "@/schemas/per-diem";

import { adaugaEtapa } from "../actions";
import { ETICHETE_MIJLOC_TRANSPORT } from "../etichete";

type Erori = Readonly<Record<string, readonly string[]>>;

/**
 * Adaugă o etapă a traseului (`business_trip_legs`). Doar cât deplasarea e
 * editabilă (ciornă/respinsă) — dincolo de asta, RLS respinge inserarea, iar
 * mesajul triggerului ajunge la om prin `traduEroare`.
 *
 * O etapă e o TRECERE DE GRANIȚĂ: din ea motorul află în ce țară e omul în
 * fiecare zi, deci ce barem i se aplică. Două țări identice nu spun nimic —
 * schema le refuză, iar formularul nu mai lasă să fie alese: „În țara” nu o
 * conține pe cea de plecare. Mișcarea în interiorul aceleiași țări nu schimbă
 * diurna și nu se înregistrează ca etapă.
 *
 * `taraPornireId` e țara în care a ajuns ultima etapă (sau țara firmei, la
 * prima): traseul se scrie în lanț, deci plecarea unei etape e sosirea celei
 * de dinainte.
 */
export function FormularEtapa({
  tripId,
  tari,
  taraPornireId,
  taraDestinatieId,
}: {
  readonly tripId: string;
  readonly tari: readonly Tara[];
  readonly taraPornireId: string | null;
  readonly taraDestinatieId: string | null;
}) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const [erori, setErori] = useState<Erori>({});
  const [fromCountryId, setFromCountryId] = useState(taraPornireId ?? "");
  const [toCountryId, setToCountryId] = useState(
    taraDestinatieId !== null && taraDestinatieId !== taraPornireId ? taraDestinatieId : "",
  );
  const [plecareLa, setPlecareLa] = useState("");
  const [sosireLa, setSosireLa] = useState("");
  const [mijlocTransport, setMijlocTransport] = useState("");
  const [localitateSosire, setLocalitateSosire] = useState("");

  function curata(camp: string): void {
    setErori((vechi) => {
      if (!(camp in vechi)) return vechi;
      const { [camp]: _, ...rest } = vechi;
      return rest;
    });
  }

  function valideaza(): Erori {
    const gasite: Record<string, string[]> = {};
    if (fromCountryId.length === 0) gasite.from_country_id = ["Alegeți țara din care se pleacă."];
    if (toCountryId.length === 0) gasite.to_country_id = ["Alegeți țara în care se ajunge."];
    if (plecareLa.length === 0) gasite.plecare_la = ["Completați data și ora plecării."];
    if (sosireLa.length === 0) gasite.sosire_la = ["Completați data și ora sosirii."];
    if (plecareLa.length > 0 && sosireLa.length > 0 && sosireLa < plecareLa) {
      gasite.sosire_la = ["Sosirea nu poate fi înainte de plecare."];
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
      const rezultat = await adaugaEtapa({
        business_trip_id: tripId,
        from_country_id: fromCountryId,
        to_country_id: toCountryId,
        plecare_la: plecareLa,
        sosire_la: sosireLa,
        mijloc_transport: mijlocTransport.length === 0 ? null : mijlocTransport,
        localitate_sosire: localitateSosire.length === 0 ? null : localitateSosire,
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
      // Următoarea etapă pleacă de unde a ajuns asta.
      setFromCountryId(toCountryId);
      setToCountryId("");
      setPlecareLa("");
      setSosireLa("");
      setMijlocTransport("");
      setLocalitateSosire("");
      router.refresh();
    });
  }

  return (
    <div className="border-border rounded-panou space-y-3 border p-4">
      <div>
        <p className="text-corp font-medium">Adaugă o etapă a traseului</p>
        <p className="text-muted-foreground text-nota mt-1">
          Adăugați o etapă la fiecare trecere a graniței — de exemplu România → Austria, apoi
          Austria → Germania. Din etape se știe în ce țară ați fost în fiecare zi, deci ce barem se
          aplică. Fără etape, toată deplasarea se calculează pe țara ei. Drumurile în interiorul
          aceleiași țări nu se trec aici.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Camp
          nume="from_country_id"
          id="etapa-from"
          eticheta="Din țara"
          fel="select"
          erori={erori["from_country_id"] ?? []}
        >
          {(a) => (
            <select
              {...a}
              value={fromCountryId}
              onChange={(e) => {
                setFromCountryId(e.target.value);
                if (e.target.value === toCountryId) setToCountryId("");
                curata("from_country_id");
              }}
            >
              <option value="">Alegeți</option>
              {tari.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.denumire}
                </option>
              ))}
            </select>
          )}
        </Camp>

        <Camp
          nume="to_country_id"
          id="etapa-to"
          eticheta="În țara"
          fel="select"
          erori={erori["to_country_id"] ?? []}
        >
          {(a) => (
            <select
              {...a}
              value={toCountryId}
              onChange={(e) => {
                setToCountryId(e.target.value);
                curata("to_country_id");
              }}
            >
              <option value="">Alegeți</option>
              {tari
                .filter((t) => t.id !== fromCountryId)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.denumire}
                  </option>
                ))}
            </select>
          )}
        </Camp>

        <Camp
          nume="mijloc_transport"
          id="etapa-mijloc"
          eticheta="Mijloc de transport (opțional)"
          fel="select"
          erori={erori["mijloc_transport"] ?? []}
        >
          {(a) => (
            <select
              {...a}
              value={mijlocTransport}
              onChange={(e) => {
                setMijlocTransport(e.target.value);
                curata("mijloc_transport");
              }}
            >
              <option value="">Nespecificat</option>
              {MIJLOACE_TRANSPORT.map((m) => (
                <option key={m} value={m}>
                  {ETICHETE_MIJLOC_TRANSPORT[m]}
                </option>
              ))}
            </select>
          )}
        </Camp>

        <Camp
          nume="plecare_la"
          id="etapa-plecare"
          eticheta="Plecarea etapei"
          erori={erori["plecare_la"] ?? []}
        >
          {(a) => (
            <input
              {...a}
              type="datetime-local"
              value={plecareLa}
              onChange={(e) => {
                setPlecareLa(e.target.value);
                curata("plecare_la");
              }}
            />
          )}
        </Camp>

        <Camp
          nume="sosire_la"
          id="etapa-sosire"
          eticheta="Sosirea etapei"
          erori={erori["sosire_la"] ?? []}
        >
          {(a) => (
            <input
              {...a}
              type="datetime-local"
              value={sosireLa}
              onChange={(e) => {
                setSosireLa(e.target.value);
                curata("sosire_la");
              }}
            />
          )}
        </Camp>

        <Camp
          nume="localitate_sosire"
          id="etapa-localitate"
          eticheta="Localitatea de sosire (opțional)"
          erori={erori["localitate_sosire"] ?? []}
        >
          {(a) => (
            <input
              {...a}
              type="text"
              maxLength={200}
              value={localitateSosire}
              onChange={(e) => {
                setLocalitateSosire(e.target.value);
                curata("localitate_sosire");
              }}
            />
          )}
        </Camp>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Buton varianta="primar" inCurs={inCurs} textInCurs="Se salvează…" onClick={trimite}>
          Adaugă etapa
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
