"use client";

// src/app/(app)/cursuri/[id]/atribuire/formular-atribuire.tsx
//
// La opt angajați, o listă cu bifare bate un motor de reguli. Filtrarea se face
// în client, peste o listă deja plafonată la 500 de rânduri de citire — nu e o
// interogare nouă la fiecare tastă.

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { BaraActiuni } from "@/components/ui/bara-actiuni";
import { Buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { StareGoala } from "@/components/ui/stare-goala";
import { arataToast } from "@/components/ui/toast";
import { clasaBifa, clasaControl } from "@/components/ui/camp";
import type { AngajatOptiune } from "@/lib/queries/cursuri";
import { Users } from "lucide-react";

import { atribuieCurs } from "../../actions";

interface Proprietati {
  readonly cursId: string;
  readonly denumire: string;
  readonly termenZile: number;
  readonly angajati: readonly AngajatOptiune[];
  /** Cine are deja cursul în curs sau parcurs: nu se re-atribuie din greșeală. */
  readonly deja: readonly string[];
}

export function FormularAtribuire({
  cursId,
  denumire,
  termenZile,
  angajati,
  deja,
}: Proprietati) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [cauta, setCauta] = useState("");
  const [alesi, setAlesi] = useState<ReadonlySet<string>>(new Set());
  const [confirma, setConfirma] = useState(false);
  const [eroare, setEroare] = useState<string | null>(null);

  const dejaSet = useMemo(() => new Set(deja), [deja]);
  const vizibili = useMemo(() => {
    const t = cauta.trim().toLowerCase();
    return t === "" ? angajati : angajati.filter((a) => a.nume.toLowerCase().includes(t));
  }, [angajati, cauta]);

  const comuta = useCallback((id: string): void => {
    setAlesi((precedent) => {
      const urmator = new Set(precedent);
      if (urmator.has(id)) urmator.delete(id);
      else urmator.add(id);
      return urmator;
    });
  }, []);

  const trimite = useCallback((): void => {
    setEroare(null);
    setConfirma(false);
    porneste(async () => {
      const rezultat = await atribuieCurs({
        course_id: cursId,
        employee_ids: [...alesi],
        termen: null,
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      const { atribuite, esuate } = rezultat.data;
      arataToast({
        fel: esuate === 0 ? "reusita" : "informativ",
        text:
          esuate === 0
            ? `Cursul a fost atribuit la ${String(atribuite)} ${atribuite === 1 ? "persoană" : "persoane"}.`
            : `Atribuit la ${String(atribuite)}; ${String(esuate)} au fost sărite (aveau deja cursul).`,
      });
      setAlesi(new Set());
      router.push(`/cursuri/${cursId}/stadiu`);
      router.refresh();
    });
  }, [alesi, cursId, router]);

  if (angajati.length === 0) {
    return (
      <StareGoala
        fel="initiala"
        pictograma={Users}
        titlu="Niciun angajat activ"
        descriere="Adăugați întâi angajați, apoi le puteți atribui cursuri."
        actiune={{ eticheta: "Deschideți lista de angajați", href: "/angajati" }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {eroare === null ? null : (
        <Callout fel="eroare" titlu="Atribuirea nu a reușit">
          {eroare}
        </Callout>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-eticheta text-muted-foreground uppercase">Caută persoană</span>
        <input
          type="search"
          value={cauta}
          onChange={(e) => {
            setCauta(e.target.value);
          }}
          placeholder="Nume"
          className={clasaControl()}
        />
      </label>

      <ul className="divide-border border-border rounded-panou divide-y border">
        {vizibili.map((angajat) => {
          const areDeja = dejaSet.has(angajat.id);
          return (
            <li key={angajat.id}>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 p-3">
                <input
                  type="checkbox"
                  className={clasaBifa}
                  checked={alesi.has(angajat.id)}
                  disabled={areDeja || inCurs}
                  onChange={() => {
                    comuta(angajat.id);
                  }}
                />
                <span className="flex-1">{angajat.nume}</span>
                {areDeja ? (
                  <span className="text-muted-foreground text-nota">Are deja cursul</span>
                ) : null}
              </label>
            </li>
          );
        })}
      </ul>

      <BaraActiuni eticheta="Atribuire" lipitaPeTelefon>
        <Buton
          varianta="primar"
          disabled={alesi.size === 0 || inCurs}
          inCurs={inCurs}
          textInCurs="Se atribuie…"
          onClick={() => {
            setConfirma(true);
          }}
        >
          Atribuie la {alesi.size} {alesi.size === 1 ? "persoană" : "persoane"}
        </Buton>
      </BaraActiuni>

      <ConfirmareActiune
        deschis={confirma}
        laInchidere={() => {
          setConfirma(false);
        }}
        titlu={`Atribuiți „${denumire}”?`}
        consecinta="Fiecare persoană primește o notificare și îl vede imediat în „Cursurile mele”."
        cifre={[
          { eticheta: "Persoane", valoare: String(alesi.size) },
          { eticheta: "Termen", valoare: `${String(termenZile)} zile de azi` },
        ]}
        etichetaConfirmare="Atribuie"
        inCurs={inCurs}
        laConfirmare={trimite}
      />
    </div>
  );
}
