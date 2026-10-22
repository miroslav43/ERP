"use client";

// src/app/(app)/flota/rezervari/dialog-rezervare-noua.tsx
//
// Caseta „Rezervare nouă” (0216, F12d). Aceeași componentă în aplicația mare
// (`/flota/rezervari`) și în portal (`/portal/masina-mea/rezervari`), ca
// `FormularDeplasare` în `portal/diurna-mea/noua`.
//
// Se deschide prin parametru (`?rezervare=noua&vehicul=<id>&de_la=<zi>`), cu
// `deschisInitial` + `key` pe pagină: o navigare pe ACEEAȘI rută nu remontează.
//
// Durata maximă și aprobarea sunt ale FIRMEI: caseta le arată (din
// `setarileRezervarilor`), dar regula o ține baza (P0001 pe câmp, prin
// `traduEroareRezervare`). Statusul nu se alege: îl pune triggerul.

import { CalendarPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";

import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import type { StareFormular } from "@/components/ui/formular";
import { panaLaMaxim } from "@/domain/fleet/rezervari";

import { creeazaRezervare } from "./actions";
import { valoriRezervare } from "./valori-rezervare";

export type VehiculRezervabil = Readonly<{
  id: string;
  nr_inmatriculare: string;
  marca: string;
  model: string;
  status: "activ" | "in_service" | "vandut" | "casat";
}>;

export type AngajatRezervabil = Readonly<{ id: string; full_name: string | null; marca: string }>;

export type PropsDialogRezervareNoua = Readonly<{
  vehicule: readonly VehiculRezervabil[];
  /** Doar sub `vehicle_reservations:create = all`; `null` = omul rezervă pentru el. */
  angajati: readonly AngajatRezervabil[] | null;
  /** Ziua de azi, în ora României (`todayInBucharest()` pe server). */
  azi: string;
  maxZile: number;
  /** Se confirmă pe loc: firma n-are aprobare, sau omul are `approve = all`. */
  seConfirmaImediat: boolean;
  deschisInitial?: boolean;
  vehiculInitial?: string | null;
  deLaInitial?: string | null;
  /** Unde revine pagina după salvare (fără `?rezervare=noua`). */
  baza: string;
}>;

type Rezultat = Readonly<{ id: string; status: string }>;

function CampuriRezervare({
  stare,
  idc,
  vehicule,
  angajati,
  azi,
  maxZile,
  vehiculInitial,
  deLaInitial,
}: Readonly<{
  stare: StareFormular<Rezultat>;
  idc: (sufix: string) => string;
  vehicule: readonly VehiculRezervabil[];
  angajati: readonly AngajatRezervabil[] | null;
  azi: string;
  maxZile: number;
  vehiculInitial: string | null;
  deLaInitial: string | null;
}>): ReactElement {
  const v = stare.valoriTrimise;
  const [vehiculAles, setVehiculAles] = useState(v["vehicle_id"] ?? vehiculInitial ?? "");
  const [deLa, setDeLa] = useState(
    v["de_la"] ?? (deLaInitial !== null && deLaInitial >= azi ? deLaInitial : azi),
  );
  const inService = vehicule.find((x) => x.id === vehiculAles)?.status === "in_service";
  const maxim = deLa.length === 10 ? panaLaMaxim(deLa, maxZile) : undefined;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Camp
        nume="vehicle_id"
        id={idc("vehicle_id")}
        eticheta="Mașina"
        fel="select"
        obligatoriu
        className="sm:col-span-2"
        erori={stare.erori["vehicle_id"] ?? []}
      >
        {(a) => (
          <select
            {...a}
            value={vehiculAles}
            onChange={(e) => {
              setVehiculAles(e.target.value);
            }}
          >
            <option value="" disabled>
              Alegeți mașina
            </option>
            {vehicule.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nr_inmatriculare} · {x.marca} {x.model}
                {x.status === "in_service" ? " (în service)" : ""}
              </option>
            ))}
          </select>
        )}
      </Camp>
      {inService ? (
        <p role="status" className="text-warning text-nota -mt-2 sm:col-span-2">
          Mașina e în service acum. Rezervarea se poate face, dar verificați cu responsabilul de
          flotă că va fi gata.
        </p>
      ) : null}
      {angajati === null ? null : (
        <Camp
          nume="employee_id"
          id={idc("employee_id")}
          eticheta="Pentru angajatul"
          fel="select"
          ajutor="Gol = pentru dumneavoastră."
          className="sm:col-span-2"
          erori={stare.erori["employee_id"] ?? []}
        >
          {(a) => (
            <select {...a} defaultValue={v["employee_id"] ?? ""}>
              <option value="">Pentru mine</option>
              {angajati.map((ang) => (
                <option key={ang.id} value={ang.id}>
                  {ang.full_name ?? ang.marca} ({ang.marca})
                </option>
              ))}
            </select>
          )}
        </Camp>
      )}
      <Camp
        nume="de_la"
        id={idc("de_la")}
        eticheta="Din ziua"
        obligatoriu
        erori={stare.erori["de_la"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="date"
            min={azi}
            value={deLa}
            onChange={(e) => {
              setDeLa(e.target.value);
            }}
          />
        )}
      </Camp>
      <Camp
        nume="pana_la"
        id={idc("pana_la")}
        eticheta="Până în ziua (inclusiv)"
        obligatoriu
        ajutor={`Cel mult ${String(maxZile)} ${maxZile === 1 ? "zi" : "zile"}.`}
        erori={stare.erori["pana_la"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="date"
            min={deLa.length === 10 ? deLa : azi}
            {...(maxim === undefined ? {} : { max: maxim })}
            defaultValue={v["pana_la"] ?? deLa}
            key={deLa}
          />
        )}
      </Camp>
      <Camp
        nume="scop"
        id={idc("scop")}
        eticheta="Scopul deplasării"
        obligatoriu
        ajutor="De serviciu: clientul, șantierul, livrarea. Nu există rezervare pentru uz personal."
        className="sm:col-span-2"
        erori={stare.erori["scop"] ?? []}
      >
        {(a) => (
          <input {...a} type="text" minLength={3} maxLength={300} defaultValue={v["scop"] ?? ""} />
        )}
      </Camp>
      <Camp
        nume="destinatie"
        id={idc("destinatie")}
        eticheta="Destinația"
        className="sm:col-span-2"
        erori={stare.erori["destinatie"] ?? []}
      >
        {(a) => <input {...a} type="text" maxLength={300} defaultValue={v["destinatie"] ?? ""} />}
      </Camp>
      <Camp
        nume="observatii"
        id={idc("observatii")}
        eticheta="Observații"
        fel="textarea"
        className="sm:col-span-2"
        erori={stare.erori["observatii"] ?? []}
      >
        {(a) => <textarea {...a} rows={2} maxLength={1000} defaultValue={v["observatii"] ?? ""} />}
      </Camp>
    </div>
  );
}

