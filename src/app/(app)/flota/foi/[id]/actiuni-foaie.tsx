"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";
import { oraRomanieiPentruCamp } from "@/lib/format/date";
import type { StatusFoaie } from "@/schemas/fleet";

import { adaugaAlimentare, trimiteFoaie } from "../../actions";

type Erori = Readonly<Record<string, readonly string[]>>;

/**
 * Închiderea cursei și alimentările.
 *
 * O foaie aprobată nu se mai atinge: triggerul o refuză, cu mesaj în română.
 * Ascundem formularele ca omul să nu apese degeaba, dar regula rămâne în bază —
 * ascunderea nu e barieră.
 *
 * Fiecare formular își ține propriile erori pe câmp: refuzurile triggerelor
 * (kilometraj mai mic, alimentare în afara cursei) sosesc prin `fieldErrors`
 * — vezi `flota/erori.ts` — și înroșesc caseta vinovată. Orele se arată și se
 * trimit în ora României (`oraRomanieiPentruCamp` / `dataOraRomania`).
 */
export function ActiuniFoaie({
  id,
  status,
  kmPlecare,
  plecareLa,
  sosireLa,
}: {
  readonly id: string;
  readonly status: StatusFoaie;
  readonly kmPlecare: number;
  readonly plecareLa: string;
  readonly sosireLa: string | null;
}) {
  const router = useRouter();
  // Câte o tranziție per formular: una singură pentru amândouă dezactiva butonul
  // „Adaugă alimentarea” cât timp se trimitea foaia, și invers — două acțiuni
  // fără nicio legătură care se blocau una pe alta.
  const [seInchide, porneste] = useTransition();
  const [seAlimenteaza, pornesteAlimentarea] = useTransition();
  const [eroareInchidere, setEroareInchidere] = useState<string | null>(null);
  const [eroriInchidere, setEroriInchidere] = useState<Erori>({});
  const [eroareAlimentare, setEroareAlimentare] = useState<string | null>(null);
  const [eroriAlimentare, setEroriAlimentare] = useState<Erori>({});
  const [avertisment, setAvertisment] = useState<string | null>(null);

  const sePoateModifica = status === "draft" || status === "respins";
  const plecareCamp = oraRomanieiPentruCamp(plecareLa);
  const sosireCamp = sosireLa === null ? null : oraRomanieiPentruCamp(sosireLa);

  function inchide(formular: FormData): void {
    const sosire = String(formular.get("sosire_la") ?? "");
    const km = String(formular.get("km_sosire") ?? "").trim();
    const lipsa: Record<string, string[]> = {};
    if (sosire.length === 0) lipsa.sosire_la = ["Completați data și ora sosirii."];
    else if (sosire <= plecareCamp) {
      lipsa.sosire_la = ["Sosirea trebuie să fie după plecare."];
    }
    if (km.length === 0) lipsa.km_sosire = ["Scrieți kilometrajul la sosire, în km."];
    else if (Number(km) <= kmPlecare) {
      lipsa.km_sosire = [
        `Kilometrajul la sosire trebuie să fie mai mare decât cel de la plecare (${kmPlecare.toLocaleString("ro-RO")} km).`,
      ];
    }
    setEroriInchidere(lipsa);
    setAvertisment(null);
    if (Object.keys(lipsa).length > 0) {
      setEroareInchidere("Corectați câmpurile marcate.");
      return;
    }
    setEroareInchidere(null);
    porneste(async () => {
      const rezultat = await trimiteFoaie({ id, sosire_la: sosire, km_sosire: Number(km) });
      if (!rezultat.ok) {
        setEroriInchidere(rezultat.error.fieldErrors ?? {});
        setEroareInchidere(
          rezultat.error.fieldErrors === null
            ? rezultat.error.message
            : "Corectați câmpurile marcate.",
        );
        return;
      }
      // Saltul de kilometraj nu e o eroare — foaia s-a salvat. E o observație pe
      // care cineva trebuie să o explice, din ecranul de anomalii.
      setAvertisment(rezultat.data.anomalie);
      router.refresh();
    });
  }

  function alimenteaza(formular: FormData): void {
    const cand = String(formular.get("alimentat_la") ?? "");
    const litri = String(formular.get("litri") ?? "").trim();
    const cost = String(formular.get("cost") ?? "").trim();
    const lipsa: Record<string, string[]> = {};
    if (cand.length === 0) lipsa.alimentat_la = ["Completați data și ora alimentării."];
    else if (cand < plecareCamp || (sosireCamp !== null && cand > sosireCamp)) {
      lipsa.alimentat_la = [
        sosireCamp === null
          ? "Alimentarea nu poate fi înainte de plecarea cursei."
          : "Alimentarea trebuie să fie între plecarea și sosirea cursei.",
      ];
    }
    if (litri.length === 0 || Number(litri) <= 0) {
      lipsa.litri = ["Scrieți câți litri s-au alimentat (mai mult de zero)."];
    }
    if (cost.length === 0) lipsa.cost = ["Scrieți costul alimentării, în lei."];
    setEroriAlimentare(lipsa);
    if (Object.keys(lipsa).length > 0) {
      setEroareAlimentare("Corectați câmpurile marcate.");
      return;
    }
    setEroareAlimentare(null);
    pornesteAlimentarea(async () => {
      const rezultat = await adaugaAlimentare({
        trip_sheet_id: id,
        litri: Number(litri),
        cost: Number(cost),
        statie: String(formular.get("statie") ?? "").trim() || null,
        numar_bon: null,
        alimentat_la: cand,
        plin: false,
        observatii: null,
      });
      if (!rezultat.ok) {
        setEroriAlimentare(rezultat.error.fieldErrors ?? {});
        setEroareAlimentare(
          rezultat.error.fieldErrors === null
            ? rezultat.error.message
            : "Corectați câmpurile marcate.",
        );
        return;
      }
      router.refresh();
    });
  }

  return (
    <section aria-label="Acțiuni" className="space-y-4">
      {avertisment === null ? null : (
        <p
          role="status"
          className="border-warning/40 bg-warning/12 text-foreground rounded-panou text-corp border p-3"
        >
          {avertisment}
        </p>
      )}

      {sePoateModifica ? (
        <form
          action={inchide}
          noValidate
          className="border-border rounded-panou grid gap-3 border p-4 sm:grid-cols-3"
        >
          <p className="text-corp font-medium sm:col-span-3">
            Închide cursa și trimite spre aprobare
          </p>
          <Camp
            nume="sosire_la"
            id="foaie-sosire"
            eticheta="Sosire"
            obligatoriu
            erori={eroriInchidere["sosire_la"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="datetime-local"
                min={plecareCamp}
                defaultValue={sosireCamp ?? undefined}
              />
            )}
          </Camp>
          <Camp
            nume="km_sosire"
            id="foaie-km-sosire"
            eticheta="Kilometraj la sosire"
            obligatoriu
            ajutor={`La plecare: ${kmPlecare.toLocaleString("ro-RO")} km.`}
            erori={eroriInchidere["km_sosire"] ?? []}
          >
            {(a) => <input {...a} type="number" min={kmPlecare} />}
          </Camp>
          <div className="flex flex-wrap items-end gap-3">
            <Buton type="submit" varianta="primar" inCurs={seInchide} textInCurs="Se trimite…">
              Trimite spre aprobare
            </Buton>
          </div>
          {eroareInchidere === null ? null : (
            <p role="alert" className="text-danger text-corp sm:col-span-3">
              {eroareInchidere}
            </p>
          )}
        </form>
      ) : null}

      {status === "aprobat" ? null : (
        <form
          action={alimenteaza}
          noValidate
          className="border-border rounded-panou grid gap-3 border p-4 sm:grid-cols-4"
        >
          <p className="text-corp font-medium sm:col-span-4">Adaugă o alimentare</p>
          {/* Baza respinge o alimentare din afara intervalului cursei; `min` și
              `max` o spun din calendar, iar verificarea de mai sus o spune în
              cuvinte, pe câmp. `max` se pune doar când cursa e închisă: pentru
              una deschisă, „acum” calculat în client ar diferi de randarea de pe
              server și ar produce nepotrivire la hidratare. */}
          <Camp
            nume="alimentat_la"
            id="alimentare-cand"
            eticheta="Când"
            obligatoriu
            erori={eroriAlimentare["alimentat_la"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="datetime-local"
                min={plecareCamp}
                {...(sosireCamp === null ? {} : { max: sosireCamp })}
              />
            )}
          </Camp>
          <Camp
            nume="litri"
            id="alimentare-litri"
            eticheta="Litri"
            obligatoriu
            erori={eroriAlimentare["litri"] ?? []}
          >
            {(a) => <input {...a} type="number" min="0.01" step="0.01" />}
          </Camp>
          <Camp
            nume="cost"
            id="alimentare-cost"
            eticheta="Cost (lei)"
            obligatoriu
            erori={eroriAlimentare["cost"] ?? []}
          >
            {(a) => <input {...a} type="number" min="0" step="0.01" />}
          </Camp>
          <Camp
            nume="statie"
            id="alimentare-statie"
            eticheta="Stație"
            erori={eroriAlimentare["statie"] ?? []}
          >
            {(a) => <input {...a} maxLength={120} />}
          </Camp>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-4">
            <Buton
              type="submit"
              varianta="secundar"
              inCurs={seAlimenteaza}
              textInCurs="Se salvează…"
            >
              Adaugă alimentarea
            </Buton>
            {eroareAlimentare === null ? null : (
              <p role="alert" className="text-danger text-corp">
                {eroareAlimentare}
              </p>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
