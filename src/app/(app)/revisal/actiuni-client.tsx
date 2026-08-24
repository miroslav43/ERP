// src/app/(app)/revisal/actiuni-client.tsx
"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { Buton } from "@/components/ui/buton";
import { exportaEvenimente, marcheazaTransmis } from "./actions";

export function ActiuniEveniment(props: {
  readonly evenimentId: string;
  readonly numeAngajat: string;
  readonly azi: string;
}) {
  const router = useRouter();
  const idData = useId();
  const idNumar = useId();
  const [deschis, setDeschis] = useState(false);
  const [mesaj, setMesaj] = useState<{ tip: "eroare" | "succes"; text: string } | null>(null);
  const [inCurs, startTransition] = useTransition();

  function trimite(formular: FormData) {
    const transmisLa = String(formular.get("transmisLa") ?? "");
    const numarInregistrare = String(formular.get("numarInregistrare") ?? "");
    startTransition(async () => {
      const rezultat = await marcheazaTransmis({
        evenimentId: props.evenimentId,
        transmisLa,
        numarInregistrare,
      });
      if (rezultat.ok) {
        setMesaj({ tip: "succes", text: "Evenimentul a fost marcat ca transmis." });
        setDeschis(false);
        router.refresh();
      } else {
        setMesaj({ tip: "eroare", text: rezultat.error.message });
      }
    });
  }

  return (
    <div className="space-y-2">
      <Buton
        varianta="primar"
        onClick={() => setDeschis((valoare) => !valoare)}
        aria-expanded={deschis}
      >
        Marchează transmis
      </Buton>

      {deschis ? (
        <form action={trimite} className="bg-surface rounded-control space-y-2 p-3">
          <p className="text-muted-foreground text-nota">Transmitere pentru {props.numeAngajat}</p>
          <div>
            <label htmlFor={idData} className="text-foreground text-nota block font-medium">
              Data transmiterii
            </label>
            <input
              id={idData}
              name="transmisLa"
              type="date"
              required
              max={props.azi}
              defaultValue={props.azi}
              className="border-foreground/60 text-corp mt-1 w-full rounded border px-2 py-1"
            />
          </div>
          <div>
            <label htmlFor={idNumar} className="text-foreground text-nota block font-medium">
              Număr de înregistrare ITM
            </label>
            <input
              id={idNumar}
              name="numarInregistrare"
              type="text"
              required
              maxLength={60}
              className="border-foreground/60 text-corp mt-1 w-full rounded border px-2 py-1"
            />
          </div>
          <Buton type="submit" varianta="primar" inCurs={inCurs} textInCurs="Se salvează…">
            Confirmă transmiterea
          </Buton>
        </form>
      ) : null}

      <p
        aria-live="polite"
        className={`text-nota ${mesaj?.tip === "eroare" ? "text-danger" : "text-foreground"}`}
      >
        {mesaj?.text ?? ""}
      </p>
    </div>
  );
}

export function ButonExport() {
  const [mesaj, setMesaj] = useState<string>("");
  const [inCurs, startTransition] = useTransition();

  function descarca() {
    startTransition(async () => {
      const rezultat = await exportaEvenimente({ doarNetransmise: true });
      if (!rezultat.ok) {
        setMesaj(rezultat.error.message);
        return;
      }
      const blocante = rezultat.data.probleme.filter((p) => p.blocant).length;
      const url = URL.createObjectURL(
        new Blob([rezultat.data.continut], { type: "text/csv;charset=utf-8" }),
      );
      const legatura = document.createElement("a");
      legatura.href = url;
      legatura.download = rezultat.data.numeFisier;
      legatura.click();
      URL.revokeObjectURL(url);
      setMesaj(
        `S-au exportat ${rezultat.data.totalIntrari} evenimente; ${rezultat.data.gataDeTransmis} sunt complete, ${blocante} au date lipsă.`,
      );
    });
  }

  return (
    <span className="ml-auto flex items-center gap-3">
      <Buton varianta="secundar" onClick={descarca} inCurs={inCurs} textInCurs="Se pregătește…">
        Descarcă listing (CSV)
      </Buton>
      <span aria-live="polite" className="text-muted-foreground text-nota">
        {mesaj}
      </span>
    </span>
  );
}