export function DialogRezervareNoua({
  vehicule,
  angajati,
  azi,
  maxZile,
  seConfirmaImediat,
  deschisInitial = false,
  vehiculInitial = null,
  deLaInitial = null,
  baza,
}: PropsDialogRezervareNoua): ReactElement {
  const router = useRouter();
  const vehiculValid =
    vehiculInitial !== null && vehicule.some((x) => x.id === vehiculInitial)
      ? vehiculInitial
      : null;

  return (
    <FormularDialog
      declansator={{
        eticheta: "Rezervare nouă",
        varianta: "primar",
        pictograma: <CalendarPlus aria-hidden="true" className="size-4" />,
        disabled: vehicule.length === 0,
      }}
      titlu="Rezervare nouă"
      descriere={
        seConfirmaImediat
          ? "Rezervarea se confirmă imediat. Zilele alese se blochează pentru ceilalți colegi."
          : "Rezervarea merge la aprobare: managerul sau responsabilul de flotă o confirmă. Zilele se blochează de acum."
      }
      deschisInitial={deschisInitial}
      actiune={(date: FormData) => creeazaRezervare(valoriRezervare(date))}
      mesajReusita={
        seConfirmaImediat
          ? "Rezervarea a fost confirmată."
          : "Rezervarea a fost trimisă spre aprobare."
      }
      laReusita={() => {
        router.replace(baza);
      }}
      etichetaTrimite={seConfirmaImediat ? "Rezervă" : "Trimite spre aprobare"}
      textInCurs="Se salvează…"
    >
      {(stare, idc) => (
        <CampuriRezervare
          stare={stare}
          idc={idc}
          vehicule={vehicule}
          angajati={angajati}
          azi={azi}
          maxZile={maxZile}
          vehiculInitial={vehiculValid}
          deLaInitial={deLaInitial}
        />
      )}
    </FormularDialog>
  );
}
