"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import type { Tara } from "@/lib/queries/per-diem";
import { MIJLOACE_TRANSPORT } from "@/schemas/per-diem";

import { adaugaEtapa } from "../actions";
import { ETICHETE_MIJLOC_TRANSPORT } from "../etichete";

const CLASA_CAMP = "mt-1 w-full rounded-control border border-foreground/60 px-3 py-2 text-corp";

/**
 * Adaugă o etapă a traseului (`business_trip_legs`). Doar cât deplasarea e
 * editabilă (ciornă/respinsă) — dincolo de asta, RLS respinge inserarea, iar
 * mesajul triggerului ajunge la om prin `traduEroare`.
 */
export function FormularEtapa({
  tripId,
  tari,
}: {
  readonly tripId: string;
  readonly tari: readonly Tara[];
}) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const [fromCountryId, setFromCountryId] = useState("");
  const [toCountryId, setToCountryId] = useState("");
  const [plecareLa, setPlecareLa] = useState("");
  const [sosireLa, setSosireLa] = useState("");
  const [mijlocTransport, setMijlocTransport] = useState("");
  const [localitateSosire, setLocalitateSosire] = useState("");

  const id = {
    from: useId(),
    to: useId(),
    plecare: useId(),
    sosire: useId(),
    mijloc: useId(),
    localitate: useId(),
  };

  function trimite(): void {
    if (fromCountryId.length === 0 || toCountryId.length === 0) {
      setEroare("Alegeți țara de plecare și țara de sosire ale etapei.");
      return;
    }
    if (plecareLa.length === 0 || sosireLa.length === 0) {
      setEroare("Completați plecarea și sosirea etapei.");
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
        setEroare(rezultat.error.message);
        return;
      }
      setFromCountryId("");
      setToCountryId("");
      setPlecareLa("");
      setSosireLa("");
      setMijlocTransport("");
      setLocalitateSosire("");
      router.refresh();
    });
  }

  return (
    <div className="border-border rounded-panou grid gap-3 border p-4 sm:grid-cols-2 lg:grid-cols-3">
      <p className="text-corp font-medium sm:col-span-2 lg:col-span-3">
        Adaugă o etapă a traseului
      </p>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.from} className="text-corp">
          Din țara
        </label>
        <select
          id={id.from}
          value={fromCountryId}
          onChange={(e) => {
            setFromCountryId(e.target.value);
          }}
          className={CLASA_CAMP}
        >
          <option value="">Alegeți</option>
          {tari.map((t) => (
            <option key={t.id} value={t.id}>
              {t.denumire}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.to} className="text-corp">
          În țara
        </label>
        <select
          id={id.to}
          value={toCountryId}
          onChange={(e) => {
            setToCountryId(e.target.value);
          }}
          className={CLASA_CAMP}
        >
          <option value="">Alegeți</option>
          {tari.map((t) => (
            <option key={t.id} value={t.id}>
              {t.denumire}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.mijloc} className="text-corp">
          Mijloc de transport (opțional)
        </label>
        <select
          id={id.mijloc}
          value={mijlocTransport}
          onChange={(e) => {
            setMijlocTransport(e.target.value);
          }}
          className={CLASA_CAMP}
        >
          <option value="">Nespecificat</option>
          {MIJLOACE_TRANSPORT.map((m) => (
            <option key={m} value={m}>
              {ETICHETE_MIJLOC_TRANSPORT[m]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.plecare} className="text-corp">
          Plecarea etapei
        </label>
        <input
          id={id.plecare}
          type="datetime-local"
          value={plecareLa}
          onChange={(e) => {
            setPlecareLa(e.target.value);
          }}
          className={CLASA_CAMP}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.sosire} className="text-corp">
          Sosirea etapei
        </label>
        <input
          id={id.sosire}
          type="datetime-local"
          value={sosireLa}
          onChange={(e) => {
            setSosireLa(e.target.value);
          }}
          className={CLASA_CAMP}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.localitate} className="text-corp">
          Localitatea de sosire (opțional)
        </label>
        <input
          id={id.localitate}
          type="text"
          maxLength={200}
          value={localitateSosire}
          onChange={(e) => {
            setLocalitateSosire(e.target.value);
          }}
          className={CLASA_CAMP}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-3">
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
