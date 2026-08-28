// src/app/(app)/reges/[id]/formular-clasificare.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { Camp } from "@/components/ui/camp";
import {
  ETICHETE_NORMA_TIMP,
  ETICHETE_REPARTIZARE,
  ETICHETE_TIP_CONTRACT,
  ETICHETE_TIP_NORMA,
} from "../constante";
import { salveazaClasificarea } from "../actiuni-api";

export type ValoriClasificare = Readonly<{
  contractId: string;
  tipContract: string;
  tipNorma: string;
  normaTimp: string;
  repartizare: string;
  temeiIncetare: string | null;
  /** `true` dacă valorile de mai sus sunt deduse, nu alese de un om. */
  dedus: boolean;
  cuTemeiIncetare: boolean;
}>;

function optiuni(etichete: Record<string, string>) {
  return Object.entries(etichete).map(([valoare, eticheta]) => (
    <option key={valoare} value={valoare}>
      {eticheta}
    </option>
  ));
}

export function FormularClasificare(props: {
  readonly valori: ValoriClasificare;
  readonly poateEdita: boolean;
}) {
  const router = useRouter();
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [erori, setErori] = useState<Readonly<Record<string, readonly string[]>> | null>(null);
  const [salvat, setSalvat] = useState(false);
  const [inCurs, startTransition] = useTransition();

  function trimite(formular: FormData) {
    setMesaj(null);
    setErori(null);
    setSalvat(false);
    const temeiIncetare = String(formular.get("temeiIncetare") ?? "");
    startTransition(async () => {
      const rezultat = await salveazaClasificarea({
        contractId: props.valori.contractId,
        tipContract: String(formular.get("tipContract") ?? "") as never,
        tipNorma: String(formular.get("tipNorma") ?? "") as never,
        normaTimp: String(formular.get("normaTimp") ?? "") as never,
        repartizare: String(formular.get("repartizare") ?? "") as never,
        ...(props.valori.cuTemeiIncetare ? { temeiIncetare } : {}),
      });
      if (rezultat.ok) {
        setSalvat(true);
        router.refresh();
      } else {
        setMesaj(rezultat.error.message);
        setErori(rezultat.error.fieldErrors);
      }
    });
  }

  return (
    <form action={trimite} className="space-y-4">
      {mesaj !== null ? (
        <Callout fel="eroare" titlu="Nu s-a putut salva">
          {mesaj}
        </Callout>
      ) : null}
      {salvat ? <Callout fel="informativ">Clasificarea a fost salvată.</Callout> : null}

      {props.valori.dedus ? (
        <Callout fel="atentie" titlu="Valori deduse, neconfirmate">
          Valorile de mai jos sunt calculate din normă și din modul de lucru, nu alese de cineva.
          Pentru un contract obișnuit sunt corecte. Pentru un raport de serviciu, un contract de
          management sau timp redus O.U.G. 132/2020 nu au cum să fie — acelea nu se pot deduce din
          nimic din ce ținem noi. Confirmați-le înainte de transmitere.
        </Callout>
      ) : null}

      <Camp
        nume="tipContract"
        eticheta="Tipul contractului"
        erori={erori?.["tipContract"] ?? []}
        obligatoriu
        fel="select"
      >
        {(a) => (
          <select {...a} defaultValue={props.valori.tipContract} disabled={!props.poateEdita}>
            {optiuni(ETICHETE_TIP_CONTRACT)}
          </select>
        )}
      </Camp>

      <Camp
        nume="tipNorma"
        eticheta="Tipul de normă"
        erori={erori?.["tipNorma"] ?? []}
        obligatoriu
        fel="select"
      >
        {(a) => (
          <select {...a} defaultValue={props.valori.tipNorma} disabled={!props.poateEdita}>
            {optiuni(ETICHETE_TIP_NORMA)}
          </select>
        )}
      </Camp>

      <Camp
        nume="normaTimp"
        eticheta="Norma de timp de muncă"
        erori={erori?.["normaTimp"] ?? []}
        obligatoriu
        fel="select"
      >
        {(a) => (
          <select {...a} defaultValue={props.valori.normaTimp} disabled={!props.poateEdita}>
            {optiuni(ETICHETE_NORMA_TIMP)}
          </select>
        )}
      </Camp>

      <Camp
        nume="repartizare"
        eticheta="Repartizarea programului"
        erori={erori?.["repartizare"] ?? []}
        obligatoriu
        fel="select"
      >
        {(a) => (
          <select {...a} defaultValue={props.valori.repartizare} disabled={!props.poateEdita}>
            {optiuni(ETICHETE_REPARTIZARE)}
          </select>
        )}
      </Camp>

      {props.valori.cuTemeiIncetare ? (
        <Camp
          nume="temeiIncetare"
          eticheta="Temeiul legal al încetării"
          ajutor="Codul din nomenclatorul TemeiIncetare. Câmpul liber de pe contract rămâne pentru decizia tipărită."
          erori={erori?.["temeiIncetare"] ?? []}
        >
          {(a) => (
            <input
              {...a}
              type="text"
              maxLength={120}
              defaultValue={props.valori.temeiIncetare ?? ""}
              disabled={!props.poateEdita}
            />
          )}
        </Camp>
      ) : null}

      {props.poateEdita ? (
        <Buton type="submit" varianta="primar" disabled={inCurs}>
          {inCurs ? "Se salvează…" : "Salvează clasificarea"}
        </Buton>
      ) : (
        <p className="text-muted-foreground text-nota">
          Modificarea cere permisiunea „REGES — modificare”.
        </p>
      )}
    </form>
  );
}
