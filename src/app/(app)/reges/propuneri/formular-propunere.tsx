// src/app/(app)/reges/propuneri/formular-propunere.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { Camp } from "@/components/ui/camp";
import { propunePlecarea } from "../actiuni-api";

export type ContractEligibil = Readonly<{
  id: string;
  numar: string;
  angajatNume: string | null;
}>;

export type OptiuneTemei = Readonly<{ cod: string; nume: string }>;

export function FormularPropunere(props: {
  readonly contracte: readonly ContractEligibil[];
  readonly temeiuri: readonly OptiuneTemei[];
}) {
  const router = useRouter();
  const [deschis, setDeschis] = useState(false);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [erori, setErori] = useState<Readonly<Record<string, readonly string[]>> | null>(null);
  const [inCurs, startTransition] = useTransition();

  function trimite(formular: FormData) {
    setMesaj(null);
    setErori(null);
    const dataSfarsit = String(formular.get("dataSfarsit") ?? "");
    startTransition(async () => {
      const rezultat = await propunePlecarea({
        contractId: String(formular.get("contractId") ?? ""),
        fel: String(formular.get("fel") ?? "detasare") as "detasare" | "mutare",
        cuiDestinatie: String(formular.get("cuiDestinatie") ?? ""),
        numeDestinatie: String(formular.get("numeDestinatie") ?? ""),
        dataInceput: String(formular.get("dataInceput") ?? ""),
        // Câmp gol ≠ „fără termen" trimis explicit: cheia lipsește din obiect,
        // ca schema să nu primească un șir care nu e dată.
        ...(dataSfarsit === "" ? {} : { dataSfarsit }),
        temeiLegal: String(formular.get("temeiLegal") ?? ""),
      });
      if (rezultat.ok) {
        setDeschis(false);
        router.refresh();
      } else {
        setMesaj(rezultat.error.message);
        setErori(rezultat.error.fieldErrors);
      }
    });
  }

  if (props.contracte.length === 0) {
    return (
      <Callout fel="informativ" titlu="Niciun contract eligibil">
        O propunere se transmite prin referință la contractul deja înregistrat la Inspecția Muncii.
        Transmiteți întâi adăugarea unui contract, apoi el apare aici.
      </Callout>
    );
  }

  return (
    <div className="space-y-3">
      <Buton varianta="primar" onClick={() => setDeschis((v) => !v)} aria-expanded={deschis}>
        Propune o detașare sau o mutare
      </Buton>

      {deschis ? (
        <form action={trimite} className="border-border rounded-control space-y-4 border p-4">
          {mesaj !== null ? (
            <Callout fel="eroare" titlu="Nu s-a putut">
              {mesaj}
            </Callout>
          ) : null}

          <Camp
            nume="contractId"
            eticheta="Contractul"
            erori={erori?.["contractId"] ?? []}
            obligatoriu
            fel="select"
          >
            {(a) => (
              <select {...a}>
                {props.contracte.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.numar} — {c.angajatNume ?? "fără nume"}
                  </option>
                ))}
              </select>
            )}
          </Camp>

          <Camp nume="fel" eticheta="Felul" erori={erori?.["fel"] ?? []} obligatoriu fel="select">
            {(a) => (
              <select {...a} defaultValue="detasare">
                <option value="detasare">Detașare</option>
                <option value="mutare">Mutare</option>
              </select>
            )}
          </Camp>

          <Camp
            nume="cuiDestinatie"
            eticheta="CUI-ul angajatorului destinație"
            erori={erori?.["cuiDestinatie"] ?? []}
            obligatoriu
          >
            {(a) => <input {...a} type="text" maxLength={20} />}
          </Camp>

          <Camp
            nume="numeDestinatie"
            eticheta="Denumirea angajatorului destinație"
            ajutor="Opțională — ajută doar la citirea listei."
            erori={erori?.["numeDestinatie"] ?? []}
          >
            {(a) => <input {...a} type="text" maxLength={200} />}
          </Camp>

          <Camp
            nume="dataInceput"
            eticheta="De la"
            erori={erori?.["dataInceput"] ?? []}
            obligatoriu
          >
            {(a) => <input {...a} type="date" />}
          </Camp>

          <Camp
            nume="dataSfarsit"
            eticheta="Până la"
            ajutor="Lăsați gol pentru o perioadă nedeterminată."
            erori={erori?.["dataSfarsit"] ?? []}
          >
            {(a) => <input {...a} type="date" />}
          </Camp>

          <Camp
            nume="temeiLegal"
            eticheta="Temeiul legal"
            ajutor={
              props.temeiuri.length === 0
                ? "Nomenclatorul TemeiDetasare nu e descărcat încă — descărcați-l din „Chei API”."
                : "Din nomenclatorul TemeiDetasare al Inspecției Muncii."
            }
            erori={erori?.["temeiLegal"] ?? []}
            obligatoriu
            fel={props.temeiuri.length === 0 ? "input" : "select"}
          >
            {(a) =>
              props.temeiuri.length === 0 ? (
                <input {...a} type="text" maxLength={120} />
              ) : (
                <select {...a}>
                  {props.temeiuri.map((t) => (
                    <option key={t.cod} value={t.cod}>
                      {t.nume}
                    </option>
                  ))}
                </select>
              )
            }
          </Camp>

          <p className="text-muted-foreground text-nota">
            Propunerea intră în coadă. Pleacă la Inspecția Muncii la următorul ciclu de
            reconciliere, iar angajatorul destinație o acceptă sau o respinge din aplicația lui.
          </p>

          <Buton type="submit" varianta="primar" disabled={inCurs}>
            {inCurs ? "Se pregătește…" : "Pune în coadă"}
          </Buton>
        </form>
      ) : null}
    </div>
  );
}
