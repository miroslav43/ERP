"use client";

// src/app/(portal)/portal/cursurile-mele/[id]/[lectieId]/test-grila.tsx
//
// O ÎNTREBARE PE ECRAN. Fără cronometru și fără amestecarea variantelor:
// niciuna nu măsoară ce a înțeles omul, amândouă adaugă stres și fac testul
// mai greu de dat pe telefon. Ce măsoară e pragul, iar acela se verifică pe
// server.
//
// Răspunsurile corecte NU ajung niciodată în client: componenta primește doar
// întrebările și variantele. Nota vine înapoi de la bază, după trimitere.

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";

import { BaraActiuni } from "@/components/ui/bara-actiuni";
import { Buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { Nivel } from "@/components/ui/nivel";
import { clasaBifa } from "@/components/ui/camp";
import { arataToast } from "@/components/ui/toast";
import type { IntrebareAfisata } from "@/lib/queries/cursuri";

import { trimiteTest } from "../../actions";

interface Proprietati {
  readonly lectieId: string;
  readonly inrolareId: string;
  readonly titlu: string;
  readonly intrebari: readonly IntrebareAfisata[];
  readonly pragTest: number;
  readonly incercariAnterioare: number;
  readonly dejaTrecut: boolean;
}

export function TestGrila({
  lectieId,
  inrolareId,
  titlu,
  intrebari,
  pragTest,
  incercariAnterioare,
  dejaTrecut,
}: Proprietati) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [pas, setPas] = useState(0);
  const [raspunsuri, setRaspunsuri] = useState<Readonly<Record<string, string>>>({});
  const [rezultat, setRezultat] = useState<Readonly<{
    scor: number;
    promovat: boolean;
    numar: number;
  }> | null>(null);
  const [eroare, setEroare] = useState<string | null>(null);

  const intrebare = intrebari[pas];
  const toateRaspunse = useMemo(
    () => intrebari.every((i) => raspunsuri[i.id] !== undefined),
    [intrebari, raspunsuri],
  );

  const trimite = useCallback((): void => {
    setEroare(null);
    porneste(async () => {
      const r = await trimiteTest({ enrollment_item_id: lectieId, raspunsuri });
      if (!r.ok) {
        setEroare(r.error.message);
        return;
      }
      setRezultat(r.data);
      if (r.data.promovat) {
        arataToast({ fel: "reusita", text: "Ați trecut testul." });
        router.refresh();
      }
    });
  }, [lectieId, raspunsuri, router]);

  if (dejaTrecut) {
    return (
      <Callout fel="informativ" titlu="Ați trecut deja acest test">
        Lecția e parcursă. O puteți revedea oricând.
      </Callout>
    );
  }

  if (intrebari.length === 0) {
    return (
      <Callout fel="atentie" titlu="Testul nu are întrebări">
        Anunțați administratorul: lecția cere un test care nu a fost încă scris.
      </Callout>
    );
  }

  if (rezultat !== null) {
    return (
      <div className="space-y-4">
        <div
          className={`rounded-panou border p-4 ${rezultat.promovat ? "border-success" : "border-danger"}`}
        >
          <p className="flex items-center gap-2 font-medium">
            {rezultat.promovat ? (
              <CheckCircle2 className="text-success size-5" aria-hidden="true" />
            ) : (
              <XCircle className="text-danger size-5" aria-hidden="true" />
            )}
            {rezultat.promovat ? "Ați trecut testul." : "Nu ați atins pragul de trecere."}
          </p>
          <p className="text-muted-foreground text-corp mt-2">
            Nota: {rezultat.scor.toFixed(0)} din 100. Pragul de trecere: {pragTest.toFixed(0)}.
            Încercarea {rezultat.numar}.
          </p>
        </div>

        {rezultat.promovat ? (
          <BaraActiuni lipitaPeTelefon>
            <Buton
              varianta="primar"
              onClick={() => {
                router.push(`/portal/cursurile-mele/${inrolareId}`);
              }}
            >
              Înapoi la curs
            </Buton>
          </BaraActiuni>
        ) : (
          <BaraActiuni lipitaPeTelefon>
            <Buton
              varianta="primar"
              onClick={() => {
                // Reluare curată: aceleași întrebări, răspunsuri golite.
                // Nu arătăm CE s-a greșit — testul se poate reîncerca, iar un
                // barem afișat l-ar transforma într-un exercițiu de memorat.
                setRezultat(null);
                setRaspunsuri({});
                setPas(0);
              }}
            >
              Reîncercați
            </Buton>
            <Buton
              varianta="tertiar"
              onClick={() => {
                router.push(`/portal/cursurile-mele/${inrolareId}`);
              }}
            >
              Mai târziu
            </Buton>
          </BaraActiuni>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {incercariAnterioare > 0 ? (
        <Callout fel="informativ">
          {incercariAnterioare === 1
            ? "Ați mai încercat o dată."
            : `Ați mai încercat de ${String(incercariAnterioare)} ori.`}{" "}
          Pragul de trecere e {pragTest.toFixed(0)} din 100.
        </Callout>
      ) : null}

      <Nivel
        valoare={pas + 1}
        din={intrebari.length}
        eticheta="Progresul testului"
        text={`Întrebarea ${String(pas + 1)} din ${String(intrebari.length)}`}
        marime="subtire"
      />

      {intrebare === undefined ? null : (
        <fieldset className="border-border rounded-panou border p-4">
          <legend className="px-1 font-medium">{intrebare.text}</legend>
          <div className="mt-2 space-y-1">
            {intrebare.optiuni.map((optiune) => (
              <label key={optiune.id} className="flex min-h-11 cursor-pointer items-center gap-3">
                <input
                  type="radio"
                  name={intrebare.id}
                  value={optiune.id}
                  className={clasaBifa}
                  checked={raspunsuri[intrebare.id] === optiune.id}
                  onChange={() => {
                    setRaspunsuri((p) => ({ ...p, [intrebare.id]: optiune.id }));
                  }}
                />
                <span className="text-corp">{optiune.text}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {eroare === null ? null : (
        <Callout fel="eroare" titlu="Testul nu s-a putut trimite">
          {eroare}
        </Callout>
      )}

      <BaraActiuni eticheta={`Navigare în testul „${titlu}”`} lipitaPeTelefon>
        <Buton
          varianta="tertiar"
          disabled={pas === 0}
          onClick={() => {
            setPas((p) => Math.max(0, p - 1));
          }}
        >
          Înapoi
        </Buton>
        {pas < intrebari.length - 1 ? (
          <Buton
            varianta="primar"
            disabled={intrebare !== undefined && raspunsuri[intrebare.id] === undefined}
            onClick={() => {
              setPas((p) => Math.min(intrebari.length - 1, p + 1));
            }}
          >
            Mai departe
          </Buton>
        ) : (
          <div className="flex flex-col gap-1">
            <Buton
              varianta="primar"
              disabled={!toateRaspunse || inCurs}
              inCurs={inCurs}
              textInCurs="Se trimite…"
              onClick={trimite}
            >
              Trimit testul
            </Buton>
            {toateRaspunse ? null : (
              <p className="text-muted-foreground text-nota">
                Răspundeți la toate întrebările înainte de a trimite.
              </p>
            )}
          </div>
        )}
      </BaraActiuni>
    </div>
  );
}
